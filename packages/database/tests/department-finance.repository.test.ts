import { AppError } from "@lokdarpan/errors";
import type pg from "pg";
import { describe, expect, it } from "vitest";

import { PostgresDepartmentFinanceRepository } from "../src/department-finance.repository";

const DEPARTMENT = {
  code: "H",
  name_en: "Home Department",
  source_sha256: "b".repeat(64),
  dataset_version_id: "88",
  extraction_confidence: "0.99",
  source_url: "https://beams.example.invalid/actuals",
  retrieved_at: new Date("2026-08-30T00:00:00.000Z"),
};

const year = (over: Record<string, unknown>) => ({
  fiscal_year: 2024,
  allocated_inr: "1000.00",
  allocated_alternate_inr: "990.00",
  released_fd_inr: null,
  released_inr: "800.00",
  utilized_inr: "750.50",
  scheme_count: "0",
  treasury_inr: "751.00",
  missing_expenditure: "0",
  missing_allocated: "0",
  missing_released: "0",
  ...over,
});

/** Answers the department query first, then the years query. */
function pool(department: unknown[], years: unknown[]): pg.Pool {
  const answers = [department, years];
  return {
    query: () => Promise.resolve({ rows: answers.shift() ?? [] }),
  } as unknown as pg.Pool;
}

describe("PostgresDepartmentFinanceRepository", () => {
  it("states both variances, each exactly, from decimal strings", async () => {
    const view = await new PostgresDepartmentFinanceRepository(
      pool([DEPARTMENT], [year({})]),
    ).findByCode("20", "H");
    expect(view.years[0]).toMatchObject({
      fiscalYear: 2024,
      releaseVarianceInr: "49.50",
      allocationVarianceInr: "249.50",
      allocatedInrAlternate: "990.00",
      status: "complete",
    });
    expect(view.provenance).toEqual({
      sourceSha256: "b".repeat(64),
      sourceUrl: "https://beams.example.invalid/actuals",
      retrievedAt: "2026-08-30T00:00:00.000Z",
      extractionConfidence: 0.99,
      datasetVersion: 88,
    });
    expect(view.datasetVersion).toBe(88);
  });

  it("signs a variance where more was spent than released, and keeps sub-rupee amounts exact", async () => {
    const view = await new PostgresDepartmentFinanceRepository(
      pool([DEPARTMENT], [year({ released_inr: "0.05", utilized_inr: "1.5", allocated_inr: "2" })]),
    ).findByCode("20", "H");
    expect(view.years[0]?.releaseVarianceInr).toBe("-1.45");
    expect(view.years[0]?.allocationVarianceInr).toBe("0.50");
  });

  it("computes no variance across a missing figure, and says the data is insufficient", async () => {
    const view = await new PostgresDepartmentFinanceRepository(
      pool([DEPARTMENT], [year({ utilized_inr: null, missing_expenditure: "1" })]),
    ).findByCode("20", "H");
    // Missing is never zero.
    expect(view.years[0]).toMatchObject({
      releaseVarianceInr: null,
      allocationVarianceInr: null,
      status: "insufficient_data",
      schemesWithoutExpenditure: 1,
    });
  });

  it("reports a department the unit does not have as not found", async () => {
    const failure = await new PostgresDepartmentFinanceRepository(pool([], []))
      .findByCode("20", "ZZ")
      .catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).status).toBe(404);
  });
});
