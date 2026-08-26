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
 * The first year BEAMS actually populates its expenditure column.
 *
 * Before this, 978 of 1,001 rows carry a published zero — FY2020 totals ₹19,638
 * crore allocated against ₹24 crore spent, which is not what happened. The
 * source asserts a zero it does not mean
 * (.docs/06-government-sources/beams-discovery.md).
 *
 * The stored figures stay exactly as published, because rewriting a government
 * record is not ours to do. What is withheld is the *display*: showing that
 * comparison would make a false and damaging claim about a department.
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
