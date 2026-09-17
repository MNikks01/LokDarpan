import { describe, expect, it } from "vitest";

import {
  attributionFor,
  awaitingPermission,
  describeSources,
  licenceFor,
  mayRepublish,
} from "../src/source-licence";

describe("mayRepublish", () => {
  it("permits the sources whose terms permit reproduction outright", () => {
    expect(mayRepublish("lgd")).toBe(true);
    expect(mayRepublish("cag")).toBe(true);
  });

  // The finding this registry exists for. BEAMS supplies every monetary figure
  // the site renders, and its publisher requires permission first.
  it("withholds BEAMS, whose terms require written permission first", () => {
    expect(mayRepublish("beams")).toBe(false);
  });

  // The execution-half data exists and is reachable; NRIDA's terms forbid
  // republishing it, and forbid systematic downloading too.
  it("withholds PMGSY, whose terms forbid republication outright", () => {
    expect(mayRepublish("pmgsy")).toBe(false);
    expect(licenceFor("pmgsy")?.caveat).toContain("without NRIDA's prior written permission");
  });

  // Withholding a figure delays a reader; publishing one we had no right to
  // publish damages the standing the whole project rests on.
  it("refuses a source nobody has recorded terms for", () => {
    expect(mayRepublish("mahatenders")).toBe(false);
    expect(mayRepublish("")).toBe(false);
  });

  // Found while building source descriptors: every collected tender portal
  // publishes the BEAMS clause. Recording it withholds nothing by itself; the
  // tender path does not consult this registry yet (source-licences.md §5).
  it("records the tender portals as requiring permission, for any portal", () => {
    expect(mayRepublish("gepnic")).toBe(false);
    expect(mayRepublish("gepnic-kerala")).toBe(false);
    expect(licenceFor("gepnic-madhyaprades")?.caveat).toContain("written permission");
  });

  it("permits OpenStreetMap under its licence, and carries the share-alike condition", () => {
    expect(mayRepublish("openstreetmap-overpass")).toBe(true);
    expect(attributionFor("openstreetmap-overpass")).toBe("© OpenStreetMap contributors");
    expect(licenceFor("openstreetmap")?.caveat).toContain("same license");
  });

  it("does not let a hyphenated id borrow a licence it has no family for", () => {
    expect(licenceFor("mahatenders-portal")).toBeNull();
    expect(mayRepublish("cagx-reports")).toBe(false);
  });

  it("never reads a publisher's silence as consent", () => {
    expect(licenceFor("some-source-we-have-not-checked")).toBeNull();
    expect(mayRepublish("some-source-we-have-not-checked")).toBe(false);
  });
});

describe("attributionFor", () => {
  // Every source examined requires its source to be "prominently
  // acknowledged", so there is no correct way to render this material without
  // a credit line.
  it("names a publisher for every recorded source", () => {
    for (const id of ["lgd", "cag", "beams", "pmgsy"]) {
      expect(attributionFor(id).length, id).toBeGreaterThan(10);
    }
  });

  it("credits the body that published the material, not the platform", () => {
    expect(attributionFor("cag")).toContain("Comptroller and Auditor General");
    expect(attributionFor("lgd")).toContain("Ministry of Panchayati Raj");
    expect(attributionFor("beams")).toContain("Government of Maharashtra");
  });

  it("does not invent a credit for a source it does not know", () => {
    expect(attributionFor("unknown-source")).not.toContain("Government");
  });
});

describe("the registry itself", () => {
  // A licence with no link is an assertion. A reader checking our right to
  // publish must be able to read the same page we read.
  it("cites the page each licence was read from, and when", () => {
    for (const id of ["lgd", "cag", "beams", "pmgsy"]) {
      const licence = licenceFor(id);
      expect(licence?.termsUrl, id).toMatch(/^https:\/\/[a-z0-9.-]+\.gov\.in\//u);
      expect(licence?.verifiedOn, id).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    }
  });

  // Where a licence rests on an inference, the qualification travels with it
  // rather than living only in a document nobody rereads.
  it("carries the caveat on the two licences that rest on an inference", () => {
    expect(licenceFor("cag")?.caveat).toContain("office site");
    expect(licenceFor("beams")?.caveat).toContain("inference");
    expect(licenceFor("lgd")?.caveat).toBeNull();
  });

  it("lists what is held back, so an operator can act on it", () => {
    expect(awaitingPermission().map((l) => l.sourceId)).toEqual(["beams", "pmgsy", "gepnic"]);
  });
});

describe("describeSources", () => {
  it("states each source's terms as recorded, including when they require permission", () => {
    const [portal] = describeSources(["gepnic-kerala"]);
    expect(portal).toMatchObject({
      sourceId: "gepnic-kerala",
      republication: "permission_required",
      termsVerifiedOn: "2026-09-17",
    });
    expect(portal?.termsUrl).toContain("page=Disclaimer");
  });

  it("marks an unrecorded source unknown, never permitted", () => {
    const [unknown] = describeSources(["mahatenders"]);
    expect(unknown).toMatchObject({
      republication: "unknown",
      publisher: "Source not recorded",
      termsUrl: null,
    });
  });

  it("lists each source once", () => {
    expect(describeSources(["cag", "gepnic-kerala", "cag"]).map((d) => d.sourceId)).toEqual([
      "cag",
      "gepnic-kerala",
    ]);
  });
});
