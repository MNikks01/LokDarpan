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

describe("a reviewed alias", () => {
  const ALIASES = new Map([
    [
      districtKey("Muktsar"),
      { adminUnitId: 9, alias: "Muktsar", districtName: "Sri Muktsar Sahib" },
    ],
  ]);

  it("places a district the chain names by another name, and says which", () => {
    const result = resolveDistrict(
      clues({ districtName: "Muktsar", districtSource: "chain_unit" }),
      DISTRICTS,
      EMPTY_DIRECTORY,
      { aliases: ALIASES },
    );
    expect(result).toEqual({
      adminUnitId: 9,
      method: "chain_unit",
      confidence: 0.9,
      evidenceSha256: null,
      evidenceKey: "alias:Muktsar → Sri Muktsar Sahib",
    });
  });

  it("gives way to the ledger's own spelling, and does nothing unapproved", () => {
    // A name the ledger holds is never read through an alias.
    expect(
      resolveDistrict(
        clues({ districtName: "Cuddalore", districtSource: "chain_unit" }),
        DISTRICTS,
        EMPTY_DIRECTORY,
        { aliases: ALIASES },
      ).evidenceKey,
    ).toBeNull();
    // Without the alias, the same chain places nothing.
    expect(
      resolveDistrict(
        clues({ districtName: "Muktsar", districtSource: "chain_unit" }),
        DISTRICTS,
        EMPTY_DIRECTORY,
      ).adminUnitId,
    ).toBeNull();
  });
});

describe("a district the location names", () => {
  const NAMES: ReadonlyMap<string, string> = new Map(
    ["Viluppuram", "Cuddalore", "Kanniyakumari"].map((n) => [districtKey(n), n]),
  );
  const extras = { districtNames: NAMES };

  it("places a tender whose location names one district, quoting what it read", () => {
    expect(
      resolveDistrict(clues({ location: "Cuddalore" }), DISTRICTS, EMPTY_DIRECTORY, extras),
    ).toEqual({
      adminUnitId: 2,
      method: "location_district",
      confidence: 0.7,
      evidenceSha256: null,
      evidenceKey: "Cuddalore",
    });
  });

  it("reads a spelling variant of a long name, and a district among other words", () => {
    expect(
      resolveDistrict(clues({ location: "Villupuram" }), DISTRICTS, EMPTY_DIRECTORY, extras)
        .adminUnitId,
    ).toBe(1);
    expect(
      resolveDistrict(
        clues({ location: "Block Office, Kanniyakumari" }),
        DISTRICTS,
        EMPTY_DIRECTORY,
        extras,
      ).adminUnitId,
    ).toBe(3);
  });

  it("places nothing from a location naming two districts, or a short look-alike", () => {
    expect(
      resolveDistrict(
        clues({ location: "Cuddalore, Viluppuram" }),
        DISTRICTS,
        EMPTY_DIRECTORY,
        extras,
      ).adminUnitId,
    ).toBeNull();
    const short = new Map([[districtKey("Siang"), "Siang"]]);
    expect(
      resolveDistrict(
        clues({ location: "Singa" }),
        new Map([[districtKey("Siang"), 9]]),
        EMPTY_DIRECTORY,
        { districtNames: short },
      ).adminUnitId,
    ).toBeNull();
  });

  it("places nothing when a second district hides inside a longer piece", () => {
    // Production, 2026-09-29: "Rangpo, Kitchudumra Namchi, Gyalshing, Kewzing"
    // spans Namchi and Gyalshing, and piece by piece was placed in Gyalshing.
    const sikkim = new Map(["Gyalshing", "Namchi"].map((n) => [districtKey(n), n]));
    const ids = new Map([
      [districtKey("Gyalshing"), 1],
      [districtKey("Namchi"), 2],
    ]);
    expect(
      resolveDistrict(
        clues({ location: "Rangpo,Kitchudumra Namchi, Gyalshing, Kewzing" }),
        ids,
        EMPTY_DIRECTORY,
        { districtNames: sikkim },
      ).adminUnitId,
    ).toBeNull();
    // A word may refuse a placement but never make one: a district named only
    // inside a longer piece is left for review.
    expect(
      resolveDistrict(clues({ location: "Kitchudumra Namchi" }), ids, EMPTY_DIRECTORY, {
        districtNames: sikkim,
      }).adminUnitId,
    ).toBeNull();
  });

  it("comes after the chain and before the pincode", () => {
    // The chain names Cuddalore; the location names Viluppuram. The chain wins.
    expect(
      resolveDistrict(
        clues({ districtName: "Cuddalore", districtSource: "chain_unit", location: "Viluppuram" }),
        DISTRICTS,
        DIRECTORY,
        extras,
      ).method,
    ).toBe("chain_unit");
    // The pincode points at Viluppuram; the location names Cuddalore. The location wins.
    expect(
      resolveDistrict(
        clues({ pincode: "605602", location: "Cuddalore" }),
        DISTRICTS,
        DIRECTORY,
        extras,
      ),
    ).toMatchObject({ adminUnitId: 2, method: "location_district" });
  });
});
