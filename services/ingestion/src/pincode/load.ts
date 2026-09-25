import type pg from "pg";

import type { DirectoryEntry } from "./parse";

export interface DirectoryLoad {
  readonly entries: readonly DirectoryEntry[];
  readonly sourceSha256: string;
  readonly datasetVersionId: number;
}

/** Rows per statement: well under Postgres' parameter limit, few round trips. */
const BATCH = 5_000;

/**
 * Replaces the directory with a new load, in one transaction.
 *
 * Replaced, not merged: the resolver reads only the newest load, and a merge
 * would keep offices the Department of Posts has since closed or moved. Rows
 * from the previous load are deleted inside the same transaction that inserts
 * the new ones, so a reader never sees a directory that is half of each.
 * The artefacts stay; every tender placed from the old load still names it.
 */
export async function replaceDirectory(db: pg.ClientBase, load: DirectoryLoad): Promise<number> {
  await db.query("BEGIN");
  try {
    await db.query(`DELETE FROM pincode_office`);
    let inserted = 0;
    for (let start = 0; start < load.entries.length; start += BATCH) {
      const batch = load.entries.slice(start, start + BATCH);
      const result = await db.query(
        `INSERT INTO pincode_office
           (pincode, office_name, office_type, district_name, state_name,
            source_sha256, dataset_version_id)
         SELECT p, o, t, d, s, $6, $7
           FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])
                AS x(p, o, t, d, s)
         ON CONFLICT ON CONSTRAINT pincode_office_identity DO NOTHING`,
        [
          batch.map((e) => e.pincode),
          batch.map((e) => e.officeName),
          batch.map((e) => e.officeType),
          batch.map((e) => e.districtName),
          batch.map((e) => e.stateName),
          load.sourceSha256,
          load.datasetVersionId,
        ],
      );
      inserted += result.rowCount ?? 0;
    }
    await db.query("COMMIT");
    return inserted;
  } catch (error: unknown) {
    await db.query("ROLLBACK");
    throw error;
  }
}
