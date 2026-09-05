import pg from "pg";
import { afterEach, describe, expect, it } from "vitest";

import { GEPNIC_SWEEP_LOCK, sweepLockHolder, takeSweepLock } from "../src/advisory-lock";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * One sweep at a time, asserted against a real PostgreSQL.
 *
 * Mocking this would prove nothing: the guarantee is the server's, not the
 * client's. What is under test is that two *connections* cannot both hold the
 * key, and that the server lets go when a connection dies — which is the whole
 * reason an advisory lock was chosen over a row in a table that a killed process
 * would leave set.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "the sweep lock (integration)",
  { timeout: 30_000 },
  () => {
    const opened: pg.Client[] = [];

    const connect = async (): Promise<pg.Client> => {
      const client = new pg.Client({ connectionString: DATABASE_URL });
      await client.connect();
      opened.push(client);
      return client;
    };

    afterEach(async () => {
      // Ending each connection releases anything it still holds, so one test
      // cannot leave the key taken for the next.
      while (opened.length > 0) await opened.pop()?.end();
    });

    it("is taken by the first sweep to ask", async () => {
      const held = await takeSweepLock(await connect());
      expect(held).not.toBeNull();
    });

    it("is refused to a second sweep while the first holds it", async () => {
      const first = await takeSweepLock(await connect());
      expect(first).not.toBeNull();

      // A separate connection is the point: two processes, one database.
      const second = await takeSweepLock(await connect());
      expect(second).toBeNull();
    });

    it("never waits for the holder", async () => {
      await takeSweepLock(await connect());
      const started = Date.now();
      await takeSweepLock(await connect());
      // Queueing would start the second sweep the moment the first finished,
      // repeating a day's polite requests against twenty portals for nothing.
      expect(Date.now() - started).toBeLessThan(1_000);
    });

    it("is free again once the holder releases it", async () => {
      const held = await takeSweepLock(await connect());
      await held?.release();

      const next = await takeSweepLock(await connect());
      expect(next).not.toBeNull();
    });

    // A sweep that throws still ends its connection in `finally`, and that is
    // what releases the lock — the explicit release is a convenience.
    it("is free again after a sweep that failed", async () => {
      const client = await connect();
      const held = await takeSweepLock(client);
      expect(held).not.toBeNull();
      try {
        throw new Error("the sweep fell over");
      } catch {
        await held?.release();
      }
      expect(await takeSweepLock(await connect())).not.toBeNull();
    });

    /**
     * The property that removes stale-lock cleanup entirely: a process that dies
     * without releasing anything still frees the key, because the server drops
     * it with the connection.
     */
    it("is released by the server when the holder's session ends", async () => {
      const abandoned = new pg.Client({ connectionString: DATABASE_URL });
      await abandoned.connect();
      expect(await takeSweepLock(abandoned)).not.toBeNull();

      // No release call. This is a process being killed mid-sweep.
      await abandoned.end();

      expect(await takeSweepLock(await connect())).not.toBeNull();
    });

    it("names the backend holding it, so contention can be diagnosed", async () => {
      const holder = await connect();
      await takeSweepLock(holder);

      const pid = await sweepLockHolder(await connect());
      // "Something else is running" is not a diagnosis; a pid can be found in
      // pg_stat_activity.
      expect(pid).toBeTypeOf("number");
    });

    it("reports no holder when the lock is free", async () => {
      expect(await sweepLockHolder(await connect())).toBeNull();
    });

    it("uses the documented key", () => {
      // The number is recorded in the operations documentation so a second
      // collector is given a different one deliberately rather than by luck.
      expect(GEPNIC_SWEEP_LOCK).toBe(437_642);
    });
  },
);
