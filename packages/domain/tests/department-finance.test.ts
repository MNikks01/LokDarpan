import { describe, expect, it } from "vitest";

import {
  BEAMS_EXPENDITURE_FIRST_YEAR,
  withCoverageApplied,
  type DepartmentYearFinance,
} from "../src/department-finance";

const year = (over: Partial<DepartmentYearFinance> = {}): DepartmentYearFinance => ({
  fiscalYear: 2024,
  allocatedInr: "100.00",
  allocatedInrAlternate: "90.00",
  releasedFdInr: "95.00",
  releasedInr: "90.00",
  utilizedInr: "80.00",
  releaseVarianceInr: "10.00",
  allocationVarianceInr: "20.00",
  status: "complete",
  schemeCount: 5,
  schemesWithoutExpenditure: 0,
  ...over,
});

describe("withCoverageApplied", () => {
  it("leaves a year the source actually populates untouched", () => {
    const y = year({ fiscalYear: BEAMS_EXPENDITURE_FIRST_YEAR });
    expect(withCoverageApplied(y)).toEqual(y);
  });

  // FY2020 totals ₹19,638 crore allocated against ₹24 crore spent, because the
  // treasury system records a zero rather than an amount. Showing that would
  // make a false claim about a department.
  it("withholds expenditure for a year the source does not populate", () => {
    const gated = withCoverageApplied(year({ fiscalYear: 2020 }));
    expect(gated.utilizedInr).toBeNull();
    expect(gated.status).toBe("not_published_for_period");
  });

  it("withholds both variances, not just one", () => {
    const gated = withCoverageApplied(year({ fiscalYear: 2020 }));
    expect(gated.releaseVarianceInr).toBeNull();
    expect(gated.allocationVarianceInr).toBeNull();
  });

  // Allocation and release *are* published for those years and stay visible.
  // Withholding everything would overstate the problem.
  it("keeps allocation and release, which the source does publish", () => {
    const gated = withCoverageApplied(year({ fiscalYear: 2017 }));
    expect(gated.allocatedInr).toBe("100.00");
    expect(gated.releasedInr).toBe("90.00");
  });

  it("gates every year before the first populated one", () => {
    for (let y = 2017; y < BEAMS_EXPENDITURE_FIRST_YEAR; y += 1) {
      expect(withCoverageApplied(year({ fiscalYear: y })).utilizedInr, `FY${String(y)}`).toBeNull();
    }
  });

  it("does not gate later years", () => {
    for (const y of [2021, 2024, 2026]) {
      expect(withCoverageApplied(year({ fiscalYear: y })).utilizedInr).toBe("80.00");
    }
  });

  it("preserves an insufficient_data status it did not cause", () => {
    const y = year({ fiscalYear: 2024, status: "insufficient_data", schemesWithoutExpenditure: 3 });
    expect(withCoverageApplied(y).status).toBe("insufficient_data");
  });
});
