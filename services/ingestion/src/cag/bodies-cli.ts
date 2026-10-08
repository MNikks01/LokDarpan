import pg from "pg";

import { loadPublicBodies } from "./bodies-load";

/**
 * Makes `public_body` agree with the reviewed mentions (ADR-074).
 *
 *   pnpm --filter @lokdarpan/ingestion ingest:bodies -- --state=27
 *
 * Run after a review session on `--kind=body_reference`. Without `--state` it
 * loads every state's confirmed mentions. It reads only decided facts, so
 * running it before anything is reviewed creates nothing.
 */
async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }
  const stateArg = process.argv.find((a) => a.startsWith("--state="));
  const stateLgdCode = stateArg === undefined ? undefined : stateArg.slice("--state=".length);

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    await db.query("BEGIN");
    let r;
    try {
      r = await loadPublicBodies(db, stateLgdCode === undefined ? {} : { stateLgdCode });
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
    process.stdout.write(
      `governments created: ${String(r.governments)}\n` +
        `departments created: ${String(r.departments)}\n` +
        `mentions added: ${String(r.mentionsAdded)} · removed: ${String(r.mentionsRemoved)}\n`,
    );
    if (r.unplaced.length > 0) {
      process.stdout.write(
        `confirmed governments with no place in the hierarchy (not loaded): ${[...new Set(r.unplaced)].join(", ")}\n`,
      );
    }
  } finally {
    await db.end();
  }
}

void main();
