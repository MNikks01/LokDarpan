import { describe, expect, it } from "vitest";

import {
  bareName,
  gazetteerOf,
  parsePlaceValue,
  placesIn,
  placeValue,
  type GazetteerEntry,
} from "../src/cag/places";

const STATE: GazetteerEntry[] = [
  { name: "Nagpur", level: "district" },
  { name: "Ahilyanagar District", level: "district" },
  { name: "Mumbai Suburban District", level: "district" },
  { name: "Gadchiroli", level: "district" },
  { name: "Mul", level: "sub_district" },
  { name: "Karjat", level: "sub_district" },
  { name: "Karjat", level: "sub_district" },
  { name: "Nagpur", level: "sub_district" },
  { name: "Sindewahi", level: "sub_district" },
  { name: "Andheri", level: "sub_district" },
];

const page = (content: string, pageNumber = 4) => [{ pageNumber, content }];
const values = (content: string): (string | null)[] =>
  placesIn(page(content), gazetteerOf(STATE)).map((c) => c.normalisedValue);

describe("gazetteerOf", () => {
  const kept = gazetteerOf(STATE);
  const has = (name: string, level: string): boolean =>
    kept.some((e) => e.name === name && e.level === level);

  it("drops the word District that OpenStreetMap adds to some names", () => {
    expect(bareName("Ahilyanagar District")).toBe("Ahilyanagar");
    expect(has("Ahilyanagar", "district")).toBe(true);
  });

  it("skips a taluka another taluka shares a name with, a taluka named as a district, and short names", () => {
    expect(has("Karjat", "sub_district")).toBe(false);
    expect(has("Nagpur", "sub_district")).toBe(false);
    expect(has("Mul", "sub_district")).toBe(false);
    expect(has("Sindewahi", "sub_district")).toBe(true);
  });

  it("tries the longest names first", () => {
    expect(kept[0]?.name).toBe("Mumbai Suburban");
  });
});

describe("placesIn", () => {
  it("names a district and an unambiguous taluka, once each per page", () => {
    expect(
      values(
        "The work in Sindewahi taluka of Gadchiroli district was delayed. Gadchiroli again.",
      ).sort(),
    ).toEqual(["Gadchiroli district", "Sindewahi taluka"]);
  });

  it("reads capitals and Title Case, never the lower-case word", () => {
    expect(values("NAGPUR DIVISION")).toEqual(["Nagpur district"]);
    expect(values("the nagpur office")).toEqual([]);
  });

  it("does not read a shorter place inside a longer name already matched", () => {
    expect(values("Hospitals in Mumbai Suburban were inspected.")).toEqual([
      "Mumbai Suburban district",
    ]);
  });

  it("matches whole words only", () => {
    expect(values("Nagpurkar Road")).toEqual([]);
  });

  it("proposes a place again on another page", () => {
    const found = placesIn(
      [
        { pageNumber: 1, content: "Nagpur." },
        { pageNumber: 2, content: "Nagpur." },
        { pageNumber: 3, content: null },
      ],
      gazetteerOf(STATE),
    );
    expect(found.map((c) => c.pageNumber)).toEqual([1, 2]);
    expect(found[0]?.kind).toBe("place_reference");
  });

  it("proposes nothing when the state holds no places", () => {
    expect(placesIn(page("Nagpur district."), [])).toEqual([]);
  });
});

describe("placeValue and parsePlaceValue", () => {
  it("round-trip a district and a taluka", () => {
    expect(parsePlaceValue(placeValue("Gadchiroli", "district"))).toEqual({
      name: "Gadchiroli",
      level: "district",
    });
    expect(parsePlaceValue(" Sindewahi Taluka ")).toEqual({
      name: "Sindewahi",
      level: "sub_district",
    });
  });

  it("refuses a value that names no level, or no place", () => {
    expect(parsePlaceValue("Gadchiroli")).toBeNull();
    expect(parsePlaceValue(" district")).toBeNull();
  });
});
