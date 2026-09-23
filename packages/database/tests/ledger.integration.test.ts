import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readLedger, versionOpenedAt } from "../src/ledger";
import type { Queryable } from "../src/published-fact.repository";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * What is asserted here is a property of PostgreSQL's snapshots, so it is
 * asserted against PostgreSQL. Other suites share this database and open
 * versions of their own while this runs, so nothing below assumes it knows the
 * newest version — only that the version a read reports is the one its rows saw.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")("ledger (integration)", () => {
  let pool: pg.Pool | undefined;
  let other: pg.Pool | undefined;
  const opened: number[] = [];

  const openVersion = async (db: Queryable): Promise<number> => {
    const result = await db.query<{ id: string }>(
      `INSERT INTO dataset_version (description) VALUES ('ledger integration test') RETURNING id`,
    );
    const id = Number(result.rows[0]?.id);
    opened.push(id);
    return id;
  };

  const newest = async (db: Queryable): Promise<number> => {
    const result = await db.query<{ id: string }>(
      `SELECT max(id)::text AS id FROM dataset_version`,
    );
    return Number(result.rows[0]?.id);
  };

  beforeAll(() => {
    // One connection each, so a client that was not released would starve the next test.
    pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
    other = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
  });

  afterAll(async () => {
    if (opened.length > 0) {
      await other?.query(`DELETE FROM dataset_version WHERE id = ANY($1::bigint[])`, [opened]);
    }
    await pool?.end();
    await other?.end();
  });

  it("reports a version at least as new as one committed before the read", async () => {
    if (pool === undefined || other === undefined) throw new Error("no pool");
    const committed = await openVersion(other);
    const { ledger } = await readLedger(pool, () => Promise.resolve(null));
    expect(ledger.datasetVersion).toBeGreaterThanOrEqual(committed);
  });

  it("dates the version by when it was opened, not by when it was read", async () => {
    if (pool === undefined) throw new Error("no pool");
    const { ledger } = await readLedger(pool, () => Promise.resolve(null));
    expect(ledger.asOf).toBe(await versionOpenedAt(pool, ledger.datasetVersion));
  });

  // The guarantee that matters: a load committing mid-request must not appear
  // in the rows while the response names the state before it.
  it("reads the rows from the same state as the version it reports", async () => {
    if (pool === undefined || other === undefined) throw new Error("no pool");
    const elsewhere = other;
    const { value, ledger } = await readLedger(pool, async (db) => {
      await openVersion(elsewhere); // commits on another connection, mid-read
      return newest(db);
    });
    expect(value).toBe(ledger.datasetVersion);
    expect(await newest(elsewhere)).toBeGreaterThan(ledger.datasetVersion);
  });

  it("refuses a write on the read path", async () => {
    if (pool === undefined) throw new Error("no pool");
    await expect(
      readLedger(pool, (db) =>
        db.query(`INSERT INTO dataset_version (description) VALUES ('must not be written')`),
      ),
    ).rejects.toThrow(/read-only transaction/);
  });

  it("releases its connection after a failed read", async () => {
    if (pool === undefined) throw new Error("no pool");
    await expect(readLedger(pool, () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    // With one connection in the pool, this would hang if the last client were held.
    const { ledger } = await readLedger(pool, () => Promise.resolve(null));
    expect(ledger.datasetVersion).toBeGreaterThan(0);
  });

  it("runs parallel reads in order, and a failure stalls nothing behind it", async () => {
    if (pool === undefined) throw new Error("no pool");
    const { value } = await readLedger(pool, (db) =>
      Promise.allSettled([
        db.query<{ n: number }>(`SELECT 1 AS n`),
        db.query(`SELECT * FROM a_table_that_does_not_exist`),
        db.query<{ n: number }>(`SELECT 3 AS n`),
      ]),
    );
    const [first, failed, after] = value;
    expect(first.status).toBe("fulfilled");
    expect(failed.status === "rejected" && String(failed.reason)).toMatch(/does not exist/);
    // The queue moves on; Postgres then refuses the statement, because a failed
    // statement aborts the transaction. What must not happen is a hang.
    expect(after.status === "rejected" && String(after.reason)).toMatch(/transaction is aborted/);
  });

  it("has no date for a version that does not exist", async () => {
    if (pool === undefined) throw new Error("no pool");
    expect(await versionOpenedAt(pool, Number.MAX_SAFE_INTEGER)).toBeNull();
  });
});
