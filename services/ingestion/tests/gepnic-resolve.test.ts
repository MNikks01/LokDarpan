import { describe, expect, it } from "vitest";

import { districtKey } from "../src/gepnic/detail";
import {
  EMPTY_DIRECTORY,
  indexDirectory,
  placeKey,
  resolveDistrict,
  type TenderClues,
} from "../src/gepnic/resolve";

/** Three Tamil Nadu districts as the ledger names them, with made-up ids. */
const DISTRICTS: ReadonlyMap<string, number> = new Map([
  [districtKey("Viluppuram"), 1],
  [districtKey("Cuddalore"), 2],
  [districtKey("Kanniyakumari"), 3],
]);

const SHA = "d".repeat(64);

/** Rows shaped like the Department of Posts directory; the values are synthetic. */
const DIRECTORY = indexDirectory(SHA, [
  { pincode: "605602", officeName: "Manampoondi B.O", districtName: "VILLUPURAM" },
  { pincode: "605602", officeName: "Mugaiyur S.O", districtName: "VILLUPURAM" },
  // One pincode whose offices sit in two districts.
  { pincode: "607001", officeName: "Semmandalam B.O", districtName: "CUDDALORE" },
  { pincode: "607001", officeName: "Kandamangalam B.O", districtName: "VILLUPURAM" },
  // One office name in two districts.
  { pincode: "629001", officeName: "Kottaram B.O", districtName: "KANNIYAKUMARI" },
  { pincode: "605701", officeName: "Kottaram B.O", districtName: "VILLUPURAM" },
  // A district the ledger does not hold under this name.
  { pincode: "606001", officeName: "Kallakurichi H.O", districtName: "KALLAKURICHI" },
]);

const clues = (over: Partial<TenderClues>): TenderClues => ({
  districtName: null,
  districtSource: null,
  pincode: null,
  location: null,
  ...over,
});

describe("the order of resolution", () => {
  it("takes the district the tender names over anything inferred", () => {
    const result = resolveDistrict(
      clues({ districtName: "Cuddalore", districtSource: "chain_unit", pincode: "605602" }),
      DISTRICTS,
      DIRECTORY,
    );
    expect(result).toEqual({
      adminUnitId: 2,
      method: "chain_unit",
      confidence: 0.9,
      evidenceSha256: null,
      evidenceKey: null,
    });
  });

  it("falls to the pincode, recording the directory it was read from", () => {
    expect(resolveDistrict(clues({ pincode: "605602" }), DISTRICTS, DIRECTORY)).toEqual({
      adminUnitId: 1,
      method: "pincode",
      confidence: 0.6,
      evidenceSha256: SHA,
      evidenceKey: "605602",
    });
  });

  it("falls to the place name, weaker again", () => {
    expect(resolveDistrict(clues({ location: "MANAMPOONDI" }), DISTRICTS, DIRECTORY)).toMatchObject(
      {
        adminUnitId: 1,
        method: "place_name",
        confidence: 0.4,
        evidenceKey: "Manampoondi",
      },
    );
  });

  it("goes on to the place name when the pincode cannot decide", () => {
    expect(
      resolveDistrict(clues({ pincode: "607001", location: "Mugaiyur" }), DISTRICTS, DIRECTORY),
    ).toMatchObject({ adminUnitId: 1, method: "place_name" });
  });
});

describe("an inference must be unanimous and within the state", () => {
  it("places nothing from a pincode whose offices sit in two districts", () => {
    expect(resolveDistrict(clues({ pincode: "607001" }), DISTRICTS, DIRECTORY).adminUnitId).toBe(
      null,
    );
  });

  it("places nothing from a place name that is an office in two districts", () => {
    expect(
      resolveDistrict(clues({ location: "Kottaram" }), DISTRICTS, DIRECTORY).adminUnitId,
    ).toBeNull();
  });

  it("places nothing in a district the ledger does not hold", () => {
    expect(
      resolveDistrict(clues({ pincode: "606001" }), DISTRICTS, DIRECTORY).adminUnitId,
    ).toBeNull();
  });

  it("infers nothing at all when no directory is loaded", () => {
    expect(
      resolveDistrict(clues({ pincode: "605602" }), DISTRICTS, EMPTY_DIRECTORY).adminUnitId,
    ).toBeNull();
  });

  it("ignores what is not a pincode, and a location too short to mean a place", () => {
    for (const pincode of ["60560", "005602", "605 602", "NA"]) {
      expect(resolveDistrict(clues({ pincode }), DISTRICTS, DIRECTORY).adminUnitId).toBeNull();
    }
    const tiny = indexDirectory(SHA, [
      { pincode: "605603", officeName: "Ulur B.O", districtName: "VILLUPURAM" },
    ]);
    expect(resolveDistrict(clues({ location: "Ulur" }), DISTRICTS, tiny).adminUnitId).toBeNull();
  });
});

describe("a place name", () => {
  it("loses the office's grade and its spelling noise, but keeps its vowels", () => {
    expect(placeKey("Manampoondi B.O")).toBe(placeKey("MANAMPOONDI"));
    expect(placeKey("Kallakurichi H.O")).toBe(placeKey("Kallakurichi"));
    expect(placeKey("Chennai GPO")).toBe(placeKey("Chennai"));
    // Kept apart where the district key would join them.
    expect(placeKey("Pune")).not.toBe(placeKey("Panna"));
  });
});
