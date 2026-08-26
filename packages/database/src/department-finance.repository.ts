import type {
  DepartmentFinanceRepository,
  DepartmentFinanceView,
  DepartmentYearFinance,
  FigureStatus,
} from "@lokdarpan/domain";
import { AppError } from "@lokdarpan/errors";
import type pg from "pg";

interface YearRow {
  readonly fiscal_year: number;
  readonly allocated_inr: string | null;
  readonly allocated_alternate_inr: string | null;
  readonly released_fd_inr: string | null;
  readonly released_inr: string | null;
  readonly utilized_inr: string | null;
  readonly scheme_count: string;
  readonly treasury_inr: string | null;
  readonly missing_expenditure: string;
  readonly missing_allocated: string;
  readonly missing_released: string;
}

/**
 * Totals are computed in the database, not the client.
 *
 * `.docs/11-api/client-api-contract.md`: variance, deviation and roll-ups
 * arrive computed, versioned and source-linked. A page that added figures
 * itself could disagree with the ledger while both looked authoritative.
 */
/**
 * Read from `department_finance`, the departmental actuals report — not
 * aggregated from `scheme_finance`.
 *
 * The two BEAMS reports agree to the rupee for FY2021–FY2025 and diverge for
 * FY2019–FY2020, where the scheme-wise export understates release and
 * expenditure severely (FY2020 spending: ₹24 crore in the export against
 * ₹15,842 crore in the actuals). Where two reports by the same government
 * disagree, this reads the one whose figures are corroborated across every year
 * both cover (.docs/06-government-sources/beams-discovery.md §Correction).
 */
const YEARS = `
  SELECT f.fiscal_year,
         f.budgeted_inr             AS allocated_inr,
         (SELECT sum(sf.allocated_inr)
            FROM scheme_finance sf
            JOIN budget_scheme bs ON bs.id = sf.budget_scheme_id
           WHERE bs.department_id = f.department_id
             AND sf.fiscal_year = f.fiscal_year)  AS allocated_alternate_inr,
         NULL::numeric              AS released_fd_inr,
         f.released_inr             AS released_inr,
         f.beams_expenditure_inr    AS utilized_inr,
         f.treasury_expenditure_inr AS treasury_inr,
         0::bigint                  AS scheme_count,
         (f.beams_expenditure_inr IS NULL)::int AS missing_expenditure,
         (f.budgeted_inr IS NULL)::int          AS missing_allocated,
         (f.released_inr IS NULL)::int          AS missing_released
    FROM department_finance f
    JOIN department d ON d.id = f.department_id
   WHERE d.admin_unit_id = $1 AND d.code = $2
   ORDER BY f.fiscal_year DESC
`;

const DEPARTMENT = `
  SELECT d.code, d.name_en, d.source_sha256, d.dataset_version_id, d.extraction_confidence,
         s.source_url, s.retrieved_at
    FROM department d
    JOIN admin_unit a      ON a.id = d.admin_unit_id
    JOIN source_artifact s ON s.sha256 = d.source_sha256
   WHERE a.id = $1 AND d.code = $2
`;

/** Subtracts two decimal strings exactly, or returns null if either is absent. */
function minus(a: string | null, b: string | null): string | null {
  if (a === null || b === null) return null;
  const toPaise = (v: string): bigint => {
    const [whole = "0", frac = ""] = v.split(".");
    return BigInt(whole + frac.padEnd(2, "0").slice(0, 2));
  };
  const paise = toPaise(a) - toPaise(b);
  const negative = paise < 0n;
  const abs = (negative ? -paise : paise).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${abs.slice(0, -2)}.${abs.slice(-2)}`;
}

export class PostgresDepartmentFinanceRepository implements DepartmentFinanceRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findByCode(unitId: string, departmentCode: string): Promise<DepartmentFinanceView> {
    const dept = await this.pool.query(DEPARTMENT, [unitId, departmentCode]);
    const d = dept.rows[0] as
      | {
          code: string;
          name_en: string | null;
          source_sha256: string;
          dataset_version_id: string;
          extraction_confidence: string;
          source_url: string;
          retrieved_at: Date;
        }
      | undefined;
    if (d === undefined) throw AppError.notFound("This department");

    const rows = await this.pool.query<YearRow>(YEARS, [unitId, departmentCode]);

    const years: DepartmentYearFinance[] = rows.rows.map((r) => {
      const anyMissing =
        Number(r.missing_allocated) > 0 ||
        Number(r.missing_released) > 0 ||
        Number(r.missing_expenditure) > 0;
      const status: FigureStatus = anyMissing ? "insufficient_data" : "complete";
      // No coverage gate here: this series comes from the actuals report, which
      // is credible for every year it covers. The gate exists for scheme-level
      // views, which still derive from the export.
      return {
        fiscalYear: r.fiscal_year,
        allocatedInr: r.allocated_inr,
        allocatedInrAlternate: r.allocated_alternate_inr,
        releasedFdInr: r.released_fd_inr,
        releasedInr: r.released_inr,
        utilizedInr: r.utilized_inr,
        releaseVarianceInr: minus(r.released_inr, r.utilized_inr),
        allocationVarianceInr: minus(r.allocated_inr, r.utilized_inr),
        status,
        schemeCount: Number(r.scheme_count),
        schemesWithoutExpenditure: Number(r.missing_expenditure),
      };
    });

    return {
      departmentCode: d.code,
      departmentNameEn: d.name_en,
      years,
      provenance: {
        sourceSha256: d.source_sha256,
        sourceUrl: d.source_url,
        retrievedAt: d.retrieved_at.toISOString(),
        extractionConfidence: Number(d.extraction_confidence),
        datasetVersion: Number(d.dataset_version_id),
      },
      datasetVersion: Number(d.dataset_version_id),
    };
  }
}
