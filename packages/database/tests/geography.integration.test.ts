import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresGeographyRepository } from "../src/geography.repository";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * Runs only where a Postgres with PostGIS is reachable. What is asserted here —
 * that containment finds units at several levels, that provenance survives the
 * round trip, that a viewport query is bounded — are claims about a real spatial
 * database, so asserting them against a fake would prove nothing.
 *
 * WHY THIS SEEDS ITS OWN GEOGRAPHY
 * An earlier version read whatever the ledger happened to hold. On a developer's
 * machine that is a full district and the tests looked thorough; on a fresh
 * database it is nothing, every assertion short-circuited, and the suite passed
 * while exercising no code at all. A test that quietly does nothing is worse
 * than no test, because it also reports as coverage.
 *
 * The shapes below are squares in an empty stretch of ocean. They are not a
 * claim about geography; they are the minimum needed to prove containment,
 * level ordering and provenance behave as specified.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "geography (integration)",
  () => {
    let pool: pg.Pool | undefined;
    let repository: PostgresGeographyRepository | undefined;

    const ids: Record<"state" | "district" | "taluka" | "body" | "outside", number> = {
      state: 0,
      district: 0,
      taluka: 0,
      body: 0,
      outside: 0,
    };
    /**
     * A digest no other suite uses. Single-letter repeats a-f are all taken,
     * and "f" is `schema.integration.test.ts`'s sentinel for "an artefact that
     * does not exist" — seeding it here made that suite's rejection test accept
     * an insert it was supposed to refuse. Fixtures share one database, so a
     * sentinel is only absent while nobody creates it.
     */
    const ARTIFACT = "9".repeat(64);
    let datasetVersionId = 0;

    /** A square, as WKT. */
    const square = (west: number, south: number, size: number): string => {
      const e = west + size;
      const n = south + size;
      return `MULTIPOLYGON(((${String(west)} ${String(south)},${String(e)} ${String(south)},${String(e)} ${String(n)},${String(west)} ${String(n)},${String(west)} ${String(south)})))`;
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
      repository = new PostgresGeographyRepository(pool);

      await pool.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
       VALUES ($1, 'test-geography', 'https://example.invalid/geo', now(), 1, 'test/geo.json')
       ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT],
      );
      const version = await pool.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('geography integration test') RETURNING id`,
      );
      datasetVersionId = Number(version.rows[0]?.id);

      // Each unit carries an OSM relation and no LGD code, which is exactly the
      // shape migration 0011 exists to allow — and `admin_unit_identified`
      // rejects a unit with neither, as the first version of this seed
      // discovered by being refused.
      let nextRelation = 900_000_001;
      const unit = async (level: string, name: string, parent: number | null): Promise<number> => {
        const result = await pool?.query<{ id: string }>(
          `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, osm_relation_id,
                                   source_sha256, dataset_version_id, extraction_confidence, valid_from)
         VALUES (NULL, $1::admin_unit_level, $2, $3, $4, $5, $6, 1.0, CURRENT_DATE)
         RETURNING id`,
          [level, name, parent, nextRelation++, ARTIFACT, datasetVersionId],
        );
        return Number(result?.rows[0]?.id);
      };

      const boundary = async (
        id: number,
        wkt: string,
        kind: string,
        authority: string | null,
      ): Promise<void> => {
        await pool?.query(
          `INSERT INTO admin_unit_boundary (admin_unit_id, geometry, source_kind, source_name,
                                          source_licence, source_ref, authority, retrieved_at, dataset_version_id)
         VALUES ($1, ST_GeomFromText($2, 4326), $3::boundary_source_kind, 'Test source',
                 'Test licence', 'test/1', $4, now(), $5)`,
          [id, wkt, kind, authority, datasetVersionId],
        );
      };

      // A state with NO boundary, so the parent_id fallback has something to prove.
      ids.state = await unit("state", "Testland", null);
      ids.district = await unit("district", "Test District", ids.state);
      ids.taluka = await unit("sub_district", "Test Taluka", ids.district);
      ids.body = await unit("urban_local_body", "Test City", ids.district);
      ids.outside = await unit("district", "Far District", ids.state);

      // The district encloses both children; "Far District" is elsewhere entirely.
      await boundary(ids.district, square(70.0, -20.0, 2), "open_dataset", null);
      await boundary(ids.taluka, square(70.2, -19.8, 0.5), "open_dataset", null);
      await boundary(ids.body, square(71.0, -19.2, 0.3), "official_government", "Test Authority");
      await boundary(ids.outside, square(60.0, -30.0, 1), "derived", null);
    });

    afterAll(async () => {
      // Scoped to the version this suite opened, so it can only remove its own
      // rows. Boundaries cascade with their units.
      await pool?.query(`DELETE FROM admin_unit WHERE dataset_version_id = $1`, [datasetVersionId]);
      await pool?.query(`DELETE FROM dataset_version WHERE id = $1`, [datasetVersionId]);
      // The artefact too: leaving it behind is how this suite once broke
      // another one's "does not exist" sentinel.
      await pool?.query(`DELETE FROM source_artifact WHERE sha256 = $1`, [ARTIFACT]);
      await pool?.end();
    });

    it("finds what is inside a district, at whatever levels those are", async () => {
      const children = (await repository?.childrenOf(ids.district)) ?? [];
      const names = children.map((c) => c.name);
      // The point of containment over a parent chain: a district holds more than
      // one kind of thing, and both are reachable in one step.
      expect(names).toContain("Test Taluka");
      expect(names).toContain("Test City");
      expect(new Set(children.map((c) => c.level)).size).toBe(2);
    });

    it("orders shallower levels first, so a taluka precedes a municipal body", async () => {
      const children = (await repository?.childrenOf(ids.district)) ?? [];
      const levels = children.map((c) => c.level);
      expect(levels.indexOf("sub_district")).toBeLessThan(levels.indexOf("urban_local_body"));
    });

    it("excludes a unit that merely sits elsewhere", async () => {
      const children = (await repository?.childrenOf(ids.district)) ?? [];
      expect(children.map((c) => c.name)).not.toContain("Far District");
    });

    it("never returns a unit as its own child", async () => {
      const children = (await repository?.childrenOf(ids.district)) ?? [];
      expect(children.some((c) => c.id === ids.district)).toBe(false);
    });

    it("falls back to the recorded parent for a unit with no boundary", async () => {
      // A state holds no boundary, so containment cannot answer for it. The
      // fallback is what keeps state to district working at all.
      const state = await repository?.unitById(ids.state);
      expect(state?.boundary).toBeNull();
      const children = (await repository?.childrenOf(ids.state)) ?? [];
      expect(children.map((c) => c.name).sort()).toEqual(["Far District", "Test District"]);
    });

    it("carries the source of every boundary it returns", async () => {
      for (const child of (await repository?.childrenOf(ids.district)) ?? []) {
        expect(child.boundary?.sourceName).toBe("Test source");
        expect(child.boundary?.sourceLicence).toBe("Test licence");
      }
    });

    it("names an authority only where the claim is that a government published it", async () => {
      const children = (await repository?.childrenOf(ids.district)) ?? [];
      const official = children.find((c) => c.boundary?.kind === "official_government");
      const open = children.find((c) => c.boundary?.kind === "open_dataset");
      expect(official?.boundary?.authority).toBe("Test Authority");
      expect(open?.boundary?.authority).toBeNull();
    });

    it("returns a bounding box alongside a boundary, for framing", async () => {
      const unit = await repository?.unitById(ids.district);
      const [west, south, east, north] = unit?.bbox ?? [0, 0, 0, 0];
      expect(east).toBeGreaterThan(west);
      expect(north).toBeGreaterThan(south);
    });

    it("walks ancestors from the outside in", async () => {
      const ancestors = (await repository?.ancestorsOf(ids.taluka)) ?? [];
      // Outermost first, so a breadcrumb reads left to right without reversing.
      expect(ancestors.map((a) => a.name)).toEqual(["Testland", "Test District", "Test Taluka"]);
    });

    it("returns boundary features with their provenance attached", async () => {
      const collection = await repository?.boundariesOfChildren(ids.district);
      expect(collection?.type).toBe("FeatureCollection");
      expect(collection?.features.length).toBe(2);
      for (const feature of collection?.features ?? []) {
        expect(feature.properties.sourceName).toBe("Test source");
        expect(feature.geometry).not.toBeNull();
      }
    });

    it("bounds a viewport query by the box and by the limit", async () => {
      // Viewport-scoped reads are the reason this is not "fetch every boundary
      // and filter in the browser".
      const inBox = (await repository?.unitsIntersecting([69, -21, 73, -18], [], 2)) ?? [];
      expect(inBox.length).toBeLessThanOrEqual(2);

      const elsewhere = (await repository?.unitsIntersecting([-170, -40, -160, -30], [], 50)) ?? [];
      expect(elsewhere).toHaveLength(0);
    });

    it("filters a viewport query by level", async () => {
      const talukas =
        (await repository?.unitsIntersecting([69, -21, 73, -18], ["sub_district"], 50)) ?? [];
      for (const unit of talukas) expect(unit.level).toBe("sub_district");
    });

    it("returns geometry for a unit that has one, and nothing for one that does not", async () => {
      expect(await repository?.boundaryOf(ids.district)).not.toBeNull();
      expect(await repository?.boundaryOf(ids.state)).toBeNull();
    });

    it("searches places by name, preferring a prefix match", async () => {
      const results = (await repository?.search("Test", 10)) ?? [];
      const places = results.filter((r) => r.kind === "place");
      expect(places.length).toBeGreaterThanOrEqual(3);
      expect(places[0]?.title.startsWith("Test")).toBe(true);
    });

    it("reports whether a place can actually be framed on the map", async () => {
      const results = (await repository?.search("Testland", 10)) ?? [];
      // A state with no boundary is findable and not frameable, and the caller
      // needs to know which before it moves the camera.
      expect(results.find((r) => r.title === "Testland")?.hasBoundary).toBe(false);
    });

    it("ignores a search term too short to mean anything", async () => {
      expect(await repository?.search("T", 10)).toEqual([]);
    });
  },
);
