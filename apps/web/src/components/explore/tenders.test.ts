import { describe, it, expect } from "vitest";
import type { FeatureCollection, Point } from "geojson";

import { groupRupees, withTenderCounts } from "./tenders";

describe("rupees are grouped without ever becoming a number", () => {
  it("groups the Indian way, not in thousands", () => {
    // 5,92,000 — lakh then thousand. Western grouping would print 592,000 and
    // read as a different magnitude to the reader this is built for.
    expect(groupRupees("592000.00")).toBe("5,92,000");
    expect(groupRupees("4500.00")).toBe("4,500");
    expect(groupRupees("12345678.00")).toBe("1,23,45,678");
  });

  it("leaves a figure below a thousand alone", () => {
    expect(groupRupees("999.00")).toBe("999");
    expect(groupRupees("0.00")).toBe("0");
  });

  it("drops a zero fraction but keeps a real one", () => {
    // ".00" on every figure is noise; ".50" is money.
    expect(groupRupees("100.00")).toBe("100");
    expect(groupRupees("100.50")).toBe("100.50");
  });

  it("keeps every digit of a figure a float would round", () => {
    // Beyond Number.MAX_SAFE_INTEGER. Parsing this to format it would lose the
    // tail silently, behind a correct-looking source link.
    // Last three digits, then pairs leftward — the grouping I got wrong by hand
    // writing this test, which is the argument for having it.
    expect(groupRupees("9007199254740993.00")).toBe("9,00,71,99,25,47,40,993");
  });
});

describe("counts ride along with the boundaries", () => {
  // A GeoJSON Feature needs a geometry; the shape is irrelevant to this merge.
  const POINT: Point = { type: "Point", coordinates: [0, 0] };

  const boundaries: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { unitId: 1, name: "Has tenders" }, geometry: POINT },
      { type: "Feature", properties: { unitId: 2, name: "Has none" }, geometry: POINT },
    ],
  };

  const counts = [{ adminUnitId: 1, districtName: "Has tenders", tenderCount: 3, departments: [] }];

  it("attaches a count to the district it belongs to", () => {
    expect(withTenderCounts(boundaries, counts)?.features[0]?.properties?.["tenderCount"]).toBe(3);
  });

  it("leaves a district with no tenders without the property, not with a zero", () => {
    // The style filters on `["has", "tenderCount"]`. A zero would be shaded the
    // palest colour and read as "we looked and found none", which forward-only
    // collection cannot support.
    const shaded = withTenderCounts(boundaries, counts);
    expect(shaded?.features[1]?.properties).not.toHaveProperty("tenderCount");
  });

  it("returns the boundaries untouched when no counts are held", () => {
    expect(withTenderCounts(boundaries, [])).toBe(boundaries);
  });

  it("has nothing to shade when there are no boundaries", () => {
    expect(withTenderCounts(null, [])).toBeNull();
  });
});
