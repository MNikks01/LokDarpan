import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "../src/migrator";
import { PostgresHoldingsRepository } from "../src/holdings.repository";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const CAG = "d6".repeat(32);
const BEAMS = "d7".repeat(32);
/** A state code no other suite commits under, so parallel suites cannot see these rows. */
const STATE_CODE = "9976001";

/**
 * What the checklist reads (LD-009, ADR-076): units below, reports and budgets
 * kept by state, and tender collection for the state. Every case runs in a
 * transaction that is rolled back.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "PostgresHoldingsRepository (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let version = 0;
    let state = 0;
    let district = 0;

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

    const unit = (level: string, name: string, code: string | null, parent: number | null) =>
      one(
        `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ($1, $2, $3, $4, $5, $6, 1, '2000-01-01') RETURNING id`,
        [code, level, name, parent, CAG, version],
      );

    beforeEach(async () => {
      await db().query("BEGIN");
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
         VALUES ($1,'cag','https://cag.gov.in/r.pdf','2026-09-04T06:30:28Z',10,'cag/r','file'),
                ($2,'beams','https://beams.mahakosh.gov.in/x','2026-08-26T11:58:19Z',10,'beams/x','file')
         ON CONFLICT (sha256) DO NOTHING`,
        [CAG, BEAMS],
      );
      version = await one(
        `INSERT INTO dataset_version (description) VALUES ('holdings repo test') RETURNING id`,
        [],
      );
      state = await unit("state", "Testland", STATE_CODE, null);
      district = await unit("district", "Testpur", `${STATE_CODE}01`, state);
      await unit("sub_district", "Taluka A", `${STATE_CODE}0101`, district);
      await unit("sub_district", "Taluka B", `${STATE_CODE}0102`, district);
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const repo = (): PostgresHoldingsRepository => new PostgresHoldingsRepository(db());

    it("finds nothing for a unit that does not exist", async () => {
      expect(await repo().inputsFor(2_000_000_000)).toBeNull();
    });

    it("counts units held one level down, and leaves a level with none at zero", async () => {
      const inputs = await repo().inputsFor(district);
      expect(inputs?.boundaries).toEqual([
        { level: "sub_district", held: 2, coverage: null },
        { level: "urban_local_body", held: 0, coverage: null },
      ]);
    });

    it("reads a coverage finding recorded against the state from a district below it", async () => {
      await db().query(
        `INSERT INTO geography_coverage (admin_unit_id, level, status, source_id, note)
         VALUES ($1, 'urban_local_body', 'partial', 'openstreetmap-overpass', 'Some are tagged.')`,
        [state],
      );
      const inputs = await repo().inputsFor(district);
      expect(inputs?.boundaries[1]?.coverage).toMatchObject({
        status: "partial",
        note: "Some are tagged.",
        sourceId: "openstreetmap-overpass",
      });
    });

    it("reads reports and budgets for the state, naming it from a district", async () => {
      await db().query(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title, issuing_authority,
                               mime_type, page_count, pages_without_text, extraction_method,
                               admin_unit_id, geography_source)
         VALUES ($1,$2,'audit_report','Testland Report No. 1','CAG','application/pdf',10,0,'test',$3,'publisher_filter')`,
        [CAG, version, state],
      );
      const dept = await one(
        `INSERT INTO department (admin_unit_id, code, name_en, source_sha256, dataset_version_id, extraction_confidence)
         VALUES ($1, 'T01', 'Test Department', $2, $3, 1) RETURNING id`,
        [state, BEAMS, version],
      );
      await db().query(
        `INSERT INTO department_finance (department_id, fiscal_year, from_month, to_month, budgeted_inr,
                                         extraction_confidence, linkage_confidence, source_sha256, dataset_version_id)
         VALUES ($1, 2025, 4, 3, 100, 1, 1, $2, $3)`,
        [dept, BEAMS, version],
      );

      const inputs = await repo().inputsFor(district);
      const filedUnder = { unitId: state, name: "Testland" };
      expect(inputs?.state).toEqual({ unitId: state, name: "Testland", lgdCode: STATE_CODE });
      expect(inputs?.audit).toEqual({ held: 1, lastAt: "2026-09-04T06:30:28+00:00", filedUnder });
      expect(inputs?.budget).toEqual({ held: 1, lastAt: "2026-08-26T11:58:19+00:00", filedUnder });

      // On the state's own page, nothing is "filed under" anything else.
      expect((await repo().inputsFor(state))?.audit?.filedUnder).toBeNull();
    });

    it("says not collected for tenders in a state with no collection window", async () => {
      const inputs = await repo().inputsFor(district);
      expect(inputs?.tenders?.status).toBe("not_collected");
      expect(inputs?.audit?.held).toBe(0);
      expect(inputs?.budget?.held).toBe(0);
    });

    it("reads the state's tender collection window", async () => {
      await db().query(
        `INSERT INTO tender_collection_window (portal_code, collecting_since, state_lgd_code,
                                               last_success_at, last_checked_at)
         VALUES ('testland', '2026-08-20', $1, now(), now())`,
        [STATE_CODE],
      );
      const inputs = await repo().inputsFor(district);
      expect(inputs?.tenders).toMatchObject({
        status: "collected",
        portalCode: "testland",
        collectingSince: "2026-08-20",
      });
    });
  },
);
