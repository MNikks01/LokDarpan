import { describe, it, expect } from "vitest";
import { DEFAULT_LAYERS } from "@/map/layers/visibility";
import {
  EMPTY_EXPLORER_STATE,
  parseExplorerState,
  reconcile,
  reconcilePin,
  toQueryString,
  toSearchParams,
  type ExplorerState,
} from "./explorer-url";

/**
 * The URL is the shareable form of "where the reader is". These assertions are
 * what makes §17's promise real: copy the address, open it elsewhere, arrive at
 * the same place.
 */
const parse = (query: string): ReturnType<typeof parseExplorerState> =>
  parseExplorerState(new URLSearchParams(query));

describe("reading a shared link", () => {
  it("restores state, unit and open record", () => {
    const state = parse("state=27&unit=3621&doc=4");
    expect(state.geo.stateCode).toBe("27");
    expect(state.geo.unitId).toBe(3621);
    expect(state.selectedDocumentId).toBe(4);
  });

  it("reads a bare state without a unit", () => {
    expect(parse("state=27").geo).toEqual({ stateCode: "27", unitId: null });
  });

  it("is the empty selection when there is no query", () => {
    expect(parse("")).toEqual(EMPTY_EXPLORER_STATE);
  });
});

describe("a query string is untrusted input", () => {
  // These arrive from strangers' links and from hand-edited addresses. A junk
  // id must not become a fetch for unit NaN, which reads as a broken page
  // rather than as a bad link.
  it.each([
    ["unit=abc", "not a number"],
    ["unit=-3", "negative"],
    ["unit=0", "zero"],
    ["unit=3.5", "fractional"],
    ["unit=", "empty"],
  ])("ignores a unit id that is %s", (query) => {
    expect(parse(query).geo.unitId).toBeNull();
  });

  it("ignores a malformed document id the same way", () => {
    expect(parse("doc=nonsense").selectedDocumentId).toBeNull();
  });

  it("takes the first value when a key is repeated", () => {
    // A repeated key is a malformed link, not a multi-select.
    expect(toSearchParams({ state: ["27", "12"] }).get("state")).toBe("27");
  });

  it("ignores a key with no value at all", () => {
    expect(toSearchParams({ state: undefined }).has("state")).toBe(false);
  });
});

describe("writing the link back", () => {
  it("round-trips a full selection", () => {
    const original = parse("state=27&unit=3621&doc=4");
    expect(parse(toQueryString(original))).toEqual(original);
  });

  it("leaves a plain /explore clean rather than carrying empty keys", () => {
    expect(toQueryString(EMPTY_EXPLORER_STATE)).toBe("");
  });

  it("omits a unit that is not selected", () => {
    const query = toQueryString({
      geo: { stateCode: "27", unitId: null },
      selectedDocumentId: null,
      layers: DEFAULT_LAYERS,
      department: null,
      pinnedVersion: null,
    });
    expect(query).toBe("state=27");
  });

  it("carries the unit as a ledger id, not a registry code", () => {
    // Nagpur is 484 in LGD and 505 in the Census extract, so "the district
    // code" would be ambiguous. A ledger id names exactly one row.
    const query = toQueryString({
      geo: { stateCode: "27", unitId: 3599 },
      selectedDocumentId: null,
      layers: DEFAULT_LAYERS,
      department: null,
      pinnedVersion: null,
    });
    expect(query).toContain("unit=3599");
    expect(query).not.toContain("505");
  });
});

describe("a state and a unit in a different state are not a selection", () => {
  const selection = (stateCode: string | null, unitId: number | null): ExplorerState => ({
    ...EMPTY_EXPLORER_STATE,
    geo: { stateCode, unitId },
  });

  it("keeps a unit that sits in the selected state", () => {
    expect(reconcile(selection("27", 3599), "27")).toEqual(selection("27", 3599));
  });

  // The regression: ?state=27&unit=<a Kerala district> rendered the selector as
  // Maharashtra and framed the map on Kerala.
  it("drops a unit belonging to another state, keeping the state", () => {
    expect(reconcile(selection("27", 9999), "32")).toEqual(selection("27", null));
  });

  it("drops a unit that cannot be placed at all", () => {
    expect(reconcile(selection("27", 9999), null)).toEqual(selection("27", null));
  });

  // Dropping the state instead would move a reader who mistyped an id into a
  // different state without saying so.
  it("never replaces the selected state with the unit's own", () => {
    const result = reconcile(selection("27", 4242), "32");
    expect(result.geo.stateCode).toBe("27");
  });

  it("leaves a selection with no unit alone", () => {
    expect(reconcile(selection("27", null), null)).toEqual(selection("27", null));
  });

  it("leaves a selection with no state alone", () => {
    expect(reconcile(selection(null, 3599), "27")).toEqual(selection(null, 3599));
  });
});

describe("what a reader chose travels with the link (ADR-061)", () => {
  const base: ExplorerState = { ...EMPTY_EXPLORER_STATE, geo: { stateCode: "23", unitId: 5060 } };

  it("round-trips layers, department and a pinned version", () => {
    const original: ExplorerState = {
      ...base,
      layers: { states: false, areas: true, placeNames: false },
      department: "Rural Engineering Service",
      pinnedVersion: 18731,
    };
    expect(parse(toQueryString(original))).toEqual(original);
  });

  it("writes nothing for the default layers, so an ordinary link stays short", () => {
    expect(toQueryString(base)).toBe("state=23&unit=5060");
  });

  it("names every hidden layer with its own token", () => {
    const hidden = { ...base, layers: { states: false, areas: false, placeNames: false } };
    expect(toQueryString(hidden)).toContain("layers=none");
    expect(parse(toQueryString(hidden)).layers).toEqual(hidden.layers);
  });

  it("drops tokens it does not know, and falls back to the defaults when none are known", () => {
    expect(parse("layers=cb,zz").layers).toEqual({ states: false, areas: true, placeNames: false });
    expect(parse("layers=zz,qq").layers).toEqual(DEFAULT_LAYERS);
  });

  it("refuses a department that is blank or implausibly long", () => {
    expect(parse("dept=%20%20").department).toBeNull();
    expect(parse(`dept=${"x".repeat(201)}`).department).toBeNull();
  });

  it("reads only a positive integer as a version", () => {
    expect(parse("v=abc").pinnedVersion).toBeNull();
    expect(parse("v=-3").pinnedVersion).toBeNull();
    expect(parse("v=42").pinnedVersion).toBe(42);
  });

  it("drops a pin naming a version the ledger does not hold, and keeps one it does", () => {
    const pinned = { ...base, pinnedVersion: 99 };
    expect(reconcilePin(pinned, null).pinnedVersion).toBeNull();
    expect(reconcilePin(pinned, "2026-09-23T10:21:46.967Z").pinnedVersion).toBe(99);
  });
});
