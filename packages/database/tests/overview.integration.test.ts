import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresOverviewRepository, type LedgerOverview } from "../src/overview.repository";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * The homepage's numbers, asserted against a real Postgres.
 *
 * Everything runs in one REPEATABLE READ transaction that is rolled back: the
 * counts are global, and a snapshot is the only way to measure what a fixture
 * adds while other suites commit rows of their own in parallel.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "overview repository (integration)",
  { timeout: 30_000 },
  () => {
    let pool: pg.Pool | undefined;
    let client: pg.PoolClient | undefined;
    let before: LedgerOverview | undefined;
    let after: LedgerOverview | undefined;

    const ARTIFACT = "7".repeat(64);
    const PORTAL = "zz-overview";
    // Not 9930xxx: tender-integrity commits rows under those codes while it runs,
    // and a state it has just collected would already be in `before`.
    const LGD_STATE = "9941001";
    const LGD_DISTRICT = "9941002";

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
      client = await pool.connect();
      const db = client;
      const repository = new PostgresOverviewRepository(db);

      await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      before = await repository.overview();

      await db.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
         VALUES ($1, 'test-overview', 'https://example.invalid/o', now(), 1, 'test/o.html', 'file')
         ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT],
      );
      const version = await db.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('overview integration test') RETURNING id`,
      );
      const versionId = Number(version.rows[0]?.id);
      const state = await db.query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ($1, 'state', 'Overviewland', $2, $3, 1.0, CURRENT_DATE) RETURNING id`,
        [LGD_STATE, ARTIFACT, versionId],
      );
      const district = await db.query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, source_sha256,
                                 dataset_version_id, extraction_confidence, valid_from)
         VALUES ($1, 'district', 'Overview District', $2, $3, $4, 1.0, CURRENT_DATE) RETURNING id`,
        [LGD_DISTRICT, Number(state.rows[0]?.id), ARTIFACT, versionId],
      );
      const districtId = Number(district.rows[0]?.id);

      const tender = async (id: string, closingAt: string | null): Promise<void> => {
        await db.query(
          `INSERT INTO tender (portal_code, portal_tender_id, tender_reference, title,
                               closing_at, admin_unit_id, linkage_confidence, district_source,
                               first_seen_at, last_seen_at, source_sha256, dataset_version_id,
                               extraction_confidence)
           VALUES ($1, $2, 'REF/1', 'Road repair', $3, $4, 0.9, 'chain_unit', now(), now(),
                   $5, $6, 0.95)`,
          [PORTAL, id, closingAt, districtId, ARTIFACT, versionId],
        );
      };
      await tender("open-1", "2999-01-01T00:00:00Z");
      await tender("open-2", null);
      await tender("closed-1", "2000-01-01T00:00:00Z");

      await db.query(
        `INSERT INTO tender_collection_window (portal_code, collecting_since, state_lgd_code, last_success_at)
         VALUES ($1, DATE '2026-09-01', $2, now())`,
        [PORTAL, LGD_STATE],
      );

      after = await repository.overview();
    });

    afterAll(async () => {
      await client?.query("ROLLBACK");
      client?.release();
      await pool?.end();
    });

    it("counts places, and one more of each for the fixture", () => {
      expect(after?.states).toBe((before?.states ?? 0) + 1);
      expect(after?.districts).toBe((before?.districts ?? 0) + 1);
    });

    it("counts only tenders still open, and a tender with no deadline as open", () => {
      expect(after?.openTenders).toBe((before?.openTenders ?? 0) + 2);
      expect(after?.placedOpenTenders).toBe((before?.placedOpenTenders ?? 0) + 2);
    });

    it("keys open tenders by the LGD codes the boundary manifest uses", () => {
      expect(after?.openTendersByDistrict).toContainEqual({
        stateLgdCode: LGD_STATE,
        districtLgdCode: LGD_DISTRICT,
        openTenders: 2,
      });
    });

    it("lists a state as collected only once its portal has succeeded", () => {
      expect(before?.tenderStates).not.toContain(LGD_STATE);
      expect(after?.tenderStates).toContain(LGD_STATE);
      expect(after?.tenderPortals).toBe((before?.tenderPortals ?? 0) + 1);
    });

    it("lists no state that holds no report", () => {
      expect(after?.holdingsByState.map((s) => s.stateLgdCode)).not.toContain(LGD_STATE);
      for (const state of after?.holdingsByState ?? []) {
        expect(state.reports).toBeGreaterThan(0);
      }
    });

    it("gives an example figure in rupees, from one whole sentence with one amount", () => {
      const example = after?.example;
      if (example === null || example === undefined) return;
      expect(example.value).toMatch(/^-?\d+(\.\d+)?$/u);
      expect(example.rawText.match(/₹/gu)).toHaveLength(1);
      expect(example.rawText.startsWith("…")).toBe(false);
      expect(example.pageNumber).toBeGreaterThan(0);
    });
  },
);
