import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { refillDetailFields } from "../src/gepnic/refill-details";
import type { ReadableRawStore } from "../src/raw-store";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const LANDING = "a7".repeat(32);
const DETAIL = "a8".repeat(32);
const PORTAL = "refilltest";

const PAGE = `<table>
  <tr><td>Work Description</td><td>Resurfacing, km 2/400 to 6/900</td><td>Tender Fee in ₹</td><td>2,950</td></tr>
  <tr><td>Pre Bid Meeting Date</td><td>NA</td><td>Period Of Work(Days)</td><td>120</td></tr>
</table>`;

/** A store holding one page, or failing every read, as a store whose bytes changed would. */
const storeWith = (page: string | null): ReadableRawStore => ({
  location: "test",
  put: () => Promise.resolve(),
  get: () =>
    page === null ? Promise.reject(new Error("hash mismatch")) : Promise.resolve(Buffer.from(page)),
});

/** Filling detail_fields from pages already kept (0048, ADR-079). */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "refillDetailFields (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let tenderId = 0;

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

    beforeEach(async () => {
      await db().query("BEGIN");
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
         VALUES ($1,'gepnic-refilltest','https://example.invalid/l', now(), 10, 'g/l', 'file'),
                ($2,'gepnic-refilltest','https://example.invalid/d', now(), 10, 'g/d', 'file')
         ON CONFLICT (sha256) DO NOTHING`,
        [LANDING, DETAIL],
      );
      const version = (
        await db().query<{ id: string }>(
          `INSERT INTO dataset_version (description) VALUES ('refill test') RETURNING id`,
        )
      ).rows[0]?.id;
      tenderId = Number(
        (
          await db().query<{ id: string }>(
            `INSERT INTO tender (portal_code, portal_tender_id, tender_reference, title, first_seen_at, last_seen_at,
                                 source_sha256, dataset_version_id, extraction_confidence, detail_sha256)
             VALUES ($1, 'T1', 'R/1', 'A road', now(), now(), $2, $3, 0.95, $4) RETURNING id`,
            [PORTAL, LANDING, version, DETAIL],
          )
        ).rows[0]?.id,
      );
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const fields = async (): Promise<unknown> =>
      (
        await db().query<{ detail_fields: unknown }>(
          `SELECT detail_fields FROM tender WHERE id = $1`,
          [tenderId],
        )
      ).rows[0]?.detail_fields;

    it("fills a tender's fields from its kept page, dropping NA, and leaves them alone after", async () => {
      expect(await refillDetailFields(db(), storeWith(PAGE))).toEqual({
        read: 1,
        filled: 1,
        failed: 0,
      });
      expect(await fields()).toEqual({
        "Work Description": "Resurfacing, km 2/400 to 6/900",
        "Tender Fee in ₹": "2,950",
        "Period Of Work(Days)": "120",
      });
      expect(await refillDetailFields(db(), storeWith("<table></table>"))).toEqual({
        read: 0,
        filled: 0,
        failed: 0,
      });
    });

    it("counts a page the store cannot give back, and writes nothing for it", async () => {
      expect(await refillDetailFields(db(), storeWith(null))).toEqual({
        read: 1,
        filled: 0,
        failed: 1,
      });
      expect(await fields()).toBeNull();
    });
  },
);
