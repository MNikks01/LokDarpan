import pg from "pg";

import { completeRun, failRun, openRun } from "../ingestion-run";
import { RawStoreMisconfigured, rawStoreFromEnv, type RawStore } from "../raw-store";
import { collectListing, type AgencyListing, type CollectCounts } from "./collect";
import { PoliteClient } from "./http";
import { MHADA } from "./mhada";
import { MSIDC } from "./msidc";

/**
 * Collect tender notices from a Maharashtra agency's own listing.
 *
 *   pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=mhada                nightly: newest pages until all held
 *   pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=mhada --pages=0-454  backfill a range, every page read
 *   pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=msidc --dry-run      read listings, fetch no notice, write nothing
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

function summary(counts: CollectCounts): string {
  return (
    `pages ${String(counts.pages)} · notices listed ${String(counts.listed)} · ` +
    `fetched ${String(counts.fetched)} · already held ${String(counts.alreadyHeld)} · ` +
    `refused by robots.txt ${String(counts.notPermitted)} · failed ${String(counts.failed)}`
  );
}

function storeOrExit(): RawStore {
  try {
    return rawStoreFromEnv();
  } catch (error: unknown) {
    if (!(error instanceof RawStoreMisconfigured)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exit(EXIT_MISCONFIGURED);
  }
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
    `${agency.sourceId} · raw store: ${store.location} · pages ${String(range.from)}–${String(range.to)}` +
      (dryRun ? " · dry run" : ""),
  );

  const db = new pg.Client({ connectionString });
  await db.connect();
  const runId = dryRun ? null : await openRun(db, agency.sourceId);
  try {
    const counts = await collectListing(
      agency,
      { client: new PoliteClient(), db, store },
      {
        fromPage: range.from,
        toPage: range.to,
        stopWhenAllHeld: !range.explicit,
        dryRun,
        log,
      },
    );
    log(summary(counts));
    if (runId !== null) {
      await completeRun(db, runId, {
        seen: counts.listed,
        inserted: counts.fetched,
        updated: 0,
        unchanged: counts.alreadyHeld,
        rejected: counts.notPermitted,
        unresolved: 0,
        errors: counts.failed,
      });
    }
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
