import type pg from "pg";

import type { Queryable } from "./published-fact.repository";

/**
 * Reading the ledger as one consistent state, and saying which state it was.
 *
 * WHY THIS EXISTS
 * Explorer responses carried `datasetVersion: 0` and an `asOf` that was the time
 * of the response. Neither described the data. A reader, a cache or a shared
 * link had no way to tell which vintage of the ledger a page was built from.
 *
 * WHAT A VERSION MEANS HERE
 * A load opens one `dataset_version` row: one OSM district, one GePNIC portal,
 * one LGD run. A payload that spans many units or portals is therefore built
 * from many loads, and no single row describes it. What does describe it is the
 * newest version committed when it was read: the ledger's watermark. Every load
 * advances it, so it is a correct cache key, and it answers "what had the ledger
 * received when this was read?"
 * `.docs/adr/053-every-explorer-payload-states-its-dataset-version.md`.
 *
 * WHY ONE SNAPSHOT
 * The watermark and the data must be read from the same state, or a load that
 * commits between the two queries produces a response whose version does not
 * describe its rows. REPEATABLE READ gives every query in the transaction the
 * snapshot taken by the first one, so the watermark is read first. READ ONLY
 * makes a mistaken write fail rather than slip through a read path.
 */

export interface LedgerState {
  /** Newest committed `dataset_version.id`. `0` only for a ledger no load has written to. */
  readonly datasetVersion: number;
  /** When that version was opened. `null` only alongside version `0`. */
  readonly asOf: string | null;
}

export interface LedgerRead<T> {
  readonly value: T;
  readonly ledger: LedgerState;
}

/** A pool, or anything that lends out a client the same way. */
export interface ClientSource {
  connect(): Promise<pg.PoolClient>;
}

/**
 * The text alias is deliberately not named `id`. `ORDER BY` resolves an output
 * alias before a column, so `id::text AS id … ORDER BY id` sorts as text and
 * ranks version 84 above version 106 — found by the integration test, not by
 * reading.
 */
const WATERMARK = `SELECT id::text AS version, created_at FROM dataset_version ORDER BY id DESC LIMIT 1`;

async function watermark(db: Queryable): Promise<LedgerState> {
  const result = await db.query<{ version: string; created_at: Date }>(WATERMARK);
  const row = result.rows[0];
  if (row === undefined) return { datasetVersion: 0, asOf: null };
  return { datasetVersion: Number(row.version), asOf: row.created_at.toISOString() };
}

/**
 * One client, one query at a time.
 *
 * Handlers read in parallel (`Promise.all`), and a snapshot lives on a single
 * client. `pg` 8 queues overlapping queries itself but deprecates doing so, and
 * `pg` 9 removes it, so the queue is made explicit here rather than left to
 * break on an upgrade. A failed query does not stall the ones behind it: each
 * still runs and its caller receives its own outcome — which, after a failure,
 * is Postgres refusing it, since a failed statement aborts the transaction.
 */
function oneAtATime(client: pg.PoolClient): Queryable {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    // R is the caller's row shape, as in `Queryable` itself; pg types rows loosely.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    query<R>(sql: string, values?: readonly unknown[]): Promise<{ rows: R[] }> {
      const run = tail.then(
        () =>
          client.query(sql, values === undefined ? undefined : [...values]) as unknown as Promise<{
            rows: R[];
          }>,
      );
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

/**
 * Run `read` against one read-only snapshot and return the state it saw.
 *
 * `read` may issue queries concurrently; they run one after another on the
 * snapshot's client, so every one of them sees the same state.
 */
export async function readLedger<T>(
  source: ClientSource,
  read: (db: Queryable) => Promise<T>,
): Promise<LedgerRead<T>> {
  const client = await source.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    // First statement: it fixes the snapshot every later query sees.
    const ledger = await watermark(client);
    const value = await read(oneAtATime(client));
    await client.query("COMMIT");
    return { value, ledger };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * When a known version was opened.
 *
 * For responses whose version comes from the rows themselves, as the unit views'
 * single-version rule produces, rather than from a snapshot's watermark.
 */
export async function versionOpenedAt(
  db: Queryable,
  datasetVersion: number,
): Promise<string | null> {
  const result = await db.query<{ created_at: Date }>(
    `SELECT created_at FROM dataset_version WHERE id = $1`,
    [datasetVersion],
  );
  return result.rows[0]?.created_at.toISOString() ?? null;
}
