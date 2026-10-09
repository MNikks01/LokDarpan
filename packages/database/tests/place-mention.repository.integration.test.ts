import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "../src/migrator";
import { PostgresPlaceMentionRepository } from "../src/place-mention.repository";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const CAG = "f1".repeat(32);
const RESTRICTED = "f2".repeat(32);
const STATE_CODE = "9977001";
const SQUARE = "MULTIPOLYGON(((80 19, 81 19, 81 20, 80 20, 80 19)))";

/** What a pin and a place's page show: reviewed, republishable, not from a scan (ADR-077). */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "PostgresPlaceMentionRepository (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let version = 0;
    let state = 0;
    let district = 0;
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

    beforeEach(async () => {
      await db().query("BEGIN");
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
         VALUES ($1,'cag','https://cag.gov.in/m.pdf','2026-10-06T00:00:00Z',10,'cag/m','file'),
                ($2,'mahatenders','https://example.invalid/n.pdf','2026-10-06T00:00:00Z',10,'mt/n','file')
         ON CONFLICT (sha256) DO NOTHING`,
        [CAG, RESTRICTED],
      );
      version = await one(
        `INSERT INTO dataset_version (description) VALUES ('mentions test') RETURNING id`,
        [],
      );
      const unit = (level: string, name: string, code: string, parent: number | null) =>
        one(
          `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, source_sha256, dataset_version_id,
                                   extraction_confidence, valid_from)
           VALUES ($1,$2,$3,$4,$5,$6,1,'2000-01-01') RETURNING id`,
          [code, level, name, parent, CAG, version],
        );
      state = await unit("state", "Testland", STATE_CODE, null);
      district = await unit("district", "Testpur", `${STATE_CODE}01`, state);
      await db().query(
        `INSERT INTO admin_unit_boundary (admin_unit_id, geometry, source_kind, source_name, source_licence,
                                          retrieved_at, dataset_version_id)
         VALUES ($1, ST_GeomFromText($2, 4326), 'open_dataset', 'OpenStreetMap', 'ODbL', now(), $3)`,
        [district, SQUARE, version],
      );
      const doc = (sha: string, title: string) =>
        one(
          `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title, issuing_authority,
                                 mime_type, page_count, pages_without_text, extraction_method,
                                 admin_unit_id, geography_source)
           VALUES ($1,$2,'audit_report',$3,'CAG','application/pdf',10,0,'test',$4,'publisher_filter')
           RETURNING id`,
          [sha, version, title, state],
        );
      report = await doc(CAG, "Testland Report No. 1");
      notice = await doc(RESTRICTED, "A notice");
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const mention = async (status: string, page: number, document = report): Promise<void> => {
      const decided = status !== "unverified";
      const fact = await one(
        `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                    extraction_method, parser_version, extraction_confidence,
                                    verification_status, verified_by, verified_at)
         VALUES ($1,$2,'place_reference','… works in Testpur were delayed …','Testpur district',
                 'test','cag-facts/25',0.8,$3,$4,$5) RETURNING id`,
        [document, page, status, decided ? "reviewer@test" : null, decided ? new Date() : null],
      );
      await db().query(
        `INSERT INTO place_mention (admin_unit_id, document_fact_id, dataset_version_id) VALUES ($1,$2,$3)`,
        [district, fact, version],
      );
    };

    const repo = (): PostgresPlaceMentionRepository => new PostgresPlaceMentionRepository(db());

    it("pins a place named on reviewed pages, at its boundary's centre, counting pages and reports", async () => {
      await mention("verified", 4);
      await mention("verified", 9);
      await mention("rejected", 12);
      await mention("verified", 2, notice);

      const named = await repo().namedWithin(state);
      expect(named).toHaveLength(1);
      expect(named[0]).toMatchObject({
        unitId: district,
        name: "Testpur",
        level: "district",
        pages: 2,
        reports: 1,
      });
      expect(named[0]?.point[0]).toBeCloseTo(80.5, 1);
      expect(named[0]?.point[1]).toBeCloseTo(19.5, 1);
    });

    it("lists a place's reports and pages in order, with links to cite", async () => {
      await mention("verified", 9);
      await mention("verified", 4);
      await mention("unverified", 6);

      const reports = await repo().mentionsOf(district);
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({
        documentId: report,
        sourceUrl: "https://cag.gov.in/m.pdf",
        retrievedAt: "2026-10-06T00:00:00+00:00",
      });
      expect(reports[0]?.pages.map((p) => p.pageNumber)).toEqual([4, 9]);
    });

    it("shows nothing for a place no reviewed page names", async () => {
      expect(await repo().namedWithin(state)).toEqual([]);
      expect(await repo().mentionsOf(district)).toEqual([]);
    });
  },
);
