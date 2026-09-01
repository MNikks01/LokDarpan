import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresTenderRepository } from "../src/tender.repository";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * What the map is allowed to say, asserted against a real Postgres.
 *
 * The claims under test are about honesty rather than plumbing: that a closed
 * tender stops being counted, that an unplaced one stays reachable, and that a
 * value crosses as a string. A fake would prove none of them.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "tender repository (integration)",
  { timeout: 30_000 },
  () => {
    let pool: pg.Pool | undefined;
    let repository: PostgresTenderRepository | undefined;

    const ARTIFACT = "6".repeat(64);
    const PORTAL = "zz-test";
    const LGD_STATE = "9920001";
    const LGD_DISTRICT = "9920002";
    let districtId = 0;
    let versionId = 0;

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
      repository = new PostgresTenderRepository(pool);

      await pool.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1, 'test-tender', 'https://example.invalid/tenders', now(), 1, 'test/t.html')
         ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT],
      );
      const version = await pool.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('tender integration test') RETURNING id`,
      );
      versionId = Number(version.rows[0]?.id);

      const state = await pool.query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ($1, 'state', 'Testland', $2, $3, 1.0, CURRENT_DATE) RETURNING id`,
        [LGD_STATE, ARTIFACT, versionId],
      );
      const district = await pool.query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, source_sha256,
                                 dataset_version_id, extraction_confidence, valid_from)
         VALUES ($1, 'district', 'Test District', $2, $3, $4, 1.0, CURRENT_DATE) RETURNING id`,
        [LGD_DISTRICT, Number(state.rows[0]?.id), ARTIFACT, versionId],
      );
      districtId = Number(district.rows[0]?.id);

      interface Fixture {
        readonly id: string;
        readonly title: string;
        readonly closingAt: string | null;
        readonly unitId: number | null;
        readonly valuePaise: string | null;
      }

      const insert = async ({
        id,
        title,
        closingAt,
        unitId,
        valuePaise,
      }: Fixture): Promise<void> => {
        await pool?.query(
          `INSERT INTO tender (portal_code, portal_tender_id, tender_reference, title,
                               closing_at, admin_unit_id, linkage_confidence, district_source,
                               first_seen_at, last_seen_at, source_sha256, dataset_version_id,
                               extraction_confidence, department, tender_value_paise)
           VALUES ($1, $2, 'REF/1', $3, $4, $5, $6, $7, now(), now(), $8, $9, 0.95, $10, $11)`,
          [
            PORTAL,
            id,
            title,
            closingAt,
            unitId,
            unitId === null ? null : 0.9,
            unitId === null ? null : "chain_unit",
            ARTIFACT,
            versionId,
            "Test Department",
            valuePaise,
          ],
        );
      };

      await insert({
        id: "open-1",
        title: "Open with value",
        closingAt: "2099-01-01T00:00:00Z",
        unitId: districtId,
        valuePaise: "59200000",
      });
      await insert({
        id: "open-2",
        title: "Open, no closing date",
        closingAt: null,
        unitId: districtId,
        valuePaise: null,
      });
      await insert({
        id: "closed-1",
        title: "Already closed",
        closingAt: "2000-01-01T00:00:00Z",
        unitId: districtId,
        valuePaise: null,
      });
      await insert({
        id: "unplaced-1",
        title: "Open but unplaced",
        closingAt: "2099-01-01T00:00:00Z",
        unitId: null,
        valuePaise: null,
      });

      await pool.query(
        `INSERT INTO tender_collection_window (portal_code, collecting_since)
         VALUES ($1, DATE '2026-09-01') ON CONFLICT (portal_code) DO NOTHING`,
        [PORTAL],
      );
    });

    afterAll(async () => {
      await pool?.query(`DELETE FROM tender WHERE portal_code = $1`, [PORTAL]);
      await pool?.query(`DELETE FROM tender_collection_window WHERE portal_code = $1`, [PORTAL]);
      await pool?.query(`DELETE FROM admin_unit WHERE dataset_version_id = $1`, [versionId]);
      await pool?.query(`DELETE FROM dataset_version WHERE id = $1`, [versionId]);
      await pool?.query(`DELETE FROM source_artifact WHERE sha256 = $1`, [ARTIFACT]);
      await pool?.end();
    });

    it("counts only tenders still open", async () => {
      // A closed tender is one nobody can bid on. Shading a district for it
      // would overstate what is currently being advertised.
      const counts = (await repository?.countsByDistrict()) ?? [];
      expect(counts.find((c) => c.adminUnitId === districtId)?.tenderCount).toBe(2);
    });

    it("counts a tender with no closing date, because none was published", async () => {
      // The portal stating no deadline is not the same as a deadline having
      // passed, and dropping it would hide a live advertisement.
      const open = await repository?.listTenders({ adminUnitId: districtId });
      expect(open?.map((t) => t.title)).toContain("Open, no closing date");
      expect(open?.map((t) => t.title)).not.toContain("Already closed");
    });

    it("keeps an unplaced tender reachable", async () => {
      // It could not be put on the map. It is still a real advertisement by a
      // real office, and hiding it would be a coverage gap disguised as a fact.
      const unplaced = (await repository?.listTenders({ unplacedOnly: true })) ?? [];
      expect(unplaced.map((t) => t.title)).toContain("Open but unplaced");
      expect(await repository?.unplacedCount()).toBeGreaterThanOrEqual(1);
    });

    it("sends money as a decimal string, never a number", async () => {
      // A JSON number loses precision on a national aggregate silently, behind
      // a correct-looking source link.
      const tenders = (await repository?.listTenders({ adminUnitId: districtId })) ?? [];
      const withValue = tenders.find((t) => t.title === "Open with value");
      expect(typeof withValue?.tenderValueInr).toBe("string");
      // Two decimal places exactly. Postgres gives division a far higher scale,
      // so an uncast `/ 100` sends 592000.000000000000 to the page.
      expect(withValue?.tenderValueInr).toBe("592000.00");
    });

    it("reports an unstated value as absent, never as zero", async () => {
      const tenders = (await repository?.listTenders({ adminUnitId: districtId })) ?? [];
      expect(tenders.find((t) => t.title === "Open, no closing date")?.tenderValueInr).toBeNull();
    });

    it("narrows counts by department", async () => {
      const counts = (await repository?.countsByDistrict("Test Department")) ?? [];
      expect(counts.find((c) => c.adminUnitId === districtId)?.tenderCount).toBe(2);
      const none = (await repository?.countsByDistrict("No Such Department")) ?? [];
      expect(none.find((c) => c.adminUnitId === districtId)).toBeUndefined();
    });

    it("lists the departments currently advertising", async () => {
      const departments = (await repository?.departments()) ?? [];
      expect(
        departments.find((d) => d.name === "Test Department")?.tenderCount,
      ).toBeGreaterThanOrEqual(2);
    });

    it("states when collection began, so a gap is not read as a silence", async () => {
      const windows = (await repository?.collectionWindows()) ?? [];
      expect(windows.find((w) => w.portalCode === PORTAL)?.collectingSince).toBe("2026-09-01");
    });

    it("names the artefact every tender was read from", async () => {
      // A figure without provenance is a contract violation, not a display bug.
      const tenders = (await repository?.listTenders({ adminUnitId: districtId })) ?? [];
      expect(tenders.length).toBeGreaterThan(0);
      for (const tender of tenders) expect(tender.sourceUrl).not.toBe("");
    });
  },
);
