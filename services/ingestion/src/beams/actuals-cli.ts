import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { openDatasetVersion, recordArtifact, sealDatasetVersion } from "../lgd/load";
import { putArtifact } from "../raw-store";
import { loadDepartmentActuals } from "./actuals-load";
import { parseDepartmentActuals } from "./actuals-parse";
import { BeamsClient } from "./client";

const RAW_ROOT =
  process.env["RAW_STORE_ROOT"] ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/raw");

const FIRST_YEAR = 2019;
const LAST_YEAR = 2026;

/**
 * Between requests. This host returns an empty body when it is unhappy with the
 * request rate, and an empty body is indistinguishable from no data — so the
 * pace is deliberately slower than the scheme-wise ingest.
 */
const POLITE_DELAY_MS = 4_000;

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

  const years =
    process.argv[2] !== undefined
      ? [Number(process.argv[2])]
      : Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

  const db = new pg.Client({ connectionString });
  await db.connect();

  try {
    const state = await db.query<{ id: string }>(
      `SELECT id FROM admin_unit WHERE level = 'state' AND lgd_code = '27'`,
    );
    const adminUnitId = Number(state.rows[0]?.id);
    if (Number.isNaN(adminUnitId)) {
      throw new Error("Maharashtra (LGD 27) is not in admin_unit — run the LGD ingest first.");
    }

    for (const year of years) {
      // A fresh session per year: a reused one is what produced empty bodies
      // during discovery, and an empty body reads exactly like "no data".
      const client = new BeamsClient();
      await client.openSession();
      const page = await client.fetchDepartmentActuals(year);

      const artifact = await putArtifact(RAW_ROOT, page.body, {
        sourceId: "beams",
        sourceUrl: page.url,
        retrievedAt: new Date(),
        httpStatus: page.status,
        contentType: page.contentType,
      });

      const actuals = parseDepartmentActuals(page.body.toString("utf8"), year);
      await recordArtifact(db, artifact);
      const datasetVersionId = await openDatasetVersion(
        db,
        `BEAMS departmental actuals FY${String(year)} · ${artifact.sha256}`,
      );
      const result = await loadDepartmentActuals(db, actuals, {
        artifact,
        datasetVersionId,
        adminUnitId,
      });
      await sealDatasetVersion(db, datasetVersionId);

      process.stdout.write(
        `FY${String(year)}  departments=${String(result.departments)}  facts=${String(result.facts)}\n`,
      );
      await sleep(POLITE_DELAY_MS);
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
