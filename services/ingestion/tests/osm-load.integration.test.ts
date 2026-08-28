import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadBoundaries } from "../src/osm/load";
import type { ParsedUnit } from "../src/osm/boundaries";
import type { FetchedArtifact } from "../src/osm/overpass";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * What the loader does to the hierarchy, asserted against a real Postgres.
 *
 * The claim under test is about identity, not geometry: OpenStreetMap supplies
 * shape for places the Local Government Directory has already named, so a
 * relation must attach to the unit that exists rather than create a second one
 * beside it. Duplicate units would not fail anything loudly — they would just
 * quietly give one place two pages, two sets of records and two URLs.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "osm boundary load (integration)",
  () => {
    let client: pg.Client | undefined;

    /** Distinct from every other suite's fixtures, and from real LGD codes. */
    const LGD_STATE = "9910001";
    const LGD_OTHER = "9910002";
    const RELATION = 990_000_101;
    const RELATION_UNMATCHED = 990_000_102;
    const ARTIFACT = "8".repeat(64);
    /** The directory's own artefact, distinct from the Overpass one. */
    const SEED_ARTIFACT = "7".repeat(64);
    let seededId = 0;
    let seedVersionId = 0;

    const square = (west: number, south: number): (readonly [number, number])[] => [
      [west, south],
      [west + 1, south],
      [west + 1, south + 1],
      [west, south + 1],
      [west, south],
    ];

    const artifact: FetchedArtifact = {
      body: "{}",
      sha256: ARTIFACT,
      retrievedAt: "2026-08-28T00:00:00.000Z",
      sourceUrl: "https://overpass.example.invalid/api",
      byteSize: 2,
    };

    const unit = (over: Partial<ParsedUnit> = {}): ParsedUnit => ({
      osmRelationId: RELATION,
      name: "Claimed State",
      level: "state",
      osmAdminLevel: 4,
      lgdCode: LGD_STATE,
      lgdCodeKind: "ref:LGD:state",
      rings: [square(61, -31)],
      ...over,
    });

    beforeAll(async () => {
      client = new pg.Client({ connectionString: DATABASE_URL });
      await client.connect();
      // A unit as the directory leaves it: named and identified, no geometry,
      // and no idea that OpenStreetMap exists.
      await client.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1, 'test-osm-load', 'https://example.invalid/lgd', now(), 1, 'test/lgd.json')
         ON CONFLICT (sha256) DO NOTHING`,
        [SEED_ARTIFACT],
      );
      const version = await client.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('osm load test seed') RETURNING id`,
      );
      seedVersionId = Number(version.rows[0]?.id);

      const seeded = await client.query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, source_sha256,
                                 dataset_version_id, extraction_confidence, valid_from)
         VALUES ($1, 'state', 'Directory State', NULL, $2, $3, 1.0, CURRENT_DATE)
         RETURNING id`,
        [LGD_STATE, SEED_ARTIFACT, seedVersionId],
      );
      seededId = Number(seeded.rows[0]?.id);
    });

    afterAll(async () => {
      await client?.query(`DELETE FROM admin_unit WHERE lgd_code = ANY($1)`, [
        [LGD_STATE, LGD_OTHER],
      ]);
      await client?.query(`DELETE FROM admin_unit WHERE osm_relation_id = ANY($1)`, [
        [RELATION, RELATION_UNMATCHED],
      ]);
      await client?.query(`DELETE FROM dataset_version WHERE id = $1`, [seedVersionId]);
      await client?.query(`DELETE FROM source_artifact WHERE sha256 = ANY($1)`, [
        [ARTIFACT, SEED_ARTIFACT],
      ]);
      await client?.end();
    });

    it("attaches geometry to the unit the directory already named", async () => {
      if (client === undefined) return;
      const result = await loadBoundaries(client, {
        units: [unit()],
        artifact,
        datasetDescription: "osm load integration test",
        parentId: null,
      });
      expect(result.failed).toHaveLength(0);

      const rows = await client.query<{ id: string; osm_relation_id: string | null }>(
        `SELECT id, osm_relation_id FROM admin_unit WHERE lgd_code = $1`,
        [LGD_STATE],
      );
      // One row, and it is the one that was already there.
      expect(rows.rowCount).toBe(1);
      expect(Number(rows.rows[0]?.id)).toBe(seededId);
      expect(Number(rows.rows[0]?.osm_relation_id)).toBe(RELATION);

      const boundary = await client.query(
        `SELECT 1 FROM admin_unit_boundary WHERE admin_unit_id = $1`,
        [seededId],
      );
      expect(boundary.rowCount).toBe(1);
    });

    it("does not rename the place the directory named", async () => {
      // OSM's name is not authoritative. The relation above is called "Claimed
      // State"; the directory called it something else, and the directory wins
      // on a unit it identified — the ingest is here for the shape.
      const rows = await client?.query<{ name_en: string }>(
        `SELECT name_en FROM admin_unit WHERE id = $1`,
        [seededId],
      );
      expect(rows?.rows[0]?.name_en).toBe("Directory State");
    });

    it("inserts a new unit when the reference names a different level", async () => {
      if (client === undefined) return;
      // A district code carried on a state relation is a mis-tag, and every LGD
      // code is a bare integer — so trusting it would attach a state's shape to
      // whichever district happened to hold that number.
      await client.query(
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ($1, 'district', 'Unrelated District', $2, $3, 1.0, CURRENT_DATE)`,
        [LGD_OTHER, SEED_ARTIFACT, seedVersionId],
      );

      await loadBoundaries(client, {
        units: [
          unit({
            osmRelationId: RELATION_UNMATCHED,
            lgdCode: LGD_OTHER,
            lgdCodeKind: "ref:LGD:district",
            rings: [square(63, -31)],
          }),
        ],
        artifact,
        datasetDescription: "osm load integration test",
        parentId: null,
      });

      const district = await client.query<{ osm_relation_id: string | null }>(
        `SELECT osm_relation_id FROM admin_unit WHERE lgd_code = $1 AND level = 'district'`,
        [LGD_OTHER],
      );
      expect(district.rows[0]?.osm_relation_id).toBeNull();
    });
  },
);
