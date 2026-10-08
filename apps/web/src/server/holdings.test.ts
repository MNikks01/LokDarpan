import { describe, expect, it } from "vitest";

import type { Decide } from "@lokdarpan/domain";
import type { UnitHoldingsInputs } from "@lokdarpan/database/holdings";

import { holdingsOf } from "./holdings";

const closed: Decide = (id) =>
  id === "cag" || id.startsWith("openstreetmap")
    ? { publishable: true, basis: "terms_permit" }
    : { publishable: false, reason: "permission_not_granted" };

const district: UnitHoldingsInputs = {
  unitId: 3599,
  level: "district",
  state: { unitId: 20, name: "Maharashtra", lgdCode: "27" },
  boundaries: [
    { level: "sub_district", held: 14, coverage: null },
    { level: "urban_local_body", held: 0, coverage: null },
  ],
  audit: { held: 10, lastAt: null, filedUnder: { unitId: 20, name: "Maharashtra" } },
  budget: { held: 33, lastAt: null, filedUnder: { unitId: 20, name: "Maharashtra" } },
  tenders: {
    status: "not_collected",
    portalCode: null,
    collectingSince: null,
    lastSuccessAt: null,
    lastCheckedAt: null,
  },
};

describe("holdingsOf", () => {
  it("lists places below, then records kept by state, then works, always all of them", () => {
    expect(
      holdingsOf(district, closed).map((h) => `${h.layer}${h.level === null ? "" : `:${h.level}`}`),
    ).toEqual([
      "boundaries:sub_district",
      "boundaries:urban_local_body",
      "audit_reports",
      "tenders",
      "budget",
      "works",
    ]);
  });

  it("files tender collection under the state, as the other state-kept records are", () => {
    const tenders = holdingsOf(district, closed).find((h) => h.layer === "tenders");
    expect(tenders?.filedUnder).toEqual({ unitId: 20, name: "Maharashtra" });
  });

  it("takes showing from the gate it is given", () => {
    const budget = holdingsOf(district, closed).find((h) => h.layer === "budget");
    expect(budget?.showing).toBe("withheld");
    const open = holdingsOf(district, () => ({ publishable: true, basis: "grant_recorded" }));
    expect(open.find((h) => h.layer === "budget")?.count).toBe(33);
  });

  it("lists only boundaries and works above state level, where nothing is filed", () => {
    const country = holdingsOf(
      {
        ...district,
        level: "country",
        state: null,
        audit: null,
        budget: null,
        tenders: null,
        boundaries: [],
      },
      closed,
    );
    expect(country.map((h) => h.layer)).toEqual(["works"]);
  });
});
