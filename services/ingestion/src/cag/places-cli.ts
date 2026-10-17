import pg from "pg";

import { loadPlaceMentions } from "./places-load";

/**
 * Makes `place_mention` agree with the reviewed place names of one state
 * (ADR-077).
 *
 *   pnpm --filter @lokdarpan/ingestion ingest:places -- --state=27
 *
 * Run after reviewing `--kind=place_reference`. It reads only decided facts, so
 * running it before anything is reviewed adds nothing. `--state` is required:
 * a place is matched against its own state's districts and talukas.
 */
async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }
  const stateArg = process.argv.find((a) => a.startsWith("--state="));
  if (stateArg === undefined) {
    process.stderr.write("--state=<LGD code> is required, for example --state=27.\n");
    process.exit(64);
  }
  const stateLgdCode = stateArg.slice("--state=".length);

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    await db.query("BEGIN");
    let r;
    try {
      r = await loadPlaceMentions(db, { stateLgdCode });
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
    process.stdout.write(
      `mentions added: ${String(r.mentionsAdded)} · removed: ${String(r.mentionsRemoved)}\n`,
    );
    if (r.unresolved.length > 0) {
      process.stdout.write(
        `confirmed names that match no district or taluka of the state (not loaded): ${[...new Set(r.unresolved)].join(", ")}\n` +
          `A corrected value must end in "district" or "taluka", as "Gadchiroli district".\n`,
      );
    }
  } finally {
    await db.end();
  }
}

void main();
