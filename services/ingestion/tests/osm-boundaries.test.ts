import { describe, it, expect } from "vitest";
import {
  assembleRings,
  levelFor,
  lgdReference,
  parseRelation,
  parseRelations,
  BoundaryRejected,
  type OverpassRelation,
} from "../src/osm/boundaries";

/** A square in Nagpur, split into two ways so assembly has work to do. */
function squareRelation(overrides: Partial<OverpassRelation> = {}): OverpassRelation {
  return {
    type: "relation",
    id: 1991091,
    tags: { name: "Nagpur", admin_level: "5", boundary: "administrative" },
    members: [
      {
        type: "way",
        role: "outer",
        geometry: [
          { lat: 21.0, lon: 79.0 },
          { lat: 21.0, lon: 79.1 },
          { lat: 21.1, lon: 79.1 },
        ],
      },
      {
        type: "way",
        role: "outer",
        geometry: [
          { lat: 21.1, lon: 79.1 },
          { lat: 21.1, lon: 79.0 },
          { lat: 21.0, lon: 79.0 },
        ],
      },
    ],
    ...overrides,
  };
}

describe("OSM admin levels are a country convention, not a global truth", () => {
  it("maps Maharashtra's levels as OSM actually tags them", () => {
    // Verified against the live data: Nagpur district is level 5, its talukas 6,
    // Nagpur City 8. Assuming the European convention would misfile all three.
    expect(levelFor(5)).toBe("district");
    expect(levelFor(6)).toBe("sub_district");
    expect(levelFor(8)).toBe("urban_local_body");
  });

  it("refuses a level it has no mapping for rather than guessing the nearest", () => {
    expect(levelFor(3)).toBeNull();
    expect(levelFor(11)).toBeNull();
  });
});

describe("LGD references name their registry", () => {
  it("returns the code together with the key that supplied it", () => {
    // Nagpur is 484 as an LGD district and 505 as a Census district. A bare
    // number that does not say which registry it belongs to is a bad join.
    expect(lgdReference({ "ref:LGD:district": "484" })).toEqual({
      code: "484",
      kind: "ref:LGD:district",
    });
    expect(lgdReference({ "ref:LGD:subdistrict": "4032" })?.kind).toBe("ref:LGD:subdistrict");
  });

  it("is absent rather than invented when the relation carries no reference", () => {
    // "Nagpur City" genuinely has none.
    expect(lgdReference({ name: "Nagpur City" })).toBeNull();
  });

  it("ignores a non-numeric reference instead of storing it as a code", () => {
    expect(lgdReference({ "ref:LGD:district": "unknown" })).toBeNull();
  });
});

describe("ring assembly", () => {
  it("chains member ways end to end into a closed ring", () => {
    const [ring] = assembleRings(squareRelation());
    expect(ring?.[0]).toEqual(ring?.[ring.length - 1]);
    expect(ring?.length).toBeGreaterThanOrEqual(4);
  });

  it("joins a way that is stored in the opposite direction", () => {
    const relation = squareRelation({
      members: [
        {
          type: "way",
          role: "outer",
          geometry: [
            { lat: 21.0, lon: 79.0 },
            { lat: 21.0, lon: 79.1 },
            { lat: 21.1, lon: 79.1 },
          ],
        },
        // Same edge, reversed — OSM does not guarantee member direction.
        {
          type: "way",
          role: "outer",
          geometry: [
            { lat: 21.0, lon: 79.0 },
            { lat: 21.1, lon: 79.0 },
            { lat: 21.1, lon: 79.1 },
          ],
        },
      ],
    });
    expect(assembleRings(relation)).toHaveLength(1);
  });

  it("refuses linework with a gap rather than closing it silently", () => {
    // Closing the gap would invent an edge the source does not contain.
    const relation = squareRelation({
      members: [
        {
          type: "way",
          role: "outer",
          geometry: [
            { lat: 21.0, lon: 79.0 },
            { lat: 21.0, lon: 79.1 },
          ],
        },
        {
          type: "way",
          role: "outer",
          geometry: [
            { lat: 21.1, lon: 79.1 },
            { lat: 21.1, lon: 79.0 },
          ],
        },
      ],
    });
    expect(() => assembleRings(relation)).toThrow(BoundaryRejected);
  });
});

describe("a relation is untrusted input", () => {
  it("accepts a well-formed relation", () => {
    const unit = parseRelation(squareRelation());
    expect(unit.level).toBe("district");
    expect(unit.osmRelationId).toBe(1991091);
    expect(unit.rings).toHaveLength(1);
  });

  it("refuses a relation with no name", () => {
    expect(() => parseRelation(squareRelation({ tags: { admin_level: "5" } }))).toThrow(
      BoundaryRejected,
    );
  });

  it("refuses coordinates outside India", () => {
    // A boundary in the Atlantic is a defect in the payload, not a place.
    const relation = squareRelation({
      members: [
        {
          type: "way",
          role: "outer",
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
            { lat: 0, lon: 0 },
          ],
        },
      ],
    });
    expect(() => parseRelation(relation)).toThrow(/outside India/);
  });

  it("refuses a non-numeric admin_level rather than coercing it", () => {
    expect(() =>
      parseRelation(squareRelation({ tags: { name: "X", admin_level: "eight" } })),
    ).toThrow(BoundaryRejected);
  });
});

describe("a whole response keeps what is usable and reports the rest", () => {
  it("does not let one bad relation discard the good ones", () => {
    const outcome = parseRelations([
      squareRelation(),
      squareRelation({ id: 2, tags: { admin_level: "5" } }),
    ]);
    expect(outcome.units).toHaveLength(1);
    expect(outcome.rejected).toEqual([{ osmRelationId: 2, reason: "no name tag" }]);
  });

  it("reports rejections so a run cannot quietly hold less than the operator thinks", () => {
    const outcome = parseRelations([
      squareRelation({ id: 3, tags: { name: "X", admin_level: "3" } }),
    ]);
    expect(outcome.units).toHaveLength(0);
    expect(outcome.rejected[0]?.reason).toContain("no ledger level");
  });
});
