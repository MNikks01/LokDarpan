import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { putArtifact } from "../raw-store";
import { openDatasetVersion, recordArtifact, sealDatasetVersion } from "../lgd/load";
import { BeamsClient } from "./client";
import { loadBeamsRows } from "./load";
import { parseBeamsExport } from "./parse";

const RAW_ROOT =
  process.env["RAW_STORE_ROOT"] ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/raw");

/** BEAMS labels FY 2024-25 as 2024. Both bounds verified reachable. */
const FIRST_YEAR = 2017;
const LAST_YEAR = 2026;

/** Between requests to one government host. Collection is scheduled, never user-triggered. */
const POLITE_DELAY_MS = 1_500;

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }

  const department = process.argv[2] ?? "H";
  const years = process.argv[3] !== undefined ? [Number(process.argv[3])] : range();

  const client = new BeamsClient();
  await client.openSession();

  const db = new pg.Client({ connectionString });
  await db.connect();

  try {
    const stateId = await maharashtraId(db);
    let totalFacts = 0;

    for (const year of years) {
      const page = await client.fetchDepartmentYear(department, year);

      // Bytes are stored before anything is parsed: if extraction is wrong, the
      // fix must be re-derivable from what was actually retrieved.
      const artifact = await putArtifact(RAW_ROOT, page.body, {
        sourceId: "beams",
        sourceUrl: page.url,
        retrievedAt: new Date(),
        httpStatus: page.status,
        contentType: page.contentType,
      });

      const parsed = parseBeamsExport(page.body.toString("utf8"));
      if (parsed.fiscalYear !== year) {
        throw new Error(
          `Requested FY ${String(year)} but the export declares ${String(parsed.fiscalYear)}.`,
        );
      }

      await recordArtifact(db, artifact);
      const datasetVersionId = await openDatasetVersion(
        db,
        `BEAMS ${department} FY${String(year)} · ${artifact.sha256}`,
      );
      const result = await loadBeamsRows(db, parsed.rows, {
        artifact,
        datasetVersionId,
        adminUnitId: stateId,
        fiscalYear: year,
      });
      await sealDatasetVersion(db, datasetVersionId);

      totalFacts += result.facts;
      process.stdout.write(
        `FY${String(year)}  rows=${String(parsed.rows.length)}  ` +
          `schemes=${String(result.schemes)}  facts=${String(result.facts)}\n`,
      );
      await sleep(POLITE_DELAY_MS);
    }
    process.stdout.write(
      `done: ${String(totalFacts)} facts across ${String(years.length)} year(s)\n`,
    );
  } finally {
    await db.end();
  }
}

function range(): number[] {
  const years: number[] = [];
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y += 1) years.push(y);
  return years;
}

async function maharashtraId(db: pg.Client): Promise<number> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM admin_unit WHERE level = 'state' AND lgd_code = '27'`,
  );
  const row = r.rows[0];
  if (row === undefined) {
    throw new Error("Maharashtra (LGD 27) is not in admin_unit — run the LGD ingest first.");
  }
  return Number(row.id);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
