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
 * These read whatever the ledger holds rather than seeding fixtures, because
 * the behaviour worth pinning is how the repository treats REAL boundaries:
 * mixed levels, missing geometry, a state with no polygon of its own.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "geography (integration)",
  () => {
    let pool: pg.Pool | undefined;
    let repository: PostgresGeographyRepository | undefined;
    let districtId: number | undefined;
    let stateId: number | undefined;

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
      repository = new PostgresGeographyRepository(pool);
      // A district that actually has units inside it. Most hold nothing yet —
      // only the districts an OSM ingest has descended into do — and picking an
      // arbitrary one would test containment against an empty region and call the
      // silence a failure.
      const district = await pool.query<{ id: string }>(
        `SELECT u.id
         FROM admin_unit u
         JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
        WHERE u.level = 'district'
          AND EXISTS (
            SELECT 1
              FROM admin_unit c
              JOIN admin_unit_boundary cb ON cb.admin_unit_id = c.id
             WHERE c.id <> u.id
               AND ST_Contains(b.geometry, ST_PointOnSurface(cb.geometry))
          )
        LIMIT 1`,
      );
      districtId = district.rows[0] === undefined ? undefined : Number(district.rows[0].id);
      const state = await pool.query<{ id: string }>(
        `SELECT id FROM admin_unit WHERE level = 'state' LIMIT 1`,
      );
      stateId = state.rows[0] === undefined ? undefined : Number(state.rows[0].id);
    });

    afterAll(async () => {
      await pool?.end();
    });

    it("finds what is inside a district, at whatever levels those are", async () => {
      if (repository === undefined || districtId === undefined) return;
      const children = await repository.childrenOf(districtId);
      // The point of containment over a parent chain: a district holds more than
      // one kind of thing, and all of them are reachable in one step.
      expect(children.length).toBeGreaterThan(0);
      expect(new Set(children.map((c) => c.level)).size).toBeGreaterThan(1);
      for (const child of children) {
        expect(child.id).not.toBe(districtId);
        expect(child.level).not.toBe("district");
      }
    });

    it("never returns a unit as its own child", async () => {
      if (repository === undefined || districtId === undefined) return;
      const children = await repository.childrenOf(districtId);
      expect(children.some((c) => c.id === districtId)).toBe(false);
    });

    it("falls back to the recorded parent for a unit with no boundary", async () => {
      if (repository === undefined || stateId === undefined) return;
      // States hold no boundary, so containment cannot answer for them. The
      // fallback is what keeps India → state → district working at all.
      const unit = await repository.unitById(stateId);
      expect(unit?.boundary).toBeNull();
      const children = await repository.childrenOf(stateId);
      for (const child of children) expect(child.parentId).toBe(stateId);
    });

    it("carries the source of every boundary it returns", async () => {
      if (repository === undefined || districtId === undefined) return;
      const children = await repository.childrenOf(districtId);
      for (const child of children) {
        // childrenOf is a spatial query, so anything it returns necessarily has
        // geometry — and geometry without a source is what this schema forbids.
        expect(child.boundary).not.toBeNull();
        expect(child.boundary?.sourceName.length).toBeGreaterThan(0);
        expect(child.boundary?.sourceLicence.length).toBeGreaterThan(0);
        expect(["official_government", "open_dataset", "derived"]).toContain(child.boundary?.kind);
      }
    });

    it("names an authority only when the claim is that a government published it", async () => {
      if (repository === undefined || districtId === undefined) return;
      for (const child of await repository.childrenOf(districtId)) {
        if (child.boundary?.kind === "official_government") {
          expect(child.boundary.authority).not.toBeNull();
        }
      }
    });

    it("returns a bounding box alongside a boundary, for framing", async () => {
      if (repository === undefined || districtId === undefined) return;
      const unit = await repository.unitById(districtId);
      expect(unit?.bbox).not.toBeNull();
      const [west, south, east, north] = unit?.bbox ?? [0, 0, 0, 0];
      expect(east).toBeGreaterThan(west);
      expect(north).toBeGreaterThan(south);
    });

    it("walks ancestors from the outside in", async () => {
      if (repository === undefined || districtId === undefined) return;
      const children = await repository.childrenOf(districtId);
      const deepest = children[children.length - 1];
      if (deepest === undefined) return;
      const ancestors = await repository.ancestorsOf(deepest.id);
      // Outermost first, so a breadcrumb reads left to right without reversing.
      expect(ancestors[ancestors.length - 1]?.id).toBe(deepest.id);
    });

    it("bounds a viewport query by the box and by the limit", async () => {
      if (repository === undefined) return;
      // Viewport-scoped reads are the reason this is not "fetch every boundary
      // and filter in the browser".
      const all = await repository.unitsIntersecting([68, 6, 98, 38], [], 5);
      expect(all.length).toBeLessThanOrEqual(5);

      const pacific = await repository.unitsIntersecting([-170, -40, -160, -30], [], 50);
      expect(pacific).toHaveLength(0);
    });

    it("filters a viewport query by level", async () => {
      if (repository === undefined) return;
      const districts = await repository.unitsIntersecting([68, 6, 98, 38], ["district"], 50);
      for (const unit of districts) expect(unit.level).toBe("district");
    });

    it("returns geometry for a unit that has one, and nothing for one that does not", async () => {
      if (repository === undefined || districtId === undefined || stateId === undefined) return;
      expect(await repository.boundaryOf(districtId)).not.toBeNull();
      expect(await repository.boundaryOf(stateId)).toBeNull();
    });
  },
);
