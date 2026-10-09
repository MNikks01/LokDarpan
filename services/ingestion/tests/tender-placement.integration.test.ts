import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { TenderDetail } from "../src/gepnic/detail";
import type { FetchedArtifact } from "../src/gepnic/fetch";
import type { Retained } from "../src/raw-store";
import { loadTenders } from "../src/gepnic/load";
import { decidePlacement, MANUAL_CONFIDENCE, PlacementRefused } from "../src/gepnic/place";
import { unplacedForReview } from "../src/gepnic/review";

const DATABASE_URL = process.env["DATABASE_URL"];
/** Decisions are made as the reviewer when CI provides one, to prove the grants suffice. */
const REVIEWER_URL = process.env["DATABASE_URL_REVIEWER"] ?? DATABASE_URL;

/**
 * A reviewer places what no rule could (migration 0035), asserted against a
 * real Postgres: the decision is signed and kept, the placement names it, the
 * collector never overrides it, and nothing outside the tender's own state is
 * accepted.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "manual tender placement (integration)",
  { timeout: 30_000 },
  () => {
    let owner: pg.Client | undefined;
    let reviewer: pg.Client | undefined;

    /** Distinct from every other suite's fixtures, and from real codes. */
    const PORTAL = "test-placement";
    const STATE = "9970001";
    const EAST = "9970002";
    const WEST = "9970003";
    const OTHER_STATE = "9970004";
    const ELSEWHERE = "9970005";
    const SEED = "4".repeat(64);
    const LANDING = "3a".repeat(32);
    const DESCRIPTION = "tender placement integration test";
    let seedVersion = 0;
    const ids = new Map<string, number>();

    const unnamed: TenderDetail = {
      department: "Public Works Department",
      organisationChain: ["Public Works Department", "Imphal Circle"],
      districtName: null,
      districtSource: null,
      location: "Imphal",
      pincode: null,
      tenderCategory: null,
      productCategory: null,
      tenderType: null,
      tenderValuePaise: null,
      emdPaise: null,
      fields: {},
    };

    const artifact: FetchedArtifact & Retained = {
      body: "<html></html>",
      sha256: LANDING,
      retrievedAt: "2026-09-29T00:00:00.000Z",
      sourceUrl: "https://tenders.example.invalid/nicgep/app",
      byteSize: 13,
      storagePath: `gepnic-test/${LANDING}`,
      storedIn: "file",
    };

    const load = (db: pg.Client, id: string, detail: TenderDetail | null) =>
      loadTenders(db, {
        portalCode: PORTAL,
        stateLgdCode: STATE,
        records: [
          {
            listed: {
              portalTenderId: id,
              tenderReference: `REF/${id}`,
              title: `Works ${id}`,
              closingAt: "2026-10-10T09:30:00.000Z",
              bidOpeningAt: null,
            },
            detail,
          },
        ],
        artifact,
        datasetDescription: DESCRIPTION,
      });

    const placement = async (id: string) =>
      (
        await owner?.query<{
          admin_unit_id: string | null;
          district_source: string | null;
          linkage_confidence: string | null;
          district_evidence_key: string | null;
        }>(
          `SELECT admin_unit_id, district_source, linkage_confidence, district_evidence_key
             FROM tender WHERE portal_code = $1 AND portal_tender_id = $2`,
          [PORTAL, id],
        )
      )?.rows[0];

    beforeAll(async () => {
      owner = new pg.Client({ connectionString: DATABASE_URL });
      await owner.connect();
      reviewer = new pg.Client({ connectionString: REVIEWER_URL });
      await reviewer.connect();
      await owner.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
         VALUES ($1, 'test-placement', 'https://example.invalid/lgd', now(), 1, 'test/lgd.json', 'file')
         ON CONFLICT (sha256) DO NOTHING`,
        [SEED],
      );
      const version = await owner.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('placement test seed') RETURNING id`,
      );
      seedVersion = Number(version.rows[0]?.id);
      const unit = async (lgd: string, level: string, name: string, parent: number | null) => {
        const row = await owner?.query<{ id: string }>(
          `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, source_sha256,
                                   dataset_version_id, extraction_confidence, valid_from)
           VALUES ($1, $2, $3, $4, $5, $6, 1.0, CURRENT_DATE) RETURNING id`,
          [lgd, level, name, parent, SEED, seedVersion],
        );
        ids.set(lgd, Number(row?.rows[0]?.id));
      };
      await unit(STATE, "state", "Placeland", null);
      await unit(EAST, "district", "East Test", ids.get(STATE) ?? null);
      await unit(WEST, "district", "West Test", ids.get(STATE) ?? null);
      await unit(OTHER_STATE, "state", "Elsewhere", null);
      await unit(ELSEWHERE, "district", "Far Test", ids.get(OTHER_STATE) ?? null);

      // Two tenders no rule can place: the chain names a circle, not a district.
      await load(owner, "A", unnamed);
      await load(owner, "B", unnamed);
    });

    afterAll(async () => {
      await owner?.query(`DELETE FROM tender WHERE portal_code = $1`, [PORTAL]);
      await owner?.query(`DELETE FROM tender_collection_window WHERE portal_code = $1`, [PORTAL]);
      await owner?.query(`DELETE FROM ingestion_run WHERE source_id = $1`, [`gepnic-${PORTAL}`]);
      await owner?.query(`DELETE FROM admin_unit WHERE lgd_code = ANY($1) AND level = 'district'`, [
        [EAST, WEST, ELSEWHERE],
      ]);
      await owner?.query(`DELETE FROM admin_unit WHERE lgd_code = ANY($1)`, [[STATE, OTHER_STATE]]);
      await owner?.query(`DELETE FROM dataset_version WHERE id = $1 OR description = $2`, [
        seedVersion,
        DESCRIPTION,
      ]);
      await owner?.query(`DELETE FROM source_artifact WHERE sha256 = ANY($1)`, [[SEED, LANDING]]);
      await reviewer?.end();
      await owner?.end();
    });

    it("places a tender by a signed decision, and the placement names the decision", async () => {
      if (reviewer === undefined || owner === undefined) return;
      expect((await placement("A"))?.admin_unit_id).toBeNull();

      const decided = await decidePlacement(reviewer, {
        portalCode: PORTAL,
        portalTenderId: "A",
        districtLgdCode: WEST,
        decidedBy: "A. Reviewer",
        reason: "Chain names the west circle office",
      });
      expect(decided.districtName).toBe("West Test");

      const placed = await placement("A");
      expect(placed).toMatchObject({
        admin_unit_id: String(ids.get(WEST)),
        district_source: "manual",
        district_evidence_key: `decision:${String(decided.decisionId)}`,
      });
      expect(Number(placed?.linkage_confidence)).toBe(MANUAL_CONFIDENCE);
      const kept = await owner.query(
        `SELECT decided_by, reason FROM tender_district_decision WHERE id = $1`,
        [decided.decisionId],
      );
      expect(kept.rows[0]).toEqual({
        decided_by: "A. Reviewer",
        reason: "Chain names the west circle office",
      });
    });

    it("is never overridden by the collector, even when a later reading names another district", async () => {
      if (owner === undefined) return;
      await load(owner, "A", {
        ...unnamed,
        districtName: "East Test",
        districtSource: "chain_unit",
      });
      expect((await placement("A"))?.district_source).toBe("manual");
      expect((await placement("A"))?.admin_unit_id).toBe(String(ids.get(WEST)));
    });

    it("records that a tender cannot be placed, without placing it", async () => {
      if (reviewer === undefined || owner === undefined) return;
      const decided = await decidePlacement(reviewer, {
        portalCode: PORTAL,
        portalTenderId: "B",
        districtLgdCode: null,
        decidedBy: "A. Reviewer",
        reason: "A state-level office; no district is named",
      });
      expect(decided.adminUnitId).toBeNull();
      expect((await placement("B"))?.admin_unit_id).toBeNull();
      const kept = await owner.query(
        `SELECT admin_unit_id FROM tender_district_decision WHERE id = $1`,
        [decided.decisionId],
      );
      expect(kept.rows[0]).toEqual({ admin_unit_id: null });
    });

    it("refuses a district of another state, an unsigned decision, and unplacing a placed tender", async () => {
      const db = reviewer;
      if (db === undefined) return;
      const decide = (over: object) =>
        decidePlacement(db, {
          portalCode: PORTAL,
          portalTenderId: "B",
          districtLgdCode: EAST,
          decidedBy: "A. Reviewer",
          reason: "r",
          ...over,
        });
      await expect(decide({ districtLgdCode: ELSEWHERE })).rejects.toBeInstanceOf(PlacementRefused);
      await expect(decide({ decidedBy: "  " })).rejects.toBeInstanceOf(PlacementRefused);
      await expect(decide({ portalTenderId: "A", districtLgdCode: null })).rejects.toBeInstanceOf(
        PlacementRefused,
      );
      await expect(decide({ portalTenderId: "missing" })).rejects.toBeInstanceOf(PlacementRefused);
    });

    it("leaves decided tenders off the review list", async () => {
      if (owner === undefined) return;
      // A was placed by a reviewer and B recorded as unplaceable: neither is listed.
      const listed = (await unplacedForReview(owner, STATE)).map((r) => r.portalTenderId);
      expect(listed).not.toContain("A");
      expect(listed).not.toContain("B");
    });

    it.skipIf(process.env["DATABASE_URL_REVIEWER"] === undefined)(
      "lets the reviewer set a placement and nothing the portal published",
      async () => {
        if (reviewer === undefined) return;
        await expect(
          reviewer.query(`UPDATE tender SET title = 'x' WHERE portal_code = $1`, [PORTAL]),
        ).rejects.toThrow(/permission denied/u);
        await expect(
          reviewer.query(`UPDATE tender_district_decision SET reason = 'x'`),
        ).rejects.toThrow(/permission denied/u);
      },
    );
  },
);
