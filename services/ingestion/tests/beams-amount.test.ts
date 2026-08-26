import { describe, expect, it } from "vitest";

import { AmountFormatError, thousandsToPaise } from "../src/beams/amount";

describe("thousandsToPaise", () => {
  // The conversion this module exists for. BEAMS publishes thousands of
  // rupees; reading them as rupees understates every figure 1000-fold.
  it("converts thousands to paise: 126579.000 is ₹12,65,79,000", () => {
    expect(thousandsToPaise("126579.000")).toBe(12_657_900_000n);
  });

  it("scales by exactly 100,000", () => {
    expect(thousandsToPaise("1")).toBe(100_000n); // ₹1,000
    expect(thousandsToPaise("1.000")).toBe(100_000n);
    expect(thousandsToPaise("0.001")).toBe(100n); // ₹1
    expect(thousandsToPaise("0.00001")).toBe(1n); // 1 paisa
  });

  it("is exact for a value that would lose precision as a float", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; this path never touches one.
    expect(thousandsToPaise("0.003")).toBe(300n);
    expect(thousandsToPaise("1234567890.123")).toBe(123_456_789_012_300n);
  });

  it("stays exact far beyond Number.MAX_SAFE_INTEGER", () => {
    const paise = thousandsToPaise("99999999999999.999");
    expect(paise).toBe(9_999_999_999_999_999_900n);
    expect(Number(paise)).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
  });

  // Missing is never zero.
  it("returns null for the ways BEAMS writes 'no figure'", () => {
    for (const absent of ["", "  ", "-", "--", "---", "NA", "N/A"]) {
      expect(thousandsToPaise(absent), `"${absent}"`).toBeNull();
    }
  });

  it("distinguishes a published zero from an absence", () => {
    expect(thousandsToPaise("0.000")).toBe(0n);
    expect(thousandsToPaise("--")).toBeNull();
  });

  it("handles negatives, which reappropriation uses", () => {
    expect(thousandsToPaise("-500.000")).toBe(-50_000_000n);
  });

  it("tolerates thousands separators", () => {
    expect(thousandsToPaise("1,234.500")).toBe(123_450_000n);
  });

  // Rounding here would invent precision the government did not claim.
  it("refuses sub-paise precision rather than rounding it away", () => {
    expect(() => thousandsToPaise("1.000001")).toThrow(AmountFormatError);
    expect(() => thousandsToPaise("1.000001")).toThrow(/sub-paise/i);
  });

  it("refuses anything that is not a number rather than guessing", () => {
    for (const bad of ["1.2.3", "12a", "₹500", "1 000", "NaN", "Infinity"]) {
      expect(() => thousandsToPaise(bad), `"${bad}"`).toThrow(AmountFormatError);
    }
  });
});

describe("thousandsToPaise — leading-zero and bare-fraction forms", () => {
  it("accepts a value with no whole part", () => {
    expect(thousandsToPaise("0.5")).toBe(50_000n);
  });

  it("accepts a negative with a fraction", () => {
    expect(thousandsToPaise("-0.001")).toBe(-100n);
  });
});
