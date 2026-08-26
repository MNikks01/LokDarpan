import type { Provenance } from "./admin-unit";

/**
 * Why a figure is absent. "Not published" and "not yet collected" are different
 * claims, and a page that conflates them implies a government body published
 * nothing when it may simply not have been fetched.
 */
export type FigureStatus =
  | "complete"
  /** Some schemes in this year have no published figure for a stage. */
  | "insufficient_data"
  /** The source does not populate this field for this period at all. */
  | "not_published_for_period";

export interface DepartmentYearFinance {
  readonly fiscalYear: number;
  /** Rupees as decimal strings. `null` means no figure, never zero. */
  readonly allocatedInr: string | null;
  /**
   * The same year's allocation as published by the *other* BEAMS report.
   *
   * Two government reports disagree about this figure — for FY2024 Public
   * Works, ₹51,567 crore against ₹35,833 crore — and the residual changes sign
   * across years, so it is not a units error or a missing column. Neither is
   * silently preferred: both are published, and the disagreement is itself a
   * fact the reader is entitled to (§40 of the product brief).
   *
   * `null` where the other report does not cover the year.
   */
  readonly allocatedInrAlternate: string | null;
  readonly releasedFdInr: string | null;
  readonly releasedInr: string | null;
  readonly utilizedInr: string | null;
  /** Released − Utilized. `null` when either side is absent. */
  readonly releaseVarianceInr: string | null;
  /** Allocated − Utilized. A different quantity, against a different denominator. */
  readonly allocationVarianceInr: string | null;
  readonly status: FigureStatus;
  readonly schemeCount: number;
  readonly schemesWithoutExpenditure: number;
}

export interface DepartmentFinanceView {
  readonly departmentCode: string;
  /** `null` where the source publishes no name. Never inferred from the code. */
  readonly departmentNameEn: string | null;
  readonly years: readonly DepartmentYearFinance[];
  readonly provenance: Provenance;
  readonly datasetVersion: number;
}

/**
 * The first year the **scheme-wise export** carries credible expenditure.
 *
 * Before this it reports ₹24 crore of spending against ₹19,638 crore allocated
 * for FY2020, while BEAMS' own departmental actuals report gives ₹15,842 crore
 * for the same department and year. The two agree to the rupee from FY2021-22
 * onward (.docs/06-government-sources/beams-discovery.md §Correction).
 *
 * The departmental series now reads the actuals report, so this gate no longer
 * applies to a department page. It remains for **scheme-level** views, which
 * still derive from the export and are still wrong for those years.
 *
 * Stored figures are untouched either way. Rewriting a government record is not
 * ours to do; choosing which of two published records to display is.
 */
export const BEAMS_EXPENDITURE_FIRST_YEAR = 2021;

/**
 * Applies the coverage gate.
 *
 * Deliberately here, in the domain layer, rather than in a template: a rule
 * that prevents a defamatory figure reaching a reader must not depend on which
 * component renders it.
 */
export function withCoverageApplied(year: DepartmentYearFinance): DepartmentYearFinance {
  if (year.fiscalYear >= BEAMS_EXPENDITURE_FIRST_YEAR) return year;
  return {
    ...year,
    utilizedInr: null,
    releaseVarianceInr: null,
    allocationVarianceInr: null,
    status: "not_published_for_period",
  };
}

export interface DepartmentFinanceRepository {
  findByCode(unitId: string, departmentCode: string): Promise<DepartmentFinanceView>;
}
