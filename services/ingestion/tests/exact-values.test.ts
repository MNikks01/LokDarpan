import { describe, expect, it } from "vitest";

import { amountToPaise, extractFacts } from "../src/cag/facts";

/**
 * Adversarial tests for exact numerical preservation.
 *
 * The requirement these pin: a figure is stored as the source states it, to the
 * precision the source states it, or it is not stored at all. No rounding, no
 * truncation, no reconstruction of a digit the source did not clearly give.
 *
 * Values are paise. One rupee is 100 paise, so one thousand is 10^5, one lakh
 * 10^7 and one crore 10^9 paise. They are written here in full rather than
 * computed, because a test that derives its expectation the same way the code
 * does cannot catch the code being wrong.
 */

const money = (content: string): (string | null)[] =>
  extractFacts([{ pageNumber: 1, content }])
    .filter((f) => f.kind === "monetary_amount")
    .map((f) => f.normalisedValue);

describe("a figure keeps the precision the source gave it", () => {
  // The case the requirement names: ₹177.79 crore must not become 177, 178,
  // 177.7 or 177.8.
  it("preserves two decimal places in a crore figure", () => {
    expect(money("a sanction of ₹177.79 crore was made")).toEqual(["177790000000"]);
  });

  it("distinguishes .79 from .75 and from no fraction at all", () => {
    expect(money("₹177.79 crore")).toEqual(["177790000000"]);
    expect(money("₹177.75 crore")).toEqual(["177750000000"]);
    expect(money("₹177 crore")).toEqual(["177000000000"]);
  });

  // Truncating .79 loses ₹79 lakh; rounding it invents ₹21 lakh.
  it("never rounds and never truncates a fraction", () => {
    const exact = money("₹177.79 crore")[0];
    expect(exact).not.toBe("177000000000"); // truncated
    expect(exact).not.toBe("178000000000"); // rounded up
    expect(exact).not.toBe("177700000000"); // truncated to one place
    expect(exact).not.toBe("177800000000"); // rounded to one place
  });

  it("keeps precision finer than two places where paise can hold it", () => {
    // ₹1.2345 crore is 1,234,500,000 paise exactly — no rounding needed.
    expect(money("₹1.2345 crore")).toEqual(["1234500000"]);
    // And ₹1.234 thousand is ₹1,234 exactly: 123,400 paise.
    expect(amountToPaise("1.234", "thousand")).toBe(123400n);
  });

  // Refusing is the requirement's own policy: missing beats incorrect.
  //
  // The limit is the scale's own distance from paise: nine decimal places in
  // crore, seven in lakh, five in thousand, two in a figure written out in
  // rupees. It is checked at the scale the source states, so a figure that is
  // exactly representable is kept and only a genuinely sub-paise one is
  // refused.
  //
  // This was once checked at the thousands scale for every unit, because crore
  // was a multiplier over `thousandsToPaise`. That refused figures it could
  // represent exactly — "₹0.0000001 crore" is ₹1 — and, in the other direction,
  // truncated "₹1.234" to ₹1.23 on the way back down to rupees. Refusing too
  // much was defensible; the silent truncation was not.
  it("keeps every figure the stated scale can represent exactly", () => {
    // ₹1 exactly, at a scale where one paisa is 0.000000001.
    expect(amountToPaise("0.0000001", "crore")).toBe(100n);
    expect(amountToPaise("0.123456", "crore")).toBe(123456000n);
    expect(amountToPaise("1.2345", "crore")).toBe(1234500000n);
    expect(amountToPaise("0.0000001", "lakh")).toBe(1n);
  });

  it("refuses a figure finer than the stated scale, rather than rounding", () => {
    // One decimal place beyond each scale's reach.
    expect(amountToPaise("1.2345678901", "crore")).toBeNull();
    expect(amountToPaise("1.23456789", "lakh")).toBeNull();
    expect(amountToPaise("1.234567", "thousand")).toBeNull();
  });

  // The truncation this replaced: read as thousands and divided back down,
  // "1.234" rupees came out as 123 paise, losing the last digit in silence.
  it("refuses a sub-paise figure written out in rupees, rather than truncating it", () => {
    expect(amountToPaise("1.234", undefined, "rupees")).toBeNull();
    expect(amountToPaise("1.23", undefined, "rupees")).toBe(123n);
  });
});

describe("Indian numbering is read as written", () => {
  it.each([
    ["₹1,00,000 was paid", "10000000"],
    ["₹10,00,000 was paid", "100000000"],
    ["₹1,00,00,000 was paid", "1000000000"],
    ["₹25 lakh was paid", "250000000"],
    ["₹2.5 crore was paid", "2500000000"],
  ])("reads %s", (content, expected) => {
    expect(money(content)).toEqual([expected]);
  });

  // ₹15 lakh is an order of magnitude below ₹1.5 crore and must never collapse
  // into it. ₹1.5 crore and ₹150 lakh *are* the same amount, and both convert
  // to it — the unit each source used is preserved in `raw_text`, not in the
  // value, because they denote one quantity.
  it("keeps ₹15 lakh distinct from ₹1.5 crore", () => {
    expect(money("₹15 lakh")).toEqual(["150000000"]);
    expect(money("₹1.5 crore")).toEqual(["1500000000"]);
    expect(money("₹15 lakh")[0]).not.toBe(money("₹1.5 crore")[0]);
  });

  it("converts ₹150 lakh and ₹1.5 crore to the one amount they both denote", () => {
    expect(money("₹150 lakh")).toEqual(money("₹1.5 crore"));
  });
});

describe("an uncertain figure is refused, never reconstructed", () => {
  // Each of these is a real defect found in the corpus. The requirement's rule
  // is that none of them may be repaired into a confident value.
  it.each([
    ["a decimal split from its fraction", "CGF of ₹177. 75 crore was provided"],
    ["a unit misspelled beyond reading", "an increase of ₹ 24,918.53 core over the year"],
    ["a unit abbreviated beyond reading", "a loan of ₹ 7,700 cr in 2023-24"],
    ["a unit occurring too rarely to scale", "Loan amount Rs 283.9 Million"],
  ])("refuses %s", (_label, content) => {
    expect(money(content)).toEqual([null]);
  });

  it("does not treat a row number in a column header as an amount", () => {
    expect(money("No. Name of Institution Amount in ₹ 1 Academy of Nursing 33,000")).toEqual([]);
  });

  // An all-caps series code, not a currency marker.
  it("does not treat an audit report series code as an amount", () => {
    expect(money("GSS 12, 17 2015-16 37 10 RS 9, 16 2015-16 26 11 COPU 08,09")).toEqual([]);
  });

  it("does not read a figure out of an English plural", () => {
    expect(money("Parameters 2020-21 and Surrenders 2.5.4 are shown in the table")).toEqual([]);
  });
});

describe("a figure with no stated unit", () => {
  // Refusing on a page that declares a scale is what keeps a bare table cell
  // from being read as rupees when the caption says crore.
  it("is refused where the page declares a scale", () => {
    expect(money("Table 2.6 (₹ in crore) Sr. Grant ₹ 5376.31 total")).toEqual([null]);
  });

  // And read as rupees where the page declares none — the amount written out.
  it("is read as rupees where the page declares none", () => {
    expect(money("Total annual rent of ₹1,53,427 was paid.")).toEqual(["15342700"]);
  });
});
