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

/**
 * A relation's member list is written by whoever edited the map, so it holds
 * more than boundary linework: a node marking the seat of government, a way
 * carrying the label position, a relation nested inside another. These are the
 * paths that decide what is geometry and what is not — untested, an admin
 * centre node could end up as a vertex of a district.
 */
describe("member ways, as an untrusted payload supplies them", () => {
  const withMembers = (members: NonNullable<OverpassRelation["members"]>): OverpassRelation => ({
    type: "relation",
    id: 42,
    tags: { name: "Test", admin_level: "5", boundary: "administrative" },
    members,
  });

  const outer = [
    { lat: 21.0, lon: 79.0 },
    { lat: 21.0, lon: 79.1 },
    { lat: 21.1, lon: 79.1 },
    { lat: 21.1, lon: 79.0 },
    { lat: 21.0, lon: 79.0 },
  ];

  it("ignores a node member, which marks a place and not an edge", () => {
    const rings = assembleRings(
      withMembers([
        { type: "node", role: "admin_centre" },
        { type: "way", role: "outer", geometry: outer },
      ]),
    );
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(5);
  });

  it("ignores a way with no geometry, rather than treating it as empty linework", () => {
    const rings = assembleRings(
      withMembers([
        { type: "way", role: "outer" },
        { type: "way", role: "outer", geometry: outer },
      ]),
    );
    expect(rings).toHaveLength(1);
  });

  it("ignores a role that is not part of the boundary", () => {
    // `label` carries where the name should be drawn. Chained into the ring it
    // would put a stray vertex in the middle of the district.
    const rings = assembleRings(
      withMembers([
        {
          type: "way",
          role: "label",
          geometry: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 1 },
          ],
        },
        { type: "way", role: "outer", geometry: outer },
      ]),
    );
    expect(rings).toHaveLength(1);
    expect(rings[0]?.some((p) => p[0] === 0)).toBe(false);
  });

  it("accepts a member with no role at all, which OSM leaves off outer ways", () => {
    expect(assembleRings(withMembers([{ type: "way", geometry: outer }]))).toHaveLength(1);
  });

  it("ignores a way of a single point, which cannot be an edge", () => {
    expect(() =>
      assembleRings(
        withMembers([{ type: "way", role: "outer", geometry: [{ lat: 21, lon: 79 }] }]),
      ),
    ).toThrow(BoundaryRejected);
  });

  it("refuses a relation whose members carry no geometry at all", () => {
    // Overpass answers `out tags` without geometry. Accepting that would store
    // a unit with an empty boundary and call the ingest a success.
    expect(() => assembleRings(withMembers([]))).toThrow(/no member ways/);
  });

  it("assembles a relation made of more than one ring", () => {
    // A municipal body with a detached pocket is two rings, not a failure.
    const second = [
      { lat: 22.0, lon: 80.0 },
      { lat: 22.0, lon: 80.1 },
      { lat: 22.1, lon: 80.1 },
      { lat: 22.0, lon: 80.0 },
    ];
    const rings = assembleRings(
      withMembers([
        { type: "way", role: "outer", geometry: outer },
        { type: "way", role: "inner", geometry: second },
      ]),
    );
    expect(rings).toHaveLength(2);
  });

  it("refuses a closed ring of too few points to bound an area", () => {
    expect(() =>
      assembleRings(
        withMembers([
          {
            type: "way",
            role: "outer",
            // Closes, but on two distinct points: a line there and back, not
            // an area. `isClosed` accepts it; the point count is what refuses.
            geometry: [
              { lat: 21, lon: 79 },
              { lat: 21, lon: 79.1 },
              { lat: 21, lon: 79 },
            ],
          },
        ]),
      ),
    ).toThrow(/fewer than 3 points/);
  });
});

describe("tags that are absent rather than wrong", () => {
  const tagged = (tags: Record<string, string>): OverpassRelation => ({
    type: "relation",
    id: 7,
    tags,
    members: [
      {
        type: "way",
        role: "outer",
        geometry: [
          { lat: 21.0, lon: 79.0 },
          { lat: 21.0, lon: 79.1 },
          { lat: 21.1, lon: 79.1 },
          { lat: 21.0, lon: 79.0 },
        ],
      },
    ],
  });

  it("refuses a relation with no admin_level tag", () => {
    expect(() => parseRelation(tagged({ name: "Test" }))).toThrow(/absent/);
  });

  it("refuses a name that is only whitespace", () => {
    expect(() => parseRelation(tagged({ name: "   ", admin_level: "5" }))).toThrow(/no name/);
  });

  it("refuses a fractional admin_level rather than rounding it", () => {
    expect(() => parseRelation(tagged({ name: "Test", admin_level: "5.5" }))).toThrow(
      /not an integer/,
    );
  });
});

describe("a whole response, element by element", () => {
  it("skips an element that is not a relation", () => {
    // A `way` at the top level is not a boundary and must not be counted as
    // rejected either — it was never a candidate.
    const outcome = parseRelations([{ type: "way", id: 1 }]);
    expect(outcome.units).toHaveLength(0);
    expect(outcome.rejected).toHaveLength(0);
  });

  it("reports a rejected relation with the reason it was rejected for", () => {
    const outcome = parseRelations([
      { type: "relation", id: 9, tags: { name: "X", admin_level: "5" } },
    ]);
    expect(outcome.rejected[0]?.osmRelationId).toBe(9);
    expect(outcome.rejected[0]?.reason).toContain("no member ways");
  });
});
