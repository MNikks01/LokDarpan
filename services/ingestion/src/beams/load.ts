import type { SqlClient } from "@lokdarpan/database";

import type { RawArtifact } from "../raw-store";
import type { BeamsRow } from "./parse";

export interface FinanceLoadResult {
  readonly departments: number;
  readonly schemes: number;
  readonly facts: number;
}

export interface FinanceLoadContext {
  readonly artifact: RawArtifact;
  readonly datasetVersionId: number;
  /** The state these departments belong to. */
  readonly adminUnitId: number;
  readonly fiscalYear: number;
}

/**
 * BEAMS is a treasury system read from its own published export — no OCR, no
 * layout inference. Extraction confidence is therefore 1.
 *
 * Linkage confidence is also 1 here because the scheme coordinates come from
 * the same row as the amounts: there is no matching step that could be wrong.
 * Both are named rather than written inline, so a later source that *does*
 * infer a linkage cannot quietly inherit certainty.
 */
const BEAMS_EXTRACTION_CONFIDENCE = 1;
const BEAMS_LINKAGE_CONFIDENCE = 1;

export async function loadBeamsRows(
  client: SqlClient,
  rows: readonly BeamsRow[],
  context: FinanceLoadContext,
): Promise<FinanceLoadResult> {
  const { artifact, datasetVersionId, adminUnitId, fiscalYear } = context;
  const departmentIds = new Map<string, number>();
  const schemeIds = new Map<string, number>();
  let facts = 0;

  for (const row of rows) {
    let departmentId = departmentIds.get(row.deptCode);
    if (departmentId === undefined) {
      // name_en is deliberately not written: BEAMS does not publish a
      // department name, and inferring one from the code would put an
      // unsourced string in front of a reader.
      const d = await client.query(
        `INSERT INTO department (admin_unit_id, code, source_sha256, dataset_version_id,
                                 extraction_confidence)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (admin_unit_id, code) DO UPDATE SET code = EXCLUDED.code
         RETURNING id`,
        [adminUnitId, row.deptCode, artifact.sha256, datasetVersionId, BEAMS_EXTRACTION_CONFIDENCE],
      );
      departmentId = Number((d.rows[0] as { id: string }).id);
      departmentIds.set(row.deptCode, departmentId);
    }

    const schemeKey = `${row.deptCode}|${row.demandNo}|${row.schemeCode}`;
    let schemeId = schemeIds.get(schemeKey);
    if (schemeId === undefined) {
      const s = await client.query(
        `INSERT INTO budget_scheme (department_id, demand_no, scheme_code, name_en, name_local,
                                    charged_voted, scheme_committed, source_of_fund, plan_type,
                                    source_sha256, dataset_version_id, extraction_confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (department_id, demand_no, scheme_code) DO UPDATE SET
           name_en    = EXCLUDED.name_en,
           name_local = EXCLUDED.name_local
         RETURNING id`,
        [
          departmentId,
          row.demandNo,
          row.schemeCode,
          row.schemeNameEn,
          row.schemeNameLocal,
          row.chargedVoted,
          row.schemeCommitted,
          row.sourceOfFund,
          row.planType,
          artifact.sha256,
          datasetVersionId,
          BEAMS_EXTRACTION_CONFIDENCE,
        ],
      );
      schemeId = Number((s.rows[0] as { id: string }).id);
      schemeIds.set(schemeKey, schemeId);
    }

    // Re-running an ingest must converge on the published figures rather than
    // duplicate them, and provenance is rewritten so a fact always names the
    // artefact its current values came from.
    await client.query(
      `INSERT INTO scheme_finance (budget_scheme_id, fiscal_year, object_code,
                                   allocated_inr, released_fd_inr, released_inr, utilized_inr, reappropriated_inr,
                                   extraction_confidence, linkage_confidence,
                                   source_sha256, dataset_version_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (budget_scheme_id, fiscal_year, object_code) DO UPDATE SET
         allocated_inr      = EXCLUDED.allocated_inr,
         released_fd_inr    = EXCLUDED.released_fd_inr,
         released_inr       = EXCLUDED.released_inr,
         utilized_inr       = EXCLUDED.utilized_inr,
         reappropriated_inr = EXCLUDED.reappropriated_inr,
         source_sha256      = EXCLUDED.source_sha256,
         dataset_version_id = EXCLUDED.dataset_version_id`,
      [
        schemeId,
        fiscalYear,
        row.objectCode,
        row.allocatedInr,
        row.releasedFdInr,
        row.releasedInr,
        row.utilizedInr,
        row.reappropriatedInr,
        BEAMS_EXTRACTION_CONFIDENCE,
        BEAMS_LINKAGE_CONFIDENCE,
        artifact.sha256,
        datasetVersionId,
      ],
    );
    facts += 1;
  }

  return { departments: departmentIds.size, schemes: schemeIds.size, facts };
}
