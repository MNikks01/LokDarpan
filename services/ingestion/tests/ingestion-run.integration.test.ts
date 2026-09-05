import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { completeRun, failRun, openRun, NO_COUNTS } from "../src/ingestion-run";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * What a run says about itself, asserted against a real Postgres.
 *
 * The contract worth testing is the failure one. A run that collected nothing
 * and a run that fell over leave the ledger in the same state — no new rows — so
 * this table is the only thing that can tell them apart afterwards. If it lost
 * that distinction, "0 records" would go back to being reported as a fact about
 * a government.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "ingestion runs (integration)",
  { timeout: 30_000 },
  () => {
    let client: pg.Client | undefined;
    const SOURCE = "zz-run-test";

    beforeAll(async () => {
      client = new pg.Client({ connectionString: DATABASE_URL });
      await client.connect();
    });

    afterAll(async () => {
      await client?.query(`DELETE FROM ingestion_run WHERE source_id = $1`, [SOURCE]);
      await client?.end();
    });

    /**
     * The connected client, or a failure that names the reason.
     *
     * The helpers take a real client rather than an optional one, and asserting
     * the type away would hide a genuinely unconnected client behind a cast.
     */
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("the test client is not connected");
      return client;
    };

    const row = async (
      id: number,
    ): Promise<{
      status: string;
      completed_at: string | null;
      records_seen: number;
      records_inserted: number;
      records_updated: number;
      records_unchanged: number;
      records_rejected: number;
      records_unresolved: number;
      error_count: number;
      note: string | null;
    }> => {
      const result = await client?.query(`SELECT * FROM ingestion_run WHERE id = $1`, [id]);
      return result?.rows[0] as never;
    };

    it("opens a run that is running and has not finished", async () => {
      const id = await openRun(db(), SOURCE);
      const opened = await row(id);
      expect(opened.status).toBe("running");
      // The constraint pairs these two, so a run left open is itself the signal
      // that a collector died rather than a row that merely looks odd.
      expect(opened.completed_at).toBeNull();
    });

    it("records every count separately when a run succeeds", async () => {
      const id = await openRun(db(), SOURCE);
      await completeRun(db(), id, {
        seen: 20,
        inserted: 3,
        updated: 2,
        unchanged: 14,
        rejected: 1,
        unresolved: 6,
        errors: 1,
      });

      const done = await row(id);
      expect(done.status).toBe("succeeded");
      expect(done.completed_at).not.toBeNull();
      expect(done.records_seen).toBe(20);
      expect(done.records_inserted).toBe(3);
      expect(done.records_updated).toBe(2);
      // The count most easily omitted and the most useful: a run where
      // everything was seen and nothing had changed is a healthy run.
      expect(done.records_unchanged).toBe(14);
      expect(done.records_rejected).toBe(1);
      expect(done.records_unresolved).toBe(6);
      expect(done.note).toBeNull();
    });

    it("keeps what a failed run managed to count", async () => {
      const id = await openRun(db(), SOURCE);
      await failRun(db(), id, "connection reset", {
        ...NO_COUNTS,
        seen: 400,
        inserted: 12,
      });

      const failed = await row(id);
      expect(failed.status).toBe("failed");
      expect(failed.completed_at).not.toBeNull();
      // Not zeroed. A run that read four hundred records before losing its
      // connection saw four hundred, and reporting none would state the failure
      // as an absence — the conflation this table exists to prevent.
      expect(failed.records_seen).toBe(400);
      expect(failed.records_inserted).toBe(12);
      expect(failed.note).toBe("connection reset");
    });

    it("never reports a failure with no errors against it", async () => {
      const id = await openRun(db(), SOURCE);
      // The collector counted no per-record rejections; the run still failed.
      await failRun(db(), id, "portal refused the session");

      const failed = await row(id);
      expect(failed.status).toBe("failed");
      expect(failed.error_count).toBeGreaterThanOrEqual(1);
    });

    it("gives each execution its own identifier", async () => {
      const first = await openRun(db(), SOURCE);
      const second = await openRun(db(), SOURCE);
      expect(second).not.toBe(first);
    });
  },
);
