import pg from "pg";

import { RawStoreMisconfigured, rawStoreFromEnv } from "../raw-store";
import { OcrClient } from "./client";
import { readUnreadPages, type ReadPagesOptions } from "./read-pages";

/**
 * Read a source's pages that have no text layer, with the OCR service.
 *
 *   pnpm --filter @lokdarpan/ingestion ocr:read -- --source=cag
 *   … --engines=tesseract --languages=eng,mar --ocr-page-seconds=600
 *
 * Every reading is stored beside its page (ADR-071) and nothing else is
 * written: facts are read from readings by each source's own parser, not here.
 * The service is at `OCR_SERVICE_URL` (default http://127.0.0.1:8000). Safe to
 * run again: a page an engine has read is not sent to that engine twice.
 */

const EXIT_MISCONFIGURED = 2;

function list(name: string): string[] | undefined {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const items = raw
    ?.split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  return items === undefined || items.length === 0 ? undefined : items;
}

interface Invocation {
  readonly connectionString: string;
  readonly sourceId: string;
  readonly options: ReadPagesOptions;
  readonly client: OcrClient;
}

function misconfigured(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(EXIT_MISCONFIGURED);
}

/** `--ocr-page-seconds=600`, or 0 for the client's own allowance. */
function pageSecondsOrExit(): number {
  const seconds = Number(
    process.argv.find((a) => a.startsWith("--ocr-page-seconds="))?.split("=")[1] ?? "0",
  );
  if (!Number.isInteger(seconds) || seconds < 0) {
    misconfigured("--ocr-page-seconds must be a positive whole number of seconds");
  }
  return seconds;
}

function invocationOrExit(log: (line: string) => void): Invocation {
  const connectionString = process.env["DATABASE_URL"] ?? "";
  const sourceId = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1];
  if (connectionString === "" || sourceId === undefined) {
    misconfigured("Set DATABASE_URL and pass --source=<source_id>.");
  }
  const seconds = pageSecondsOrExit();
  const engines = list("engines");
  const languages = list("languages");
  return {
    connectionString,
    sourceId,
    options: {
      log,
      ...(engines === undefined ? {} : { engines }),
      ...(languages === undefined ? {} : { languages }),
    },
    client: new OcrClient({
      baseUrl: process.env["OCR_SERVICE_URL"] ?? "http://127.0.0.1:8000",
      ...(seconds > 0 ? { readTimeoutPerPageMs: seconds * 1000 } : {}),
    }),
  };
}

function storeOrExit(): ReturnType<typeof rawStoreFromEnv> {
  try {
    return rawStoreFromEnv();
  } catch (error: unknown) {
    if (!(error instanceof RawStoreMisconfigured)) throw error;
    return misconfigured(error.message);
  }
}

async function main(): Promise<void> {
  const log = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };
  const { connectionString, sourceId, options, client } = invocationOrExit(log);
  const store = storeOrExit();

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const counts = await readUnreadPages(sourceId, { db, store, client }, options);
    log(
      `${sourceId} · OCR: documents ${String(counts.documents)} · pages ${String(counts.pages)} · ` +
        `readings ${String(counts.readings)} (no text found ${String(counts.empty)}) · ` +
        `refusals ${String(counts.refusals)} · not read ${String(counts.unavailable)}` +
        (counts.enginesMissing.length > 0
          ? ` · not installed: ${counts.enginesMissing.join(", ")}`
          : ""),
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
