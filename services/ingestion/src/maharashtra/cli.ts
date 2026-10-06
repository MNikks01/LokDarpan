import pg from "pg";

import { completeRun, failRun, openRun, type RunCounts } from "../ingestion-run";
import { OcrClient } from "../ocr/client";
import { readUnreadPages, type ReadPagesCounts } from "../ocr/read-pages";
import { RawStoreMisconfigured, rawStoreFromEnv, type ReadableRawStore } from "../raw-store";
import { collectListing, type AgencyListing, type CollectCounts } from "./collect";
import { extractNotices, type ExtractCounts } from "./documents";
import { PoliteClient } from "./http";
import { readNoticeFacts, type NoticeFactCounts } from "./notice-facts";
import { MHADA } from "./mhada";
import { MSIDC } from "./msidc";

/**
 * Collect tender notices from a Maharashtra agency's own listing.
 *
 *   pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=mhada                nightly: newest pages until all held
 *   pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=mhada --pages=0-454  backfill a range, every page read
 *   pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=msidc --dry-run      read listings, fetch no notice, write nothing
 *   pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=mhada --extract-only make documents of notices already held, and read their facts
 *   pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=mhada --extract-only --ocr  also send scanned pages to the OCR service
 *
 * After collecting, every held notice without a document is read back from the
 * raw store and loaded as a `tender_notice` document with its pages
 * (`documents.ts`). Scanned notices are reported: their pages await OCR.
 * Then every notice with text is read for its facts — tender ID, notice
 * number, EMD, fees, dates — as unverified candidates (`notice-facts.ts`).
 *
 * With `--ocr`, pages with no text layer are first sent to the OCR service at
 * `OCR_SERVICE_URL` (default http://127.0.0.1:8000) and each engine's reading is
 * stored beside the page (`ocr/read-pages.ts`, ADR-071). Off by default: the
 * service is optional, and a run without it is a complete run.
 *
 * Sources: `mhada` (455 pages, July 2016 on) and `msidc` (one page, February
 * 2024 on). Not yet scheduled (backlog MHA-TENDER-015 adds them to the nightly
 * job, with their own lock). Requests to one host are two seconds apart, so
 * MHADA's full backfill — about 4,500 notices — takes about five hours and
 * should be spread over several nights with `--pages`.
 */

// The registry of agency listings this CLI collects. A new agency is one line here.
const AGENCIES: Readonly<Record<string, AgencyListing<never>>> = {
  mhada: MHADA as AgencyListing<never>,
  msidc: MSIDC as AgencyListing<never>,
};

const EXIT_MISCONFIGURED = 2;

function argument(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

function agencyOrExit(): AgencyListing<never> {
  const name = argument("source") ?? "";
  const agency = AGENCIES[name];
  if (agency === undefined) {
    process.stderr.write(`--source must be one of: ${Object.keys(AGENCIES).join(", ")}\n`);
    process.exit(EXIT_MISCONFIGURED);
  }
  return agency;
}

function pageRange(lastPage: number): {
  readonly from: number;
  readonly to: number;
  readonly explicit: boolean;
} {
  const given = argument("pages");
  if (given === undefined) return { from: 0, to: lastPage, explicit: false };
  const match = /^(\d+)-(\d+)$/u.exec(given);
  if (match === null) throw new Error(`--pages must be FROM-TO, e.g. --pages=0-20; got ${given}`);
  const from = Number(match[1]);
  const to = Number(match[2]);
  if (to < from) throw new Error(`--pages ends before it starts: ${given}`);
  return { from, to, explicit: true };
}

function extractSummary(counts: ExtractCounts): string {
  return (
    `documents ${String(counts.documents)} · with text ${String(counts.withText)} · ` +
    `scanned, awaiting OCR ${String(counts.scanned)} · not extracted ${String(counts.failed)} · ` +
    `held elsewhere ${String(counts.elsewhere)}`
  );
}

function factSummary(counts: NoticeFactCounts): string {
  return (
    `notices read for facts ${String(counts.documents)} · with facts ${String(counts.withFacts)} · ` +
    `new candidates ${String(counts.inserted)} · retired ${String(counts.retired)} · ` +
    `decided facts no longer read ${String(counts.strandedDecisions)}`
  );
}

const DEFAULT_OCR_SERVICE = "http://127.0.0.1:8000";

function ocrSummary(counts: ReadPagesCounts): string {
  const missing =
    counts.enginesMissing.length === 0
      ? ""
      : ` · not installed: ${counts.enginesMissing.join(", ")}`;
  return (
    `OCR: documents ${String(counts.documents)} · pages ${String(counts.pages)} · ` +
    `readings ${String(counts.readings)} (no text found ${String(counts.empty)}) · ` +
    `refusals ${String(counts.refusals)} · not read ${String(counts.unavailable)}${missing}`
  );
}

function summary(counts: CollectCounts): string {
  return (
    `pages ${String(counts.pages)} · notices listed ${String(counts.listed)} · ` +
    `fetched ${String(counts.fetched)} · already held ${String(counts.alreadyHeld)} · ` +
    `refused by robots.txt ${String(counts.notPermitted)} · failed ${String(counts.failed)}`
  );
}

function storeOrExit(): ReadableRawStore {
  try {
    return rawStoreFromEnv();
  } catch (error: unknown) {
    if (!(error instanceof RawStoreMisconfigured)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exit(EXIT_MISCONFIGURED);
  }
}

interface RunOptions {
  readonly from: number;
  readonly to: number;
  readonly explicit: boolean;
  readonly dryRun: boolean;
  readonly extractOnly: boolean;
  readonly ocr: boolean;
  readonly log: (line: string) => void;
}

/** The run log's counts: what the listing pointed to, and what became of it. */
function runCountsOf(counts: CollectCounts | null): RunCounts {
  return {
    seen: counts?.listed ?? 0,
    inserted: counts?.fetched ?? 0,
    updated: 0,
    unchanged: counts?.alreadyHeld ?? 0,
    rejected: counts?.notPermitted ?? 0,
    unresolved: 0,
    errors: counts?.failed ?? 0,
  };
}

/** Collect (unless `--extract-only`), then make documents of held notices (unless `--dry-run`). */
async function runAgency(
  agency: AgencyListing<never>,
  collector: { readonly db: pg.Client; readonly store: ReadableRawStore },
  options: RunOptions,
): Promise<RunCounts> {
  const { db, store } = collector;
  const counts = options.extractOnly
    ? null
    : await collectListing(
        agency,
        { client: new PoliteClient(), db, store },
        {
          fromPage: options.from,
          toPage: options.to,
          stopWhenAllHeld: !options.explicit,
          dryRun: options.dryRun,
          log: options.log,
        },
      );
  if (counts !== null) options.log(summary(counts));
  if (!options.dryRun) {
    options.log(extractSummary(await extractNotices(agency, db, store, options.log)));
    if (options.ocr) {
      const client = new OcrClient({
        baseUrl: process.env["OCR_SERVICE_URL"] ?? DEFAULT_OCR_SERVICE,
      });
      const read = await readUnreadPages(agency.sourceId, { db, store, client }, options);
      options.log(ocrSummary(read));
    }
    options.log(factSummary(await readNoticeFacts(db, agency.sourceId)));
  }
  return runCountsOf(counts);
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(EXIT_MISCONFIGURED);
  }
  const agency = agencyOrExit();
  const store = storeOrExit();
  const range = pageRange(agency.lastPage);
  const dryRun = process.argv.includes("--dry-run");
  const log = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };
  log(
    `${agency.sourceId} · raw store: ${store.location} · ` +
      `pages ${String(range.from)}–${String(range.to)}${dryRun ? " · dry run" : ""}`,
  );

  const db = new pg.Client({ connectionString });
  await db.connect();
  const runId = dryRun ? null : await openRun(db, agency.sourceId);
  try {
    const counts = await runAgency(
      agency,
      { db, store },
      {
        ...range,
        dryRun,
        extractOnly: process.argv.includes("--extract-only"),
        ocr: process.argv.includes("--ocr"),
        log,
      },
    );
    if (runId !== null) await completeRun(db, runId, counts);
  } catch (error: unknown) {
    const note = error instanceof Error ? error.message : String(error);
    if (runId !== null) await failRun(db, runId, note);
    process.stderr.write(`${note}\n`);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

await main();
