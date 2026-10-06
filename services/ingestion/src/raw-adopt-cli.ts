import pg from "pg";

import { adoptRetainedArtifacts } from "./raw-adopt";
import { RawStoreMisconfigured, rawStoreFromEnv } from "./raw-store";

/**
 * Record where an old artefact's bytes are kept, once they verify.
 *
 *   pnpm --filter @lokdarpan/ingestion raw:adopt -- --source=cag
 *
 * For each of the source's artefacts with no `stored_in`, the bytes are read
 * from the configured raw store at the row's path and checked against its
 * sha256; only those that pass are given the store's location. See
 * `raw-adopt.ts` and `.docs/16-operations/raw-store.md`.
 */

const EXIT_MISCONFIGURED = 2;

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  const sourceId = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1];
  if (connectionString === undefined || connectionString === "" || sourceId === undefined) {
    process.stderr.write("Set DATABASE_URL and pass --source=<source_id>.\n");
    process.exit(EXIT_MISCONFIGURED);
  }
  let store;
  try {
    store = rawStoreFromEnv();
  } catch (error: unknown) {
    if (!(error instanceof RawStoreMisconfigured)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exit(EXIT_MISCONFIGURED);
  }

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const log = (line: string): void => {
      process.stdout.write(`${line}\n`);
    };
    const counts = await adoptRetainedArtifacts(db, store, sourceId, log);
    log(
      `${sourceId} · ${store.location}: adopted ${String(counts.adopted)} · ` +
        `missing ${String(counts.missing)} · not verifying ${String(counts.mismatched)}`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
