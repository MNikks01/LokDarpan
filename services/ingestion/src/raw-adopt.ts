import type pg from "pg";

import type { ReadableRawStore } from "./raw-store";

/**
 * Artefacts loaded before the raw store recorded where their bytes were kept,
 * given that record once the bytes are found and verified.
 *
 * Rows written before 29 September 2026 have `stored_in` NULL: the ledger did
 * not then say where their bytes were, and ADR-069 records them as not
 * retained. Some were retained after all — every CAG report is still in the
 * local store, at the path its row names. `.docs/16-operations/raw-store.md`
 * allows a `stored_in` only once the bytes are in a store and hash to the
 * row's sha256, and forbids setting one by hand. This is that check.
 *
 * Each row is read back through the store's own `get`, which refuses bytes
 * that do not hash to their content address. Only a row whose bytes pass is
 * updated, and only from NULL: a row that already says where its bytes are is
 * never re-pointed, and one whose bytes are missing or different is reported
 * and left as it was.
 */

export interface AdoptCounts {
  /** Rows given a `stored_in`, their bytes verified in this store. */
  adopted: number;
  /** Rows whose bytes are not in this store at their path. */
  missing: number;
  /** Rows whose path holds bytes that do not verify. */
  mismatched: number;
}

/** A store's way of saying the object is not there: a missing file, or a 404 from a bucket. */
function isAbsent(error: unknown): boolean {
  if ((error as { code?: string }).code === "ENOENT") return true;
  return error instanceof Error && /returned 404\b/u.test(error.message);
}

export async function adoptRetainedArtifacts(
  db: pg.ClientBase,
  store: ReadableRawStore,
  sourceId: string,
  log: (line: string) => void = (): void => undefined,
): Promise<AdoptCounts> {
  const rows = await db.query<{ sha256: string; storage_path: string }>(
    `SELECT sha256, storage_path FROM source_artifact
      WHERE source_id = $1 AND stored_in IS NULL
      ORDER BY sha256`,
    [sourceId],
  );
  const counts: AdoptCounts = { adopted: 0, missing: 0, mismatched: 0 };
  for (const row of rows.rows) {
    try {
      await store.get(row.storage_path, row.sha256);
    } catch (error: unknown) {
      const absent = isAbsent(error);
      counts[absent ? "missing" : "mismatched"] += 1;
      log(
        `${row.sha256.slice(0, 12)}: ${absent ? "not in" : "does not verify in"} ` +
          `${store.location} at ${row.storage_path}`,
      );
      continue;
    }
    const updated = await db.query(
      `UPDATE source_artifact SET stored_in = $2 WHERE sha256 = $1 AND stored_in IS NULL`,
      [row.sha256, store.location],
    );
    counts.adopted += updated.rowCount ?? 0;
  }
  return counts;
}
