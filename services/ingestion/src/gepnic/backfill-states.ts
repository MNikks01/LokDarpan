import pg from "pg";

import { PORTALS } from "./portals";

/**
 * Attaches each collection window to the state its portal publishes for.
 *
 * Migration 0023 added `state_lgd_code` and deliberately left it null: the
 * portal's own code is not evidence of which state it serves, and a migration
 * that read `madhyaprades` as Madhya Pradesh would be inferring exactly what
 * this project does not infer.
 *
 * `PORTALS` is not that inference. It is generated from the source registry,
 * where each base URL was discovered from an official directory and fetched
 * with its status recorded, and each is paired there with the state it belongs
 * to. Writing from it is copying a recorded fact, not guessing from a string.
 *
 * Without this every state reads `not_collected` until its portal is next
 * collected — which would tell a reader that Kerala is uncollected while
 * Kerala's tenders are on the screen. One false statement replaced by another
 * is not progress.
 *
 * Safe to re-run: it writes the same value each time and touches nothing else.
 */
async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    let attached = 0;
    let absent = 0;
    for (const portal of PORTALS) {
      const result = await db.query(
        `UPDATE tender_collection_window SET state_lgd_code = $2
          WHERE portal_code = $1 AND state_lgd_code IS DISTINCT FROM $2`,
        [portal.code, portal.stateLgdCode],
      );
      if (result.rowCount === 0) absent += 1;
      else attached += result.rowCount ?? 0;
    }

    process.stdout.write(
      `${String(attached)} collection window(s) attached to a state; ` +
        `${String(absent)} portal(s) had nothing to update.\n`,
    );

    // Named rather than counted: a window with no state cannot answer whether
    // its state is collected, so it is the one an operator has to look at.
    const orphaned = await db.query<{ portal_code: string }>(
      `SELECT portal_code FROM tender_collection_window WHERE state_lgd_code IS NULL
        ORDER BY portal_code`,
    );
    if (orphaned.rowCount !== null && orphaned.rowCount > 0) {
      process.stdout.write(
        `${String(orphaned.rowCount)} window(s) still name no state and cannot report a ` +
          `collection status: ${orphaned.rows.map((r) => r.portal_code).join(", ")}\n`,
      );
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
