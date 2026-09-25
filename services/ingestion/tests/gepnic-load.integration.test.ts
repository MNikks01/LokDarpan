import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { districtKey, type TenderDetail } from "../src/gepnic/detail";
import type { FetchedArtifact } from "../src/gepnic/fetch";
import type { ParsedTender } from "../src/gepnic/landing";
import { loadTenders, placementFor, type TenderRecord } from "../src/gepnic/load";

const DATABASE_URL = process.env["DATABASE_URL"];

const detail = (over: Partial<TenderDetail> = {}): TenderDetail => ({
  department: "Rural Development Department",
  organisationChain: ["Rural Development Department", "Test District", "Block Office"],
  districtName: "Test District",
  districtSource: "chain_unit",
  location: "Block Office",
  pincode: "600001",
  tenderCategory: "Works",
  productCategory: "Civil Works",
  tenderType: "Open Tender",
  tenderValuePaise: 59_200_000n,
  emdPaise: 450_000n,
  ...over,
});

describe("placing a tender in a district", () => {
  const districts: ReadonlyMap<string, number> = new Map([[districtKey("Test District"), 7]]);

  it("trusts a district the chain names less than certainty, and an office name less again", () => {
    expect(placementFor(detail(), districts)).toEqual({
      adminUnitId: 7,
      method: "chain_unit",
      confidence: 0.9,
      evidenceSha256: null,
      evidenceKey: null,
    });
    expect(placementFor(detail({ districtSource: "office_code" }), districts).confidence).toBe(0.6);
  });

  it("leaves a tender unplaced rather than approximately placed", () => {
    const unplaced = {
      adminUnitId: null,
      method: null,
      confidence: null,
      evidenceSha256: null,
      evidenceKey: null,
    };
    expect(placementFor(null, districts)).toEqual(unplaced);
    expect(placementFor(detail({ districtName: null }), districts)).toEqual(unplaced);
    expect(placementFor(detail({ districtSource: null }), districts)).toEqual(unplaced);
    // A name that does not resolve in this state is not a placement.
    expect(placementFor(detail({ districtName: "Elsewhere" }), districts)).toEqual(unplaced);
  });
});

/**
 * What a day's collection does to the ledger, asserted against a real Postgres.
 *
 * The claims are about history: a tender seen again is the same tender, a
 * detail page that failed to load erases nothing already held, one bad row
 * costs only itself, and a load that fails leaves the ledger as it was while
 * the run records that it failed.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "gepnic tender load (integration)",
  { timeout: 30_000 },
  () => {
    let client: pg.Client | undefined;

    /** Distinct from every other suite's fixtures, and from real codes. */
    const PORTAL = "test-gepnic-load";
    const LGD_STATE = "9960001";
    const LGD_DISTRICT = "9960002";
    const SEED_ARTIFACT = "5".repeat(64);
    const DIRECTORY_ARTIFACT = "6".repeat(64);
    const DESCRIPTION = "gepnic load integration test";
    let seedVersionId = 0;
    let districtId = 0;

    const artifact = (sha: string): FetchedArtifact => ({
      body: "<html></html>",
      sha256: sha,
      retrievedAt: "2026-09-25T00:00:00.000Z",
      sourceUrl: "https://tenders.example.invalid/nicgep/app",
      byteSize: 13,
    });

    const listed = (id: string, over: Partial<ParsedTender> = {}): ParsedTender => ({
      portalTenderId: id,
      tenderReference: `REF/${id}`,
      title: `Road works ${id}`,
      closingAt: "2026-10-01T09:30:00.000Z",
      bidOpeningAt: "2026-10-02T09:30:00.000Z",
      ...over,
    });

    const load = (db: pg.Client, records: readonly TenderRecord[], sha: string) =>
      loadTenders(db, {
        portalCode: PORTAL,
        stateLgdCode: LGD_STATE,
        records,
        artifact: artifact(sha),
        datasetDescription: DESCRIPTION,
      });

    const count = async (db: pg.Client): Promise<number> =>
      (
        await db.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM tender WHERE portal_code = $1`,
          [PORTAL],
        )
      ).rows[0]?.n ?? -1;

    const run = async (db: pg.Client, id: number) =>
      (
        await db.query(
          `SELECT status::text, records_seen, records_inserted, records_updated,
                  records_unchanged, records_rejected, records_unresolved, error_count
             FROM ingestion_run WHERE id = $1`,
          [id],
        )
      ).rows[0] as Record<string, unknown> | undefined;

    beforeAll(async () => {
      client = new pg.Client({ connectionString: DATABASE_URL });
      await client.connect();
      await client.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1, 'test-gepnic-load', 'https://example.invalid/lgd', now(), 1, 'test/lgd.json')
         ON CONFLICT (sha256) DO NOTHING`,
        [SEED_ARTIFACT],
      );
      const version = await client.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('gepnic load test seed') RETURNING id`,
      );
      seedVersionId = Number(version.rows[0]?.id);
      const state = await client.query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ($1, 'state', 'Loadland', $2, $3, 1.0, CURRENT_DATE) RETURNING id`,
        [LGD_STATE, SEED_ARTIFACT, seedVersionId],
      );
      // Named with its administrative word, as OpenStreetMap names some.
      const district = await client.query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, source_sha256,
                                 dataset_version_id, extraction_confidence, valid_from)
         VALUES ($1, 'district', 'Test District district', $2, $3, $4, 1.0, CURRENT_DATE)
         RETURNING id`,
        [LGD_DISTRICT, Number(state.rows[0]?.id), SEED_ARTIFACT, seedVersionId],
      );
      districtId = Number(district.rows[0]?.id);

      // The directory, as the Department of Posts would list one office in
      // this state. Spelled its way: upper case, and without the ledger's word.
      await client.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1, 'pincode-directory', 'https://www.data.gov.in/example', now(), 1, 'test/p.csv')
         ON CONFLICT (sha256) DO NOTHING`,
        [DIRECTORY_ARTIFACT],
      );
      await client.query(
        `INSERT INTO pincode_office (pincode, office_name, office_type, district_name, state_name,
                                     source_sha256, dataset_version_id)
         VALUES ('799001', 'Agartala H.O', 'H.O', 'TEST DISTRICT', 'LOADLAND', $1, $2)`,
        [DIRECTORY_ARTIFACT, seedVersionId],
      );
    });

    afterAll(async () => {
      await client?.query(`DELETE FROM tender WHERE portal_code = $1`, [PORTAL]);
      await client?.query(`DELETE FROM tender_collection_window WHERE portal_code = $1`, [PORTAL]);
      await client?.query(`DELETE FROM ingestion_run WHERE source_id = $1`, [`gepnic-${PORTAL}`]);
      await client?.query(`DELETE FROM pincode_office WHERE source_sha256 = $1`, [
        DIRECTORY_ARTIFACT,
      ]);
      await client?.query(`DELETE FROM admin_unit WHERE lgd_code = ANY($1)`, [
        [LGD_DISTRICT, LGD_STATE],
      ]);
      await client?.query(`DELETE FROM dataset_version WHERE id = $1 OR description = $2`, [
        seedVersionId,
        DESCRIPTION,
      ]);
      await client?.query(`DELETE FROM source_artifact WHERE sha256 = ANY($1)`, [
        [SEED_ARTIFACT, DIRECTORY_ARTIFACT, "1".repeat(64), "2".repeat(64), "3".repeat(64)],
      ]);
      await client?.end();
    });

    it("holds every tender, placing only those whose district resolves", async () => {
      if (client === undefined) return;
      const result = await load(
        client,
        [
          { listed: listed("A"), detail: detail() },
          { listed: listed("B"), detail: detail({ districtName: "Nowhere" }) },
          { listed: listed("C"), detail: null },
        ],
        "1".repeat(64),
      );
      expect(result).toMatchObject({ inserted: 3, updated: 0, changed: 0, placed: 1, failed: [] });

      const rows = await client.query<{
        portal_tender_id: string;
        admin_unit_id: string | null;
        linkage_confidence: string | null;
        tender_value_paise: string | null;
      }>(
        `SELECT portal_tender_id, admin_unit_id, linkage_confidence, tender_value_paise::text
           FROM tender WHERE portal_code = $1 ORDER BY portal_tender_id`,
        [PORTAL],
      );
      expect(rows.rows.map((r) => [r.portal_tender_id, r.admin_unit_id === null])).toEqual([
        ["A", false],
        ["B", true],
        ["C", true],
      ]);
      expect(Number(rows.rows[0]?.admin_unit_id)).toBe(districtId);
      expect(Number(rows.rows[0]?.linkage_confidence)).toBe(0.9);
      // Paise survive the trip exactly, with no float in the path.
      expect(rows.rows[0]?.tender_value_paise).toBe("59200000.00");

      expect(await run(client, result.ingestionRunId)).toMatchObject({
        status: "succeeded",
        records_seen: 3,
        records_inserted: 3,
        records_unresolved: 2,
      });
      const window = await client.query(
        `SELECT 1 FROM tender_collection_window
          WHERE portal_code = $1 AND state_lgd_code = $2 AND last_success_at IS NOT NULL`,
        [PORTAL, LGD_STATE],
      );
      expect(window.rowCount).toBe(1);
    });

    it("advances a tender seen again, keeps what an unread detail page did not say, and loses only a bad row", async () => {
      if (client === undefined) return;
      const result = await load(
        client,
        [
          // Seen again, detail page unreadable: the placement already held stays.
          { listed: listed("A"), detail: null },
          // Seen again with its deadline extended: the old date becomes a version.
          { listed: listed("B", { closingAt: "2026-10-08T09:30:00.000Z" }), detail: null },
          // A date the database cannot read fails this row alone.
          { listed: listed("D", { closingAt: "not a date" }), detail: null },
        ],
        "2".repeat(64),
      );
      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(2);
      expect(result.changed).toBe(1);
      expect(result.failed.map((f) => f.portalTenderId)).toEqual(["D"]);

      const a = await client.query<{ admin_unit_id: string | null; department: string | null }>(
        `SELECT admin_unit_id, department FROM tender
          WHERE portal_code = $1 AND portal_tender_id = 'A'`,
        [PORTAL],
      );
      expect(Number(a.rows[0]?.admin_unit_id)).toBe(districtId);
      expect(a.rows[0]?.department).toBe("Rural Development Department");

      const b = await client.query<{ now: Date; before: Date }>(
        `SELECT t.closing_at AS now, v.closing_at AS before
           FROM tender t JOIN tender_version v ON v.tender_id = t.id
          WHERE t.portal_code = $1 AND t.portal_tender_id = 'B'`,
        [PORTAL],
      );
      expect(b.rows.map((r) => [r.now.toISOString(), r.before.toISOString()])).toEqual([
        ["2026-10-08T09:30:00.000Z", "2026-10-01T09:30:00.000Z"],
      ]);

      expect(await run(client, result.ingestionRunId)).toMatchObject({
        status: "succeeded",
        records_seen: 3,
        records_updated: 1,
        records_unchanged: 1,
        records_rejected: 1,
      });
    });

    it("infers a district from a pincode, says so, and gives way to a district the tender names", async () => {
      if (client === undefined) return;
      const unnamed = detail({ districtName: null, districtSource: null, pincode: "799001" });
      const first = await load(client, [{ listed: listed("F"), detail: unnamed }], "1".repeat(64));
      expect(first.placed).toBe(1);

      const read = async () =>
        (
          await client?.query<{
            admin_unit_id: string;
            district_source: string;
            linkage_confidence: string;
            district_evidence_sha256: string | null;
            district_evidence_key: string | null;
            district_resolved_at: Date | null;
          }>(
            `SELECT admin_unit_id, district_source, linkage_confidence, district_evidence_sha256,
                    district_evidence_key, district_resolved_at
               FROM tender WHERE portal_code = $1 AND portal_tender_id = 'F'`,
            [PORTAL],
          )
        )?.rows[0];

      const inferred = await read();
      expect(Number(inferred?.admin_unit_id)).toBe(districtId);
      expect(inferred?.district_source).toBe("pincode");
      expect(Number(inferred?.linkage_confidence)).toBe(0.6);
      expect(inferred?.district_evidence_sha256).toBe(DIRECTORY_ARTIFACT);
      expect(inferred?.district_evidence_key).toBe("799001");
      expect(inferred?.district_resolved_at).toBeInstanceOf(Date);

      // Seen again with the chain naming the district: the placement is
      // replaced whole, so no directory evidence is left describing it.
      await load(client, [{ listed: listed("F"), detail: detail() }], "2".repeat(64));
      const named = await read();
      expect(named?.district_source).toBe("chain_unit");
      expect(named?.district_evidence_sha256).toBeNull();
      expect(named?.district_evidence_key).toBeNull();

      // Seen again with nothing readable: the placement already held stays whole.
      await load(client, [{ listed: listed("F"), detail: null }], "2".repeat(64));
      expect(await read()).toEqual(named);
    });

    it("leaves the ledger as it was when the load itself fails, and records the failure", async () => {
      if (client === undefined) return;
      const before = await count(client);
      await expect(
        loadTenders(client, {
          portalCode: PORTAL,
          stateLgdCode: LGD_STATE,
          records: [{ listed: listed("E"), detail: null }],
          artifact: { ...artifact("3".repeat(64)), retrievedAt: "not a date" },
          datasetDescription: DESCRIPTION,
        }),
      ).rejects.toThrow();

      expect(await count(client)).toBe(before);
      const failed = await client.query<{ id: string }>(
        `SELECT id FROM ingestion_run WHERE source_id = $1 ORDER BY id DESC LIMIT 1`,
        [`gepnic-${PORTAL}`],
      );
      expect(await run(client, Number(failed.rows[0]?.id))).toMatchObject({
        status: "failed",
        records_seen: 1,
        error_count: 1,
      });
    });
  },
);
