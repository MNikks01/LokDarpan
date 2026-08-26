import type {
  DepartmentFinanceRepository,
  DepartmentFinanceView,
  DepartmentYearFinance,
  FigureStatus,
} from "@lokdarpan/domain";
import { withCoverageApplied } from "@lokdarpan/domain";
import { AppError } from "@lokdarpan/errors";
import type pg from "pg";

interface YearRow {
  readonly fiscal_year: number;
  readonly allocated_inr: string | null;
  readonly released_fd_inr: string | null;
  readonly released_inr: string | null;
  readonly utilized_inr: string | null;
  readonly scheme_count: string;
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
const YEARS = `
  SELECT f.fiscal_year,
         sum(f.allocated_inr)      AS allocated_inr,
         sum(f.released_fd_inr)    AS released_fd_inr,
         sum(f.released_inr)       AS released_inr,
         sum(f.utilized_inr)       AS utilized_inr,
         count(*)                                              AS scheme_count,
         count(*) FILTER (WHERE f.utilized_inr  IS NULL)       AS missing_expenditure,
         count(*) FILTER (WHERE f.allocated_inr IS NULL)       AS missing_allocated,
         count(*) FILTER (WHERE f.released_inr  IS NULL)       AS missing_released
    FROM scheme_finance f
    JOIN budget_scheme bs ON bs.id = f.budget_scheme_id
    JOIN department d     ON d.id  = bs.department_id
    JOIN admin_unit a     ON a.id  = d.admin_unit_id
   WHERE a.id = $1 AND d.code = $2
   GROUP BY f.fiscal_year
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
      return withCoverageApplied({
        fiscalYear: r.fiscal_year,
        allocatedInr: r.allocated_inr,
        releasedFdInr: r.released_fd_inr,
        releasedInr: r.released_inr,
        utilizedInr: r.utilized_inr,
        releaseVarianceInr: minus(r.released_inr, r.utilized_inr),
        allocationVarianceInr: minus(r.allocated_inr, r.utilized_inr),
        status,
        schemeCount: Number(r.scheme_count),
        schemesWithoutExpenditure: Number(r.missing_expenditure),
      });
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
