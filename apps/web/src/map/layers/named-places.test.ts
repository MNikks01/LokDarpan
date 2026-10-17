import { describe, expect, it } from "vitest";

import type { NamedPlace } from "@lokdarpan/domain";

import { DEFAULT_LAYERS } from "./visibility";
import { NAMED_PLACES_SOURCE, namedPlaceFeatures, namedPlaces } from "./named-places";
import type { MapInput } from "./types";

const gadchiroli: NamedPlace = {
  unitId: 512,
  name: "Gadchiroli",
  level: "district",
  point: [80.0, 19.8],
  pages: 23,
  reports: 4,
};

const input = (places: readonly NamedPlace[] | null): MapInput => ({
  stateCode: "27",
  stateOutlines: null,
  childBoundaries: null,
  activeGeometry: null,
  tenders: null,
  namedPlaces: places,
  visibility: DEFAULT_LAYERS,
});

describe("named places layer (ADR-077)", () => {
  it("draws one point per place, at the place's own point, keyed by its unit", () => {
    const fc = namedPlaceFeatures([gadchiroli]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]).toMatchObject({
      id: 512,
      geometry: { type: "Point", coordinates: [80.0, 19.8] },
      properties: { unitId: 512, name: "Gadchiroli", pages: 23, reports: 4 },
    });
    expect(namedPlaceFeatures(null).features).toEqual([]);
    expect(namedPlaces.data?.(input(null))[NAMED_PLACES_SOURCE]).toEqual(namedPlaceFeatures(null));
  });

  // "What is drawn is not what is ranked": a pin's look may not depend on how
  // many pages name the place.
  it("draws every pin the same, whatever its count", () => {
    const [circle] = namedPlaces.styleLayers({ withBasemap: true });
    expect(JSON.stringify(circle?.spec.paint)).not.toMatch(/pages|reports/u);
  });

  it("says in words how many pages and reports name the place, and opens the place", () => {
    const props = { unitId: 512, name: "Gadchiroli", pages: 23, reports: 1 };
    expect(namedPlaces.hit?.describe(props)).toEqual({
      title: "Gadchiroli",
      subtitle: "Named on 23 pages of 1 report",
    });
    expect(namedPlaces.hit?.toSelection(props)).toEqual({ kind: "unit", id: 512 });
    expect(namedPlaces.hit?.toSelection({})).toBeNull();
    expect(namedPlaces.hit?.describe({})).toEqual({
      title: "",
      subtitle: "Named on 0 pages of 0 reports",
    });
  });

  it("names the CAG as its source only when it draws something", () => {
    expect(namedPlaces.provenance(input([gadchiroli])).map((s) => s.sourceId)).toEqual(["cag"]);
    expect(namedPlaces.provenance(input([]))).toEqual([]);
    expect(namedPlaces.provenance(input(null))).toEqual([]);
  });
});
