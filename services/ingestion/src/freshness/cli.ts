import { writeFile } from "node:fs/promises";
import pg from "pg";

import { PostgresTenderRepository } from "@lokdarpan/database";
import { STUCK_AFTER_HOURS, assessCollection } from "./assess";

/**
 * Checks collection health and exits non-zero if anything is wrong.
 *
 *   DATABASE_URL=… pnpm --filter @lokdarpan/ingestion check:collection [--report=<path>]
 *
 * Reads only. The scheduled workflow runs it daily and opens an issue from the
 * report when it fails (`.github/workflows/check-collection.yml`).
 *
 * Exit codes: 0 healthy · 1 problems found · 78 DATABASE_URL absent.
 */

const EXIT_PROBLEMS = 1;
const EXIT_MISCONFIGURED = 78;

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(EXIT_MISCONFIGURED);
  }
  const reportPath = process.argv.find((a) => a.startsWith("--report="))?.slice("--report=".length);

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const windows = await new PostgresTenderRepository(client).collectionWindows();
    const sweep = await client.query<{ started_at: Date | null }>(
      `SELECT max(started_at) AS started_at FROM ingestion_run WHERE source_id LIKE 'gepnic-%'`,
    );
    const stuck = await client.query<{ source_id: string; started_at: Date }>(
      `SELECT source_id, started_at FROM ingestion_run
        WHERE status = 'running' AND started_at < now() - ($1 || ' hours')::interval
        ORDER BY started_at`,
      [String(STUCK_AFTER_HOURS)],
    );

    const assessment = assessCollection(
      {
        windows,
        lastSweepStartedAt: sweep.rows[0]?.started_at ?? null,
        stuck: stuck.rows.map((r) => ({ sourceId: r.source_id, startedAt: r.started_at })),
      },
      new Date(),
    );

    process.stdout.write(`${assessment.report}\n`);
    if (reportPath !== undefined) await writeFile(reportPath, `${assessment.report}\n`, "utf8");
    if (!assessment.healthy) process.exitCode = EXIT_PROBLEMS;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(EXIT_PROBLEMS);
});
