import { describe, it, expect } from "vitest";
import { Money } from "./index";

describe("Money.fromDecimalString", () => {
  it("parses whole and fractional rupees", () => {
    expect(Money.fromDecimalString("900000000.00").toPaise()).toBe(90_000_000_000n);
    expect(Money.fromDecimalString("0.01").toPaise()).toBe(1n);
    expect(Money.fromDecimalString("0.1").toPaise()).toBe(10n);
    expect(Money.fromDecimalString("12").toPaise()).toBe(1200n);
  });

  it("parses negatives", () => {
    expect(Money.fromDecimalString("-5.25").toPaise()).toBe(-525n);
  });

  it("rejects anything that is not an exact decimal amount", () => {
    for (const bad of ["", " ", "abc", "1e10", "1.234", "1,000", "NaN", "Infinity", "--1", "1.2.3"]) {
      expect(() => Money.fromDecimalString(bad)).toThrow(TypeError);
    }
  });
});

describe("national-scale precision (the reason bigint exists)", () => {
  it("round-trips a Union-Budget-scale aggregate exactly", () => {
    // ~₹50 lakh crore = 5e14 rupees = 5e16 paise — beyond Number.MAX_SAFE_INTEGER.
    const budget = "50000000000000.00";
    expect(Money.fromDecimalString(budget).toDecimalString()).toBe(budget);
  });

  it("would have lost precision as a float, and does not here", () => {
    const exact = Money.fromDecimalString("90071992547409.93");
    expect(exact.toDecimalString()).toBe("90071992547409.93");
    // Demonstrate the failure this class exists to prevent:
    expect(Number("90071992547409.93") * 100).not.toBe(9007199254740993);
  });

  it("sums a large series without drift", () => {
    const items = Array.from({ length: 1000 }, () => Money.fromDecimalString("999999999.99"));
    expect(Money.sum(items).toDecimalString()).toBe("999999999990.00");
  });
});

describe("Indian formatting", () => {
  it("groups by the Indian system", () => {
    expect(Money.fromDecimalString("80000000").format("en", "full")).toBe("₹8,00,00,000");
    expect(Money.fromDecimalString("100000").format("en", "full")).toBe("₹1,00,000");
    expect(Money.fromDecimalString("999").format("en", "full")).toBe("₹999");
    expect(Money.fromDecimalString("1234").format("en", "full")).toBe("₹1,234");
  });

  it("renders crore and lakh at the right boundaries", () => {
    expect(Money.fromDecimalString("80000000").format()).toBe("₹8.00 crore");
    expect(Money.fromDecimalString("10000000").format()).toBe("₹1.00 crore");
    expect(Money.fromDecimalString("9999999").format()).toBe("₹99.99 lakh");
    expect(Money.fromDecimalString("100000").format()).toBe("₹1.00 lakh");
    expect(Money.fromDecimalString("99999").format()).toBe("₹99,999");
  });

  it("computes the scaled fraction exactly, not via float division", () => {
    expect(Money.fromDecimalString("123456789").format()).toBe("₹12.34 crore");
    expect(Money.fromDecimalString("6050000").format()).toBe("₹60.50 lakh");
  });

  it("keeps Latin numerals in every locale (docs cross-check requirement)", () => {
    for (const locale of ["en", "mr", "hi"] as const) {
      expect(Money.fromDecimalString("80000000").format(locale)).toBe("₹8.00 crore");
    }
  });

  it("handles negatives", () => {
    expect(Money.fromDecimalString("-80000000").format()).toBe("-₹8.00 crore");
  });
});

describe("arithmetic", () => {
  it("adds and subtracts exactly", () => {
    const a = Money.fromDecimalString("100000000.00"); // ₹10 cr
    const b = Money.fromDecimalString("80000000.00");  // ₹8 cr
    expect(a.minus(b).format()).toBe("₹2.00 crore");
    expect(a.plus(b).format()).toBe("₹18.00 crore");
  });

  it("is reversible: a.plus(b).minus(b) === a", () => {
    const a = Money.fromDecimalString("123456789.99");
    const b = Money.fromDecimalString("987654321.01");
    expect(a.plus(b).minus(b).equals(a)).toBe(true);
  });

  it("compares and detects zero", () => {
    const a = Money.fromDecimalString("1.00");
    const b = Money.fromDecimalString("2.00");
    expect(a.compare(b)).toBe(-1);
    expect(b.compare(a)).toBe(1);
    expect(a.compare(a)).toBe(0);
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.fromDecimalString("-1.00").isNegative()).toBe(true);
  });
});

describe("accessibility", () => {
  it("speaks the unit rather than a digit string", () => {
    expect(Money.fromDecimalString("80000000").toAccessibleString()).toBe("8.00 crore rupees");
    expect(Money.fromDecimalString("-80000000").toAccessibleString()).toBe("minus 8.00 crore rupees");
  });
});

describe("serialisation", () => {
  it("serialises back to a decimal string, never a number", () => {
    const m = Money.fromDecimalString("90000000.00");
    expect(JSON.parse(JSON.stringify({ amount: m })).amount).toBe("90000000.00");
    expect(typeof JSON.parse(JSON.stringify({ amount: m })).amount).toBe("string");
  });
});
