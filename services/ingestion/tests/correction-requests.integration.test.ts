import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { decideRequest, openRequests } from "../src/review/correction-requests";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;

/** The reviewer's side of ADR-075, run as the reviewer role and rolled back. */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "correction requests (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };

    beforeAll(async () => {
      const c = new pg.Client({ connectionString: DATABASE_URL });
      await c.connect();
      await ensureMigrationTable(c);
      for (const m of pendingMigrations(
        await loadMigrations(MIGRATIONS_DIR),
        await readApplied(c),
      )) {
        await applyMigration(c, m);
      }
      client = c;
    }, 60_000);

    afterAll(async () => {
      await client?.end();
    });

    const withReport = async (body: (ref: string) => Promise<void>): Promise<void> => {
      await db().query("BEGIN");
      try {
        const r = await db().query<{ ref: string }>(
          `SELECT submit_correction('fact:42', 'amount_wrong',
                  'Page 3 prints 7.2 crore; the site shows 72 crore.', NULL) AS ref`,
        );
        await db().query("SET LOCAL ROLE lokdarpan_reviewer");
        await body(r.rows[0]?.ref ?? "");
      } finally {
        await db().query("ROLLBACK");
      }
    };

    it("lists an open report with what the reader wrote", async () => {
      await withReport(async (ref) => {
        const open = await openRequests(db());
        expect(open.find((r) => r.reference === ref)).toMatchObject({
          subject: "fact:42",
          category: "amount_wrong",
          status: "received",
          evidenceUrl: null,
        });
      });
    });

    it("records a final decision with its reviewer and note, and closes the report", async () => {
      await withReport(async (ref) => {
        expect(
          await decideRequest(db(), {
            reference: ref,
            status: "reviewing",
            reviewer: "r@test",
            note: null,
          }),
        ).toBe(true);
        expect(
          await decideRequest(db(), {
            reference: ref,
            status: "corrected",
            reviewer: "r@test",
            note: "Re-read page 3; the figure was corrected in review.",
          }),
        ).toBe(true);
        expect((await openRequests(db())).some((r) => r.reference === ref)).toBe(false);
      });
    });

    it("refuses a final decision without a note or a reviewer, and says when a reference is unknown", async () => {
      await withReport(async (ref) => {
        await expect(
          decideRequest(db(), {
            reference: ref,
            status: "no_change",
            reviewer: "r@test",
            note: " ",
          }),
        ).rejects.toThrow(/states what the source/u);
        await expect(
          decideRequest(db(), { reference: ref, status: "reviewing", reviewer: "", note: null }),
        ).rejects.toThrow(/names its reviewer/u);
        expect(
          await decideRequest(db(), {
            reference: "LD-NOSUCHREF",
            status: "reviewing",
            reviewer: "r@test",
            note: null,
          }),
        ).toBe(false);
      });
    });
  },
);
