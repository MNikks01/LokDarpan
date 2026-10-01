import pg from "pg";

import { PromotionRefused, promoteCag } from "./promote";
import {
  DEFAULT_RAW_ROOT,
  RawStoreMisconfigured,
  rawStoreFromEnv,
  type RawStore,
} from "../raw-store";

/**
 * Copy the reviewed CAG ledger into another database — in practice, production.
 *
 *   SOURCE_DATABASE_URL=… TARGET_DATABASE_URL=… RAW_STORE_S3_*=… \
 *     pnpm --filter @lokdarpan/ingestion promote:cag            # dry run
 *   … promote:cag --commit                                      # writes
 *
 * A dry run by default: it does everything, checks every count, and rolls back.
 * Nothing is written to the target without `--commit`, which is the one flag a
 * person has to type on purpose. See `.docs/16-operations/promoting-the-cag-corpus.md`.
 */

const EXIT_USAGE = 64;
const EXIT_REFUSED = 65;
const EXIT_MISCONFIGURED = 78;

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    process.stderr.write(`${name} is not set.\n`);
    process.exit(EXIT_MISCONFIGURED);
  }
  return value;
}

async function main(): Promise<void> {
  const unknown = process.argv.slice(2).filter((a) => a !== "--commit");
  if (unknown.length > 0) {
    process.stderr.write(`Unknown argument(s): ${unknown.join(" ")}. Only --commit is accepted.\n`);
    process.exit(EXIT_USAGE);
  }
  const commit = process.argv.includes("--commit");
  const sourceUrl = required("SOURCE_DATABASE_URL");
  const targetUrl = required("TARGET_DATABASE_URL");
  if (sourceUrl === targetUrl) {
    process.stderr.write("SOURCE_DATABASE_URL and TARGET_DATABASE_URL are the same database.\n");
    process.exit(EXIT_USAGE);
  }

  // Bytes promoted into a database other readers use must outlive this machine.
  let store: RawStore;
  try {
    store = rawStoreFromEnv({ ...process.env, RAW_STORE_REQUIRE_OBJECT: "true" });
  } catch (error: unknown) {
    if (!(error instanceof RawStoreMisconfigured)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exit(EXIT_MISCONFIGURED);
  }

  const source = new pg.Client({ connectionString: sourceUrl });
  const target = new pg.Client({ connectionString: targetUrl });
  await source.connect();
  await target.connect();
  try {
    process.stdout.write(`raw store: ${store.location}\n${commit ? "COMMIT" : "dry run"} …\n`);
    const result = await promoteCag({
      source,
      target,
      store,
      rawRoot: process.env["RAW_STORE_ROOT"] ?? DEFAULT_RAW_ROOT,
      dryRun: !commit,
    });
    process.stdout.write(
      `${String(result.documents)} report(s) · ${String(result.pages)} pages · ` +
        `${String(result.facts)} figures, ${String(result.published)} published · ` +
        `${String(result.history)} review-history rows\n`,
    );
    if (result.alreadyPresent.length > 0) {
      process.stdout.write(
        `${String(result.alreadyPresent.length)} already in the target; left untouched.\n`,
      );
    }
    if (result.linksNotCarried > 0) {
      process.stdout.write(
        `${String(result.linksNotCarried)} same-figure link(s) point outside this run and were not carried.\n`,
      );
    }
    process.stdout.write(
      result.committed
        ? `Committed as dataset version ${String(result.datasetVersionId)}.\n`
        : "Rolled back: nothing was written to the target. Run with --commit to write.\n",
    );
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(error instanceof PromotionRefused ? EXIT_REFUSED : 1);
});
