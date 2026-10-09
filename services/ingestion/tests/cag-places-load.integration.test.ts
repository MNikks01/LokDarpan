import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { gazetteerForDocument, loadPlaceMentions } from "../src/cag/places-load";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const CAG = "e1".repeat(32);
const RESTRICTED = "e2".repeat(32);
/** A state of our own, so the test never touches a real place. */
const STATE_LGD = "T-077";

/** What decides a pin: a reviewed fact, a republishable source, a place the state holds (ADR-077). */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "loadPlaceMentions (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let version = 0;
    let state = 0;
    let district = 0;
    let taluka = 0;
    let report = 0;
    let notice = 0;

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

    const one = async (sql: string, params: readonly unknown[]): Promise<number> =>
      Number((await db().query<{ id: string }>(sql, [...params])).rows[0]?.id);

    const unit = (
      level: string,
      name: string,
      code: string,
      parent: number | null,
    ): Promise<number> =>
      one(
        `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ($1, $2, $3, $4, $5, $6, 1, '2000-01-01') RETURNING id`,
        [code, level, name, parent, CAG, version],
      );

    const doc = (sha: string, title: string): Promise<number> =>
      one(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title, issuing_authority,
                               mime_type, page_count, pages_without_text, extraction_method,
                               admin_unit_id, geography_source)
         VALUES ($1,$2,'audit_report',$3,'CAG','application/pdf',10,0,'test',$4,'publisher_filter')
         RETURNING id`,
        [sha, version, title, state],
      );

    beforeEach(async () => {
      await db().query("BEGIN");
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
         VALUES ($1,'cag','https://cag.gov.in/p.pdf', now(), 10, 'cag/p', 'file'),
                ($2,'mahatenders','https://example.invalid/n.pdf', now(), 10, 'mt/n', 'file')
         ON CONFLICT (sha256) DO NOTHING`,
        [CAG, RESTRICTED],
      );
      version = await one(
        `INSERT INTO dataset_version (description) VALUES ('places test') RETURNING id`,
        [],
      );
      state = await unit("state", "Testland", STATE_LGD, null);
      district = await unit("district", "Testpur District", `${STATE_LGD}-1`, state);
      taluka = await unit("sub_district", "Sindewahi", `${STATE_LGD}-1-1`, district);
      report = await doc(CAG, "Testland Report");
      notice = await doc(RESTRICTED, "A notice");
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const fact = async (
      value: string,
      status: "unverified" | "verified" | "rejected" | "corrected",
      corrected: string | null = null,
      document = report,
    ): Promise<number> => {
      const decided = status !== "unverified";
      return one(
        `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                    extraction_method, parser_version, extraction_confidence,
                                    verification_status, verified_by, verified_at, corrected_value)
         VALUES ($1, 3, 'place_reference', $2, $2, 'test', 'cag-facts/25', 0.8, $3, $4, $5, $6)
         RETURNING id`,
        [
          document,
          value,
          status,
          decided ? "reviewer@test" : null,
          decided ? new Date() : null,
          corrected,
        ],
      );
    };

    const mentions = async (): Promise<string[]> =>
      (
        await db().query<{ name: string }>(
          `SELECT u.name_en AS name FROM place_mention m JOIN admin_unit u ON u.id = m.admin_unit_id
             JOIN document_fact f ON f.id = m.document_fact_id JOIN document d ON d.id = f.document_id
            WHERE d.admin_unit_id = $1 ORDER BY u.name_en`,
          [state],
        )
      ).rows.map((r) => r.name);

    it("reads a document's gazetteer from the state it is filed under", async () => {
      expect(await gazetteerForDocument(db(), report)).toEqual(
        expect.arrayContaining([
          { name: "Testpur District", level: "district" },
          { name: "Sindewahi", level: "sub_district" },
        ]),
      );
      expect(await gazetteerForDocument(db(), 2_000_000_000)).toEqual([]);
    });

    it("pins a place only for a decided fact, reading a correction, and skipping restricted sources", async () => {
      await fact("Testpur district", "verified");
      await fact("Sindewahi taluka", "unverified");
      await fact("Testpur district", "rejected");
      await fact("Testpur", "corrected", "Sindewahi taluka");
      await fact("Testpur district", "verified", null, notice);

      const r = await loadPlaceMentions(db(), { stateLgdCode: STATE_LGD });
      expect(r).toEqual({ mentionsAdded: 2, mentionsRemoved: 0, unresolved: [] });
      expect(await mentions()).toEqual(["Sindewahi", "Testpur District"]);
      expect(taluka).toBeGreaterThan(0);
    });

    it("reports a confirmed name the state does not hold, and pins nothing for it", async () => {
      await fact("Elsewhere district", "verified");
      await fact("Testpur", "verified");
      const r = await loadPlaceMentions(db(), { stateLgdCode: STATE_LGD });
      expect(r.unresolved).toEqual(["Elsewhere district", "Testpur"]);
      expect(await mentions()).toEqual([]);
    });

    it("is idempotent, and withdraws a mention once its fact is rejected", async () => {
      const id = await fact("Testpur district", "verified");
      await loadPlaceMentions(db(), { stateLgdCode: STATE_LGD });
      expect((await loadPlaceMentions(db(), { stateLgdCode: STATE_LGD })).mentionsAdded).toBe(0);

      await db().query(`UPDATE document_fact SET verification_status = 'rejected' WHERE id = $1`, [
        id,
      ]);
      const r = await loadPlaceMentions(db(), { stateLgdCode: STATE_LGD });
      expect(r.mentionsRemoved).toBe(1);
      expect(await mentions()).toEqual([]);
    });

    it("does nothing for a state it does not hold", async () => {
      expect(await loadPlaceMentions(db(), { stateLgdCode: "T-none" })).toEqual({
        mentionsAdded: 0,
        mentionsRemoved: 0,
        unresolved: [],
      });
    });
  },
);
