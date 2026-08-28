import { describe, it, expect } from "vitest";
import {
  EMPTY_EXPLORER_STATE,
  parseExplorerState,
  toQueryString,
  toSearchParams,
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
    });
    expect(query).toBe("state=27");
  });

  it("carries the unit as a ledger id, not a registry code", () => {
    // Nagpur is 484 in LGD and 505 in the Census extract, so "the district
    // code" would be ambiguous. A ledger id names exactly one row.
    const query = toQueryString({
      geo: { stateCode: "27", unitId: 3599 },
      selectedDocumentId: null,
    });
    expect(query).toContain("unit=3599");
    expect(query).not.toContain("505");
  });
});
