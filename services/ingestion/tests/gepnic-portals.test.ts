import { describe, it, expect } from "vitest";

import { PORTALS, portalByCode } from "../src/gepnic/portals";

/**
 * Hosts whose `robots.txt` serves `Disallow: /`, verified 2026-08-29 and again
 * on 2026-09-01. Maharashtra runs GePNIC, so a filter on platform alone selects
 * it — the first generated draft of this table listed it under a comment
 * claiming it did not.
 */
const DISALLOWED = ["mahatenders.gov.in", "eproc.karnataka.gov.in"];

describe("the table cannot name a host we may not crawl", () => {
  it("lists no disallowed portal", () => {
    // The connector re-reads robots.txt on every run and would refuse these
    // anyway. This is the second lock: a table naming such a host invites
    // someone to try it and skip the check entirely.
    for (const portal of PORTALS) {
      for (const host of DISALLOWED) {
        expect(portal.baseUrl).not.toContain(host);
      }
    }
  });

  it("names Maharashtra nowhere, by any spelling", () => {
    // Phase 1's own state, and the one most likely to be added back by someone
    // who remembers it was the target and not why it was dropped.
    const table = JSON.stringify(PORTALS).toLowerCase();
    expect(table).not.toContain("maharashtra");
    expect(table).not.toContain("mahatenders");
  });
});

describe("every portal can actually be collected from", () => {
  it("carries a state code, because placement is scoped by state", () => {
    // Without it the district match runs against all 787 districts, where the
    // normalisation collapses Pune with Panna and Karnal with Kurnool.
    for (const portal of PORTALS) {
      expect(portal.stateLgdCode).toMatch(/^\d+$/);
    }
  });

  it("carries an https base URL with no trailing path", () => {
    // The connector appends `/nicgep/app`; a base that already ends there would
    // request a doubled path and get a 404 that looks like an empty portal.
    for (const portal of PORTALS) {
      expect(portal.baseUrl).toMatch(/^https:\/\//);
      expect(portal.baseUrl).not.toMatch(/\/$/);
      expect(portal.baseUrl).not.toContain("/nicgep");
    }
  });

  it("gives every portal a distinct code, state and host", () => {
    // Two portals sharing a code would silently collect one into the other's
    // rows, because `portal_code` is half the tender identity.
    expect(new Set(PORTALS.map((p) => p.code)).size).toBe(PORTALS.length);
    expect(new Set(PORTALS.map((p) => p.state)).size).toBe(PORTALS.length);
    expect(new Set(PORTALS.map((p) => p.baseUrl)).size).toBe(PORTALS.length);
  });

  it("holds the portal this connector was built and verified against", () => {
    const tn = portalByCode("tamilnadu");
    expect(tn?.stateLgdCode).toBe("33");
    expect(tn?.baseUrl).toBe("https://tntenders.gov.in");
  });

  it("has nothing to offer for a code it does not know", () => {
    expect(portalByCode("nowhere")).toBeUndefined();
  });
});
