import type { SqlClient } from "@lokdarpan/database";

import type { RawArtifact } from "../raw-store";
import type { DepartmentActuals } from "./actuals-parse";

export interface ActualsLoadResult {
  readonly departments: number;
  readonly named: number;
  readonly facts: number;
}

export interface ActualsLoadContext {
  readonly artifact: RawArtifact;
  readonly datasetVersionId: number;
  readonly adminUnitId: number;
}

/** Read directly from the publisher's own report; no OCR, no inference. */
const CONFIDENCE = 1;

export async function loadDepartmentActuals(
  client: SqlClient,
  actuals: DepartmentActuals,
  context: ActualsLoadContext,
): Promise<ActualsLoadResult> {
  const { artifact, datasetVersionId, adminUnitId } = context;
  let named = 0;
  let facts = 0;

  for (const row of actuals.rows) {
    // This report publishes the name the scheme-wise export omits, so a
    // department created earlier as a bare code gains its published name here.
    // The name is only ever written from a source that states it.
    const d = await client.query(
      `INSERT INTO department (admin_unit_id, code, name_en, source_sha256,
                               dataset_version_id, extraction_confidence)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (admin_unit_id, code) DO UPDATE SET
         name_en            = EXCLUDED.name_en,
         source_sha256      = EXCLUDED.source_sha256,
         dataset_version_id = EXCLUDED.dataset_version_id
       RETURNING id, name_en`,
      [adminUnitId, row.deptCode, row.deptNameEn, artifact.sha256, datasetVersionId, CONFIDENCE],
    );
    const stored = d.rows[0] as { id: string; name_en: string | null };
    const departmentId = Number(stored.id);
    if (stored.name_en !== null) named += 1;

    await client.query(
      `INSERT INTO department_finance
         (department_id, fiscal_year, from_month, to_month,
          budgeted_inr, released_inr, received_inr,
          beams_expenditure_inr, treasury_expenditure_inr,
          extraction_confidence, linkage_confidence, source_sha256, dataset_version_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (department_id, fiscal_year, from_month, to_month) DO UPDATE SET
         budgeted_inr             = EXCLUDED.budgeted_inr,
         released_inr             = EXCLUDED.released_inr,
         received_inr             = EXCLUDED.received_inr,
         beams_expenditure_inr    = EXCLUDED.beams_expenditure_inr,
         treasury_expenditure_inr = EXCLUDED.treasury_expenditure_inr,
         source_sha256            = EXCLUDED.source_sha256,
         dataset_version_id       = EXCLUDED.dataset_version_id`,
      [
        departmentId,
        actuals.fiscalYear,
        actuals.fromMonth,
        actuals.toMonth,
        row.budgetedInr,
        row.releasedInr,
        row.receivedInr,
        row.beamsExpenditureInr,
        row.treasuryExpenditureInr,
        CONFIDENCE,
        CONFIDENCE,
        artifact.sha256,
        datasetVersionId,
      ],
    );
    facts += 1;
  }

  return { departments: actuals.rows.length, named, facts };
}
