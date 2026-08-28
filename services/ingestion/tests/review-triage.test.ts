import { describe, expect, it } from "vitest";

import { TRIAGE_ORDER, selfCheck, triage } from "../src/review/triage";

// 15.14 crore in paise, the figure used throughout these suites.
const CRORE_15_14 = "15140000000";

describe("selfCheck", () => {
  it("confirms a reading the sentence states once and only once", () => {
    expect(
      selfCheck({
        id: 1,
        rawText: "awarded for a contract value of ₹ 15.14 crore to the firm.",
        normalisedValue: CRORE_15_14,
      }).check,
    ).toBe("confirmed");
  });

  // A window centred on one match often catches its neighbours. The reading is
  // right, but a reviewer still has to decide which amount the claim is about.
  it("calls a reading ambiguous when the sentence states several amounts", () => {
    const checked = selfCheck({
      id: 2,
      rawText: "₹ 15.14 crore was sanctioned against an estimate of ₹ 20.00 crore.",
      normalisedValue: CRORE_15_14,
    });
    expect(checked.check).toBe("ambiguous");
    expect(checked.amountsInEvidence).toHaveLength(2);
  });

  // The defect worth finding: a stored value that appears nowhere in its own
  // evidence means the citation and the claim have come apart.
  it("flags a stored value that its evidence does not state", () => {
    expect(
      selfCheck({
        id: 3,
        rawText: "₹ 20.00 crore was sanctioned for the work.",
        normalisedValue: CRORE_15_14,
      }).check,
    ).toBe("mismatch");
  });

  it("flags a stored value whose evidence states no amount at all", () => {
    expect(
      selfCheck({
        id: 4,
        rawText: "The Department accepted the observation.",
        normalisedValue: CRORE_15_14,
      }).check,
    ).toBe("mismatch");
  });

  it("separates a candidate the source gave no unit for", () => {
    const checked = selfCheck({
      id: 5,
      rawText: "Total annual rent of ₹1,53,427 was paid.",
      normalisedValue: null,
    });
    expect(checked.check).toBe("no_value");
  });

  // The whole point of the Devanagari fix: the Marathi half must check the
  // same way the Latin half does, or half the corpus reads as unqualified.
  it("re-derives a Marathi figure by the unit its sentence states", () => {
    expect(
      selfCheck({
        id: 6,
        rawText: "एकूण यनधी ₹ 15.14 कोटी होता.",
        normalisedValue: CRORE_15_14,
      }).check,
    ).toBe("confirmed");
  });

  it("offers every amount the evidence states, for a reviewer to choose from", () => {
    const checked = selfCheck({
      id: 7,
      rawText: "₹ 15.14 crore against ₹ 20.00 crore and ₹ 2.00 lakh.",
      normalisedValue: CRORE_15_14,
    });
    expect(checked.amountsInEvidence).toHaveLength(3);
    expect(checked.amountsInEvidence).toContain(CRORE_15_14);
  });
});

describe("triage", () => {
  it("counts each partition", () => {
    const counts = triage([
      { id: 1, rawText: "of ₹ 15.14 crore.", normalisedValue: CRORE_15_14 },
      { id: 2, rawText: "₹ 20.00 crore.", normalisedValue: CRORE_15_14 },
      { id: 3, rawText: "₹1,53,427 paid.", normalisedValue: null },
    ]);
    expect(counts).toEqual({ confirmed: 1, ambiguous: 0, mismatch: 1, noValue: 1 });
  });

  it("counts nothing when there is nothing to review", () => {
    expect(triage([])).toEqual({ confirmed: 0, ambiguous: 0, mismatch: 0, noValue: 0 });
  });
});

describe("TRIAGE_ORDER", () => {
  // Confirming a reading arithmetic already agrees with is where a reviewer
  // adds least; working that group first is how mismatches never get reached.
  it("puts defects first and the already-agreed group last", () => {
    expect(TRIAGE_ORDER[0]).toBe("mismatch");
    expect(TRIAGE_ORDER[TRIAGE_ORDER.length - 1]).toBe("confirmed");
  });

  it("covers every verdict selfCheck can return", () => {
    expect([...TRIAGE_ORDER].sort()).toEqual(
      ["ambiguous", "confirmed", "mismatch", "no_value"].sort(),
    );
  });
});
