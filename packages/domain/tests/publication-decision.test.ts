import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  mayRepublish,
  PERMISSION_GRANTS,
  publicationDecision,
  type PermissionGrant,
} from "../src/source-licence";

/**
 * A restricted source opens only on a recorded grant and an operator's switch
 * (ADR-073). These tests pin the order of the three checks and keep the grant
 * registry and the request registry describing the same world.
 */

const grant = (sourceId: string, issuer: string | null = null): PermissionGrant => ({
  sourceId,
  issuer,
  requestId: `test-${sourceId}`,
  grantedOn: "2027-01-15",
  reference: "TEST/REF/1",
  conditions: null,
});

describe("publicationDecision", () => {
  it("publishes a source whose terms permit it, with no grant or switch", () => {
    expect(publicationDecision("lgd")).toEqual({ publishable: true, basis: "terms_permit" });
    expect(publicationDecision("openstreetmap-overpass")).toEqual({
      publishable: true,
      basis: "terms_permit",
    });
  });

  it("withholds a source with no recorded terms, whatever else is supplied", () => {
    expect(
      publicationDecision("mahatenders", {
        grants: [grant("mahatenders")],
        switchedOn: new Set(["mahatenders"]),
      }),
    ).toEqual({ publishable: false, reason: "terms_unrecorded" });
  });

  it("withholds a restricted source with a switch but no grant", () => {
    expect(publicationDecision("beams", { switchedOn: new Set(["beams"]) })).toEqual({
      publishable: false,
      reason: "permission_not_granted",
    });
  });

  it("withholds a restricted source with a grant but no switch", () => {
    expect(publicationDecision("beams", { grants: [grant("beams")] })).toEqual({
      publishable: false,
      reason: "not_switched_on",
    });
  });

  it("publishes a restricted source with a grant and a switch", () => {
    expect(
      publicationDecision("beams", { grants: [grant("beams")], switchedOn: new Set(["beams"]) }),
    ).toEqual({ publishable: true, basis: "grant_recorded" });
  });

  it("resolves a collector id to its publisher before matching grants and switches", () => {
    const context = { grants: [grant("gepnic")], switchedOn: new Set(["gepnic"]) };
    expect(publicationDecision("gepnic-kerala", context).publishable).toBe(true);
  });

  it("honours a grant limited to one issuer only for that issuer", () => {
    const context = {
      grants: [grant("gepnic", "Public Works Department")],
      switchedOn: new Set(["gepnic"]),
    };
    expect(publicationDecision("gepnic-kerala", context).publishable).toBe(false);
    expect(
      publicationDecision("gepnic-kerala", { ...context, issuer: "Public Works Department" })
        .publishable,
    ).toBe(true);
  });

  it("leaves mayRepublish unchanged for every existing caller", () => {
    for (const id of ["lgd", "cag", "openstreetmap", "beams", "pmgsy", "gepnic-kerala", ""]) {
      expect(mayRepublish(id), id).toBe(publicationDecision(id).publishable);
    }
    expect(mayRepublish("beams")).toBe(false);
  });
});

/**
 * A grant in code and a `granted` request in the registry are two records of
 * one event. If they disagree, either a source is open on a permission nobody
 * can point to, or a permission that arrived is not being honoured.
 */
describe("the grant registry", () => {
  const registry = JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("../../../.docs/06-government-sources/permission-requests.json", import.meta.url),
      ),
      "utf8",
    ),
  ) as {
    readonly requests: readonly {
      readonly id: string;
      readonly request: { readonly status: string; readonly reference: string | null };
      readonly response: { readonly date: string | null };
    }[];
  };

  it("records a grant only for a request the registry marks granted, with its reference and date", () => {
    for (const g of PERMISSION_GRANTS) {
      const entry = registry.requests.find((r) => r.id === g.requestId);
      expect(entry, `${g.requestId} is in permission-requests.json`).toBeDefined();
      expect(entry?.request.status).toBe("granted");
      expect(entry?.request.reference).toBe(g.reference);
      expect(entry?.response.date).toBe(g.grantedOn);
    }
  });

  it("records every granted request as a grant", () => {
    const granted = registry.requests.filter((r) => r.request.status === "granted");
    for (const entry of granted) {
      expect(
        PERMISSION_GRANTS.some((g) => g.requestId === entry.id),
        `${entry.id} is granted in the registry but not recorded in PERMISSION_GRANTS`,
      ).toBe(true);
    }
  });

  it("is empty while no request has been sent", () => {
    // Remove this case when the first grant is recorded; the two above remain.
    expect(PERMISSION_GRANTS).toEqual([]);
  });
});
