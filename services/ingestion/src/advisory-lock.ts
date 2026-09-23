import type pg from "pg";

/**
 * One ingestion sweep at a time, enforced by the database.
 *
 * WHY POSTGRES AND NOT A FILE
 * The lock has to hold across whatever runs the collector — a GitHub runner
 * today, a host tomorrow, a developer's laptop at any time — and those share no
 * filesystem. They share exactly one thing: the database they are writing to.
 * A file lock would protect a runner from itself and nothing else.
 *
 * WHY SESSION-SCOPED
 * `pg_try_advisory_lock` is held by the connection, so the server releases it
 * when the connection goes away — on a clean exit, on a crash, on a runner being
 * cancelled mid-sweep. There is no stale lock to clean up and no timeout to
 * tune, which is the whole reason to prefer it over a row in a table that a
 * killed process would leave behind set.
 *
 * It must therefore be taken on the **same client** that runs the sweep. Taken
 * on a pooled connection it would be released the moment that connection
 * returned to the pool, which looks like it works and protects nothing.
 */

/**
 * The key for the GEP-NIC sweep.
 *
 * Arbitrary and fixed. Advisory locks share one namespace across the database,
 * so the only requirement is that nothing else picks the same number; the value
 * is recorded in `.docs/16-operations/collection-schedule.md` so a second
 * collector can be given a different one deliberately rather than by luck.
 *
 * Derived once from the digits of "gepnic" on a phone keypad (4-3-7-6-4-2) and
 * then left alone. A literal is used rather than `hashtext()` so the key can be
 * read out of the source and matched against `pg_locks` without running SQL.
 */
export const GEPNIC_SWEEP_LOCK = 437_642;

export interface Held {
  /** Releases the lock. The session ending would do it anyway. */
  readonly release: () => Promise<void>;
}

/**
 * Takes the sweep lock, or returns null when another sweep holds it.
 *
 * Never waits. A collector that queued behind a running sweep would start the
 * moment the first finished, which is the opposite of what a daily schedule
 * wants: the work is already done, and the second run would repeat a day's
 * polite requests against twenty government portals for nothing.
 */
export async function takeSweepLock(db: pg.ClientBase): Promise<Held | null> {
  const result = await db.query<{ taken: boolean }>(`SELECT pg_try_advisory_lock($1) AS taken`, [
    GEPNIC_SWEEP_LOCK,
  ]);
  if (result.rows[0]?.taken !== true) return null;

  return {
    release: async () => {
      // Explicit so a long-lived process does not hold it, and so the release
      // is visible in a query log. Correctness does not depend on it.
      await db.query(`SELECT pg_advisory_unlock($1)`, [GEPNIC_SWEEP_LOCK]);
    },
  };
}

/**
 * Who holds the sweep lock right now, for diagnosing contention.
 *
 * Returns the backend process id, which is what an operator needs to find the
 * other session in `pg_stat_activity` — "something else is running" is not a
 * diagnosis.
 */
export async function sweepLockHolder(db: pg.ClientBase): Promise<number | null> {
  const result = await db.query<{ pid: number }>(
    `SELECT pid FROM pg_locks
      WHERE locktype = 'advisory' AND objid = $1 AND granted
      LIMIT 1`,
    [GEPNIC_SWEEP_LOCK],
  );
  return result.rows[0]?.pid ?? null;
}
