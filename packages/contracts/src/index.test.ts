import { describe, it, expect } from "vitest";
import { FinanceChainSchema, StrictAmountSchema, ProvenanceSchema } from "./index";
import { FIXTURE_PROJECT_501 } from "./fixtures/index";

describe("contract: money is a decimal string (audit C3)", () => {
  it("accepts exact decimal strings", () => {
    expect(StrictAmountSchema.parse("100000000.00")).toBe("100000000.00");
  });
  it("REJECTS a JSON number, naming the reason", () => {
    expect(() => StrictAmountSchema.parse(100000000)).toThrow(/decimal string/i);
  });
  it("rejects scientific notation and thousands separators", () => {
    expect(() => StrictAmountSchema.parse("1e8")).toThrow();
    expect(() => StrictAmountSchema.parse("1,00,00,000")).toThrow();
  });
});

describe("contract: both variances, never a bare `variance` (audit C1)", () => {
  it("parses the fixture chain with both variances named", () => {
    const chain = FinanceChainSchema.parse(FIXTURE_PROJECT_501.finance);
    expect(chain.releaseVarianceInr).toBe("10000000.00");
    expect(chain.allocationVarianceInr).toBe("20000000.00");
    expect(chain.status).toBe("needs_verification");
  });

  it("rejects a payload carrying a bare `variance` field", () => {
    const bad = { ...FIXTURE_PROJECT_501.finance, variance: "10000000.00" };
    expect(() => FinanceChainSchema.parse(bad)).toThrow();
  });

  it("forbids a variance computed across a missing stage (docs/06 §2)", () => {
    const bad = {
      ...FIXTURE_PROJECT_501.finance,
      utilized: { present: false, missingReason: "No expenditure records published", expectedSource: "MH PWD — Works", lastCheckedAt: "2026-08-18" },
      status: "insufficient_data" as const,
    };
    expect(() => FinanceChainSchema.parse(bad)).toThrow(/missing stage/);
  });
});

describe("contract: provenance (audit C4, C8)", () => {
  it("requires page anchors and three distinct confidences", () => {
    const p = ProvenanceSchema.parse(FIXTURE_PROJECT_501.finance.utilized.provenance);
    expect(p.page).toBe(42);
    expect(p.pageLocator).toBe("p.42 table 3");
    expect(p.extractionConfidence).toBe(0.82);
    expect(p.linkageConfidence).toBe(1);
  });

  it("rejects a fact whose provenance is missing", () => {
    expect(() => ProvenanceSchema.parse({ sourceName: "x" })).toThrow();
  });
});
