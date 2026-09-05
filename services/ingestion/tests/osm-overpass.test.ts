import { describe, it, expect } from "vitest";
import {
  OSM_ATTRIBUTION,
  OSM_LICENCE,
  boundariesInRelationQuery,
  findRelationQuery,
  slotDelayMs,
  readElements,
  type FetchedArtifact,
} from "../src/osm/overpass";

function artifact(body: string): FetchedArtifact {
  return {
    body,
    sha256: "0".repeat(64),
    retrievedAt: "2026-08-28T00:00:00.000Z",
    sourceUrl: "https://overpass.example.invalid/api",
    byteSize: body.length,
  };
}

describe("the query asks for only what is needed", () => {
  it("scopes to one relation and returns member geometry", () => {
    const query = boundariesInRelationQuery(1991091);
    expect(query).toContain("rel(1991091);map_to_area");
    // `out tags` alone would give names with no geometry, and ring assembly
    // needs the member ways' coordinates.
    expect(query).toContain("out geom;");
  });

  it("filters by admin level when levels are given", () => {
    // Without this, a state-wide query returns tens of thousands of villages
    // to display thirty-six districts — slow, and rude to a volunteer service.
    const query = boundariesInRelationQuery(1950884, [5]);
    expect(query).toContain('["admin_level"~"^(5)$"]');
  });

  it("asks for every level when none is given", () => {
    expect(boundariesInRelationQuery(1991091)).not.toContain("admin_level");
  });

  it("combines several levels into one alternation", () => {
    expect(boundariesInRelationQuery(1, [5, 6, 8])).toContain('"^(5|6|8)$"');
  });

  it("strips quotes from a name rather than letting it end the string", () => {
    // A name is interpolated into Overpass QL. Quotes would break out of the
    // literal, which is an injection into someone else's query language.
    const query = findRelationQuery('Nag"pur\\', 5);
    expect(query).toContain('"name"="Nagpur"');
    // Three key="value" pairs and nothing more: no quote survived from the name.
    expect(query.match(/"/g)?.length).toBe(12);
    expect(query).not.toContain("\\\\");
  });
});

describe("a response is untrusted until it parses", () => {
  it("reads the elements of a well-formed response", () => {
    expect(readElements(artifact('{"elements":[{"id":1}]}'))).toHaveLength(1);
  });

  it("refuses a response that is not JSON, rather than loading nothing quietly", () => {
    // Overpass answers overload with an HTML error page. Treating that as an
    // empty result would report a successful ingest of zero boundaries.
    expect(() => readElements(artifact("<html>rate limited</html>"))).toThrow(/not JSON/);
  });

  it("refuses JSON with no elements array", () => {
    expect(() => readElements(artifact('{"version":0.6}'))).toThrow(/elements/);
  });

  it("refuses a JSON literal that is not an object", () => {
    expect(() => readElements(artifact("null"))).toThrow(/elements/);
  });

  it("accepts an empty result, which is a real answer", () => {
    // "Nothing inside this relation" is a finding, not a failure.
    expect(readElements(artifact('{"elements":[]}'))).toHaveLength(0);
  });
});

describe("attribution travels with the data", () => {
  it("names the contributors and the licence the ingest must record", () => {
    expect(OSM_ATTRIBUTION).toContain("OpenStreetMap");
    expect(OSM_LICENCE).toContain("ODbL");
  });
});

/**
 * Overpass publishes its own availability. Guessing an interval instead is what
 * this replaced: ten seconds between districts got the client a 429 on the
 * eighth, because the limit is a small number of concurrent slots rather than a
 * rate, and a heavy query holds one for as long as it runs.
 */
describe("reading Overpass's status page", () => {
  it("proceeds at once when a slot is free", () => {
    const status = [
      "Connected as: 3834801528",
      "Current time: 2026-09-05T07:48:52Z",
      "Rate limit: 2",
      "2 slots available now.",
    ].join("\n");
    expect(slotDelayMs(status)).toBe(0);
  });

  it("waits for the soonest slot when none is free", () => {
    const status = [
      "Rate limit: 2",
      "Slot available after: 2026-09-05T07:50:12Z, in 39 seconds.",
      "Slot available after: 2026-09-05T07:51:02Z, in 89 seconds.",
    ].join("\n");
    // A second past the stated time, so the slot has actually opened.
    expect(slotDelayMs(status)).toBe(40_000);
  });

  // The page is generated between the slot freeing and the client reading it,
  // so the countdown can already have passed. Negative is "go now", not a wait
  // of minus one second.
  it("treats an elapsed countdown as no wait", () => {
    expect(slotDelayMs("Slot available after: 2026-09-05T07:50:12Z, in -3 seconds.")).toBe(1_000);
  });

  // Zero free slots is a wait, not a green light: the number is present, and the
  // naive read of "N slots available" would match it.
  it("does not read zero free slots as permission", () => {
    expect(slotDelayMs("0 slots available now.")).toBe(60_000);
  });

  // An unrecognised page is not permission to proceed at speed. The status
  // format carries no version, so a change to it must fail safe.
  it("waits conservatively when the page cannot be read", () => {
    expect(slotDelayMs("<html>maintenance</html>")).toBe(60_000);
  });
});
