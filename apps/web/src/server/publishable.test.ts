import type { PermissionGrant } from "@lokdarpan/domain";
import { afterEach, describe, expect, it } from "vitest";

import {
  decideFor,
  switchedOnSources,
  tenderDetailsArePublishable,
  treasuryFiguresArePublishable,
} from "./publishable";

/**
 * BEAMS and the GePNIC portals permit reproduction only after permission is
 * obtained. None has been sought, so their figures and details are withheld.
 *
 * The default matters more than any switch. A deployment that forgets to set
 * anything must withhold, and so must one that sets a switch with no grant
 * recorded: the failure that costs something is publishing material a source
 * did not permit — not hiding material it did (ADR-073).
 */

afterEach(() => {
  delete process.env["PUBLISH_BEAMS_FIGURES"];
  delete process.env["PUBLISH_TENDER_DETAILS"];
  delete process.env["PUBLISH_RESTRICTED_SOURCES"];
});

/** A grant as it would be recorded once received. Test-only; none exists. */
const grant = (sourceId: string, issuer: string | null = null): PermissionGrant => ({
  sourceId,
  issuer,
  requestId: `test-${sourceId}`,
  grantedOn: "2027-01-15",
  reference: "TEST/REF/1",
  conditions: null,
});

describe("treasury figures", () => {
  it("are withheld when nothing is configured", () => {
    expect(treasuryFiguresArePublishable()).toBe(false);
  });

  it("are withheld when switched on with no grant recorded", () => {
    // The rule CLAUDE.md states — never set the flag without a recorded
    // permission — is enforced here, not left to whoever sets the variable.
    process.env["PUBLISH_BEAMS_FIGURES"] = "true";
    expect(treasuryFiguresArePublishable()).toBe(false);
    expect(decideFor("beams")).toEqual({
      publishable: false,
      reason: "permission_not_granted",
    });
  });

  it("are withheld when a grant is recorded but nobody has switched them on", () => {
    expect(decideFor("beams", { grants: [grant("beams")] })).toEqual({
      publishable: false,
      reason: "not_switched_on",
    });
  });

  it("are published with a grant and a switch, read at call time", () => {
    const grants = [grant("beams")];
    expect(treasuryFiguresArePublishable(grants)).toBe(false);
    process.env["PUBLISH_BEAMS_FIGURES"] = "true";
    expect(treasuryFiguresArePublishable(grants)).toBe(true);
    expect(decideFor("beams", { grants })).toEqual({
      publishable: true,
      basis: "grant_recorded",
    });
  });

  it.each(["", "false", "0", "no", "TRUE", "True", "yes", "1"])(
    "treat the ambiguous flag value %o as off, even with a grant",
    (value) => {
      process.env["PUBLISH_BEAMS_FIGURES"] = value;
      expect(treasuryFiguresArePublishable([grant("beams")])).toBe(false);
    },
  );
});

describe("tender details", () => {
  it("are withheld when nothing is configured, and when switched on without a grant", () => {
    expect(tenderDetailsArePublishable()).toBe(false);
    process.env["PUBLISH_TENDER_DETAILS"] = "true";
    expect(tenderDetailsArePublishable()).toBe(false);
  });

  it("are not opened by another source's grant or switch", () => {
    process.env["PUBLISH_BEAMS_FIGURES"] = "true";
    process.env["PUBLISH_TENDER_DETAILS"] = "true";
    expect(tenderDetailsArePublishable([grant("beams")])).toBe(false);
  });

  it("open across all portals only for a grant covering the whole source", () => {
    process.env["PUBLISH_TENDER_DETAILS"] = "true";
    expect(tenderDetailsArePublishable([grant("gepnic", "Public Works Department")])).toBe(false);
    expect(tenderDetailsArePublishable([grant("gepnic")])).toBe(true);
  });

  it("open for one issuing department when its grant is limited to it", () => {
    process.env["PUBLISH_TENDER_DETAILS"] = "true";
    const grants = [grant("gepnic", "Public Works Department")];
    expect(decideFor("gepnic-kerala", { issuer: "Public Works Department", grants })).toEqual({
      publishable: true,
      basis: "grant_recorded",
    });
    expect(decideFor("gepnic-kerala", { issuer: "Water Resources Department", grants })).toEqual({
      publishable: false,
      reason: "permission_not_granted",
    });
  });
});

describe("switches", () => {
  it("are read from the per-source flags and from the general list", () => {
    const on = switchedOnSources({
      PUBLISH_BEAMS_FIGURES: "true",
      PUBLISH_RESTRICTED_SOURCES: " pmgsy, ,gepnic",
    });
    expect([...on].sort()).toEqual(["beams", "gepnic", "pmgsy"]);
  });

  it("open a newly granted source with no new variable", () => {
    process.env["PUBLISH_RESTRICTED_SOURCES"] = "pmgsy";
    expect(decideFor("pmgsy", { grants: [grant("pmgsy")] }).publishable).toBe(true);
  });

  it("make no difference to a source whose terms permit it", () => {
    expect(decideFor("cag")).toEqual({ publishable: true, basis: "terms_permit" });
  });

  it("never open a source with no recorded terms", () => {
    process.env["PUBLISH_RESTRICTED_SOURCES"] = "mahatenders";
    expect(decideFor("mahatenders", { grants: [grant("mahatenders")] })).toEqual({
      publishable: false,
      reason: "terms_unrecorded",
    });
  });
});
