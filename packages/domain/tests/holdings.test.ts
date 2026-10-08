import { describe, expect, it } from "vitest";

import {
  auditHolding,
  boundaryHolding,
  budgetHolding,
  holdingHeadline,
  tenderHolding,
  worksHolding,
  type Decide,
} from "../src/holdings";
import { publicationDecision } from "../src/source-licence";

/** The gate as it stands: no grant recorded, nothing switched on. */
const asRecorded: Decide = (id) => publicationDecision(id);
/** The gate with every source open, to show a row follows the gate and nothing else. */
const allOpen: Decide = () => ({ publishable: true, basis: "terms_permit" });

const maharashtra = { unitId: 20, name: "Maharashtra" };

describe("boundaryHolding", () => {
  const complete = {
    status: "complete" as const,
    note: null,
    sourceId: "openstreetmap-overpass",
    checkedAt: "2026-09-05T08:36:09Z",
  };

  it("says held, with a count, where units are held and the finding is complete", () => {
    const h = boundaryHolding({ level: "sub_district", held: 14, coverage: complete }, asRecorded);
    expect(holdingHeadline(h)).toBe("held");
    expect(h.count).toBe(14);
    expect(h.showing).toBe("shown");
  });

  it("says partial where the finding is partial, keeping its note", () => {
    const h = boundaryHolding(
      {
        level: "urban_local_body",
        held: 18,
        coverage: { ...complete, status: "partial", note: "18 of about 270." },
      },
      asRecorded,
    );
    expect(holdingHeadline(h)).toBe("partial");
    expect(h.state.note).toBe("18 of about 270.");
  });

  // A finding recorded against the state describes a load; it does not make
  // units appear in a ledger that holds none (production before LD-006).
  it("says not collected where none is held, whatever a finding claims", () => {
    const h = boundaryHolding({ level: "sub_district", held: 0, coverage: complete }, asRecorded);
    expect(holdingHeadline(h)).toBe("not_collected");
    expect(h.count).toBeNull();
    expect(h.showing).toBeNull();
  });

  it("says held with completeness unknown where units are held and nobody recorded a finding", () => {
    const h = boundaryHolding({ level: "district", held: 3, coverage: null }, asRecorded);
    expect(holdingHeadline(h)).toBe("held");
    expect(h.state.completeness).toBe("unknown");
  });
});

describe("auditHolding", () => {
  it("shows the count of reports the CAG's terms let us republish", () => {
    const h = auditHolding(
      { held: 30, lastAt: "2026-10-06T00:00:00Z", filedUnder: null },
      asRecorded,
    );
    expect(holdingHeadline(h)).toBe("held");
    expect(h.count).toBe(30);
    expect(h.state.lastSuccessAt).toBe("2026-10-06T00:00:00Z");
  });

  it("names the state a district's reports are filed under", () => {
    const h = auditHolding({ held: 30, lastAt: null, filedUnder: maharashtra }, asRecorded);
    expect(h.filedUnder).toEqual(maharashtra);
  });

  it("says not collected, never zero, for a state with no report", () => {
    const h = auditHolding({ held: 0, lastAt: null, filedUnder: null }, asRecorded);
    expect(holdingHeadline(h)).toBe("not_collected");
    expect(h.count).toBeNull();
  });
});

describe("budgetHolding", () => {
  // The case ADR-076 exists for: held, and the gate says no.
  it("says withheld, with no count, while BEAMS has no recorded permission", () => {
    const h = budgetHolding(
      { held: 33, lastAt: "2026-09-01T00:00:00Z", filedUnder: null },
      asRecorded,
    );
    expect(holdingHeadline(h)).toBe("withheld");
    expect(h.showing).toBe("withheld");
    expect(h.count).toBeNull();
  });

  it("follows the gate, and only the gate, when it opens", () => {
    const h = budgetHolding({ held: 33, lastAt: null, filedUnder: null }, allOpen);
    expect(holdingHeadline(h)).toBe("held");
    expect(h.count).toBe(33);
  });

  it("says not collected where no budget is held, which is not the same as withheld", () => {
    const h = budgetHolding({ held: 0, lastAt: null, filedUnder: null }, asRecorded);
    expect(holdingHeadline(h)).toBe("not_collected");
  });
});

describe("tenderHolding", () => {
  const collected = {
    status: "collected" as const,
    portalCode: "mahatenders",
    collectingSince: "2026-08-20",
    lastSuccessAt: "2026-10-08T01:00:00Z",
    lastCheckedAt: "2026-10-08T01:00:00Z",
  };

  it("shows counts only while the issuing departments' permission is not recorded", () => {
    const h = tenderHolding(collected, asRecorded);
    expect(holdingHeadline(h)).toBe("current");
    expect(h.showing).toBe("counts_only");
  });

  it("shows the details too once the gate opens them", () => {
    expect(tenderHolding(collected, allOpen).showing).toBe("shown");
  });

  it("keeps stale ahead of everything else, as the explorer does", () => {
    expect(holdingHeadline(tenderHolding({ ...collected, status: "stale" }, asRecorded))).toBe(
      "stale",
    );
  });

  it("says not collected for a state whose portal is not collected", () => {
    const h = tenderHolding(
      {
        status: "not_collected",
        portalCode: null,
        collectingSince: null,
        lastSuccessAt: null,
        lastCheckedAt: null,
      },
      asRecorded,
    );
    expect(holdingHeadline(h)).toBe("not_collected");
    expect(h.showing).toBeNull();
  });
});

describe("worksHolding", () => {
  it("says not collected, naming the register that may not be copied", () => {
    const h = worksHolding();
    expect(holdingHeadline(h)).toBe("not_collected");
    expect(h.state.sourceIds).toEqual(["pmgsy"]);
  });
});
