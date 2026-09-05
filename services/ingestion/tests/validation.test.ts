import { describe, expect, it } from "vitest";

import { FIELDS, validate, type Reading } from "../src/cag/validation";

/**
 * The rules are narrow on purpose, and every narrowing here was forced by a
 * figure the ledger had already published. A rule that reads a real amount as a
 * threshold suppresses a government number — the failure this module exists to
 * avoid, pointed the other way.
 */

const reading = (evidence: string, figure: string): Reading => {
  const at = evidence.indexOf(figure);
  if (at < 0) throw new Error(`"${figure}" is not in the evidence`);
  return { kind: "monetary_amount", evidence, at, length: figure.length };
};

const stateOf = (evidence: string, figure: string): string =>
  validate(reading(evidence, figure)).state;

describe("a field declares how carefully it must be read", () => {
  it("treats money as critical and names why", () => {
    expect(FIELDS.monetary_amount.critical).toBe(true);
    expect(FIELDS.monetary_amount.note).toContain("publishes");
  });

  it("does not treat a name as critical, because a name is never published", () => {
    expect(FIELDS.contractor_reference.critical).toBe(false);
    expect(FIELDS.officer_role_reference.critical).toBe(false);
  });

  it("leaves a non-critical reading to the reviewer without comment", () => {
    const r: Reading = {
      kind: "contractor_reference",
      evidence: "M/s A per unit",
      at: 4,
      length: 3,
    };
    expect(validate(r).state).toBe("needs_review");
  });
});

describe("a rate carries its denominator or is refused", () => {
  // This changed with ADR-044 and migration 0020. A rate used to be refused
  // outright, because the ledger had nowhere to put what it was per. It now has
  // one, so the test is no longer "is a rate rejected" but "can it say what it
  // is per" — and only then may it be offered.
  it.each([
    ["financial assistance of ₹ 2,000 per beneficiary was paid", "₹ 2,000", "beneficiary"],
    ["dues of ₹ 250 per tenement per month were outstanding", "₹ 250", "tenement per month"],
    ["a benefit of ₹ 1,500 per month reached the account", "₹ 1,500", "month"],
  ])("offers %o for review, carrying its unit", (evidence, figure, unit) => {
    const at = evidence.indexOf(figure);
    const verdict = validate({ kind: "monetary_amount", evidence, at, length: figure.length });
    expect(verdict.state).toBe("needs_review");
    expect(verdict.perUnit).toBe(unit);
  });

  it.each([
    ["the amounts were paid at the rate of ₹ 60,000 to each student", "₹ 60,000"],
    ["cost of the card system per meal was ₹ 5.64 including GST", "₹ 5.64"],
  ])("refuses %o, whose denominator cannot be read forward", (evidence, figure) => {
    expect(stateOf(evidence, figure)).toBe("rejected");
  });

  it("keeps the total in a sentence that states both a total and a rate", () => {
    // "₹104.87 crore at the rate of ₹4,661 per kit" holds a sum and a rate. A
    // window-wide search calls both rates and throws away the sum.
    const evidence = "supply order (₹ 104.87 crore at the rate of ₹ 4,661 per kit) was placed";
    const total = validate({
      kind: "monetary_amount",
      evidence,
      at: evidence.indexOf("₹ 104.87"),
      length: "₹ 104.87".length,
    });
    expect(total.state).toBe("needs_review");
    expect(total.perUnit).toBeUndefined();

    const rate = validate({
      kind: "monetary_amount",
      evidence,
      at: evidence.indexOf("₹ 4,661"),
      length: "₹ 4,661".length,
    });
    expect(rate.perUnit).toBe("kit");
  });
});

describe("a threshold in a rule is not a sum anyone paid", () => {
  it.each([
    ["works valuing more than ₹ 5.00 crore need pre-qualification", "₹ 5.00"],
    ["schemes with less than ₹ 400 crore of assistance were sampled", "₹ 400"],
    ["a work order of value not less than ₹ 80 crore is required", "₹ 80"],
    ["a work valuing not more than ₹ 50 lakh may be sanctioned", "₹ 50"],
    ["provisions (₹ 10 crore or more in each case) proved unnecessary", "₹ 10"],
    ["procurement of goods of estimated value of ₹ 25 lakh and above", "₹ 25"],
  ])("rejects %s", (evidence, figure) => {
    expect(stateOf(evidence, figure)).toBe("rejected");
  });

  it.each([
    ["285 medical equipment costing ₹ 68.55 crore were delivered", "₹ 68.55"],
    ["11,157.83 square meters valuing ₹ 29.51 crore were handed over", "₹ 29.51"],
    ["undischarged liabilities exceeding ₹ 27,184 crore were observed", "₹ 27,184"],
    ["the balance of ₹ 0.31 crore (₹ 4.00 crore less ₹ 3.69 crore) was unspent", "₹ 0.31"],
    ["the balance of ₹ 0.31 crore (₹ 4.00 crore less ₹ 3.69 crore) was unspent", "₹ 4.00"],
    ["a challan showing remittance of ₹ 2.33 crore after retaining ₹ 0.02 crore", "₹ 0.02"],
  ])("leaves alone the published figure %s", (evidence, figure) => {
    // Each of these was published, and an earlier draft of the rules rejected
    // it. "valuing" and "costing" describe what a thing was worth; "exceeding"
    // describes a quantity as often as it bounds one; and bare "less" matched a
    // subtraction.
    expect(stateOf(evidence, figure)).toBe("needs_review");
  });
});

describe("a multiplicand is the price of one unit", () => {
  it("rejects the price between the count and the product", () => {
    const evidence = "A. EWS: 124 tenements × ₹ 14,70,219 = ₹ 18,23,07,156; B. LIG";
    expect(stateOf(evidence, "₹ 14,70,219")).toBe("rejected");
  });

  it("keeps the product the sentence computes", () => {
    const evidence = "A. EWS: 124 tenements × ₹ 14,70,219 = ₹ 18,23,07,156; B. LIG";
    expect(stateOf(evidence, "₹ 18,23,07,156")).toBe("needs_review");
  });
});

describe("an illustration is not a figure anyone reported", () => {
  it("rejects a worked example of a formula", () => {
    const evidence = "For original PAC of ₹ 100 Formula to be applied = 90 per cent";
    expect(stateOf(evidence, "₹ 100")).toBe("rejected");
  });
});

describe("a refusal always says why", () => {
  it("gives a reason a reviewer can act on", () => {
    const verdict = validate(reading("assistance of ₹ 2,000 per beneficiary", "₹ 2,000"));
    expect(verdict.state).toBe("rejected");
    expect(verdict.reason.length).toBeGreaterThan(20);
  });

  it("says nothing when it has nothing to say", () => {
    const verdict = validate(reading("a sum of ₹ 40.80 crore was released", "₹ 40.80"));
    expect(verdict.state).toBe("needs_review");
    expect(verdict.reason).toBe("");
  });
});

describe("a rate is publishable exactly when it can say what it is per", () => {
  const unitFor = (evidence: string, figure: string): string | null | undefined => {
    const at = evidence.indexOf(figure);
    return validate({ kind: "monetary_amount", evidence, at, length: figure.length }).perUnit;
  };

  it.each([
    ["a financial benefit of ₹ 1,500 per month through DBT", "₹ 1,500", "month"],
    ["₹5,000 per annum for medical students", "₹5,000", "annum"],
    ["a fee of ₹15 per record was charged for downloads", "₹15", "record"],
    ["prescribed ₹ 48 per IPD patient per day for food", "₹ 48", "IPD patient per day"],
    ["recovery of ₹ 65 per Cu.M. of the quantity", "₹ 65", "Cu.M."],
    ["the rate of Guarantee fee is ₹ 2 per ₹100 of the amount", "₹ 2", "₹100"],
  ])("reads the denominator of %o", (evidence, figure, expected) => {
    expect(unitFor(evidence, figure)).toBe(expected);
  });

  it.each([
    // The sentence resumes; the unit is one word, not a clause.
    ["a benefit of ₹ 1,500 per month since April was paid", "₹ 1,500", "month"],
    ["₹ 100 per annum electricity charges were levied", "₹ 100", "annum"],
    ["at ₹ 16,000 per sqm x 80% of the area", "₹ 16,000", "sqm"],
    ["₹ 4,661 per kit plus GST was ordered", "₹ 4,661", "kit"],
    ["Breakfast @ ₹ 3 per beneficiary Quantity in grams", "₹ 3", "beneficiary"],
  ])("stops where the unit stops in %o", (evidence, figure, expected) => {
    expect(unitFor(evidence, figure)).toBe(expected);
  });

  it("refuses a unit the evidence window cut off", () => {
    // "₹100 per Cu…" is "per Cu.M." on the page, and Cu is not a cubic metre. A
    // denominator that cannot be seen to end is not read, and the figure is
    // refused rather than published per a fragment.
    const evidence = "deduction at the rate of ₹ 100 per Cu";
    const at = evidence.indexOf("₹ 100");
    const verdict = validate({ kind: "monetary_amount", evidence, at, length: "₹ 100".length });
    expect(verdict.perUnit).toBeUndefined();
    expect(verdict.state).toBe("rejected");
  });

  it("refuses a rate whose denominator sits where it cannot be read", () => {
    // "at the rate of ₹60,000" states a rate; which noun it is per lives
    // elsewhere in the sentence, and guessing would be inventing it.
    const evidence = "amounts were paid at the rate of ₹ 60,000 and ₹ 1.00 lakh for students";
    const at = evidence.indexOf("₹ 60,000");
    const verdict = validate({ kind: "monetary_amount", evidence, at, length: "₹ 60,000".length });
    expect(verdict.state).toBe("rejected");
    expect(verdict.perUnit).toBeUndefined();
  });

  it("leaves a plain amount without a denominator", () => {
    const evidence = "a sum of ₹ 40.80 crore was released to the department";
    const at = evidence.indexOf("₹ 40.80");
    expect(
      validate({ kind: "monetary_amount", evidence, at, length: "₹ 40.80".length }).perUnit,
    ).toBeUndefined();
  });
});
