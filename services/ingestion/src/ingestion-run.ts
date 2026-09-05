import type pg from "pg";

/**
 * One row per ingestion execution.
 *
 * WHY THIS IS NOT PART OF THE LOAD'S TRANSACTION
 * A collector writes its data inside a transaction so a malformed record cannot
 * leave half a run behind. If the run row were written there too, a failure
 * would roll it back — and the only trace of the failure would be gone with it.
 * The ledger must roll back; the account of what happened must not.
 *
 * So a run is opened before the transaction, closed after it, and marked failed
 * from the catch. The two are deliberately not atomic with each other.
 *
 * WHY NOT `dataset_version`
 * That table answers "which vintage is this figure from" and is stamped on
 * every row a load writes. It has no status and no end time, because a version
 * that could fail would stop being a version. This answers "what happened when
 * we ran", which a run that collected nothing and a run that failed answer
 * differently while leaving the ledger identical.
 */

export interface RunCounts {
  readonly seen: number;
  readonly inserted: number;
  /** Rows whose source-controlled fields actually changed. */
  readonly updated: number;
  /** Rows seen again with nothing about them different. A healthy outcome. */
  readonly unchanged: number;
  readonly rejected: number;
  /** Held and valid, but not attributable to a place. Never a rejection. */
  readonly unresolved: number;
  readonly errors: number;
}

export const NO_COUNTS: RunCounts = {
  seen: 0,
  inserted: 0,
  updated: 0,
  unchanged: 0,
  rejected: 0,
  unresolved: 0,
  errors: 0,
};

/** Opens a run. The id travels with everything the run writes. */
export async function openRun(db: pg.ClientBase, sourceId: string): Promise<number> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO ingestion_run (source_id) VALUES ($1) RETURNING id`,
    [sourceId],
  );
  const id = result.rows[0]?.id;
  if (id === undefined) throw new Error("could not open an ingestion run");
  return Number(id);
}

interface Closing {
  readonly runId: number;
  readonly status: "succeeded" | "failed";
  readonly counts: RunCounts;
  readonly note: string | null;
}

async function close(db: pg.ClientBase, closing: Closing): Promise<void> {
  const { runId, status, counts, note } = closing;
  await db.query(
    `UPDATE ingestion_run
        SET status = $2::ingestion_run_status, completed_at = now(),
            records_seen = $3, records_inserted = $4, records_updated = $5,
            records_unchanged = $6, records_rejected = $7, records_unresolved = $8,
            error_count = $9, note = $10
      WHERE id = $1`,
    [
      runId,
      status,
      counts.seen,
      counts.inserted,
      counts.updated,
      counts.unchanged,
      counts.rejected,
      counts.unresolved,
      counts.errors,
      note,
    ],
  );
}

export function completeRun(db: pg.ClientBase, runId: number, counts: RunCounts): Promise<void> {
  return close(db, { runId, status: "succeeded", counts, note: null });
}

/**
 * Marks a run failed, keeping whatever it managed to count.
 *
 * The counts are not zeroed. A run that read 400 records and then lost the
 * connection saw 400 records, and reporting zero would state the failure as an
 * absence — the same conflation this table exists to prevent.
 */
export function failRun(
  db: pg.ClientBase,
  runId: number,
  note: string,
  counts: RunCounts = NO_COUNTS,
): Promise<void> {
  return close(db, {
    runId,
    status: "failed",
    counts: { ...counts, errors: Math.max(1, counts.errors) },
    note,
  });
}
