import {
  auditHolding,
  boundaryHolding,
  budgetHolding,
  tenderHolding,
  worksHolding,
  type Decide,
  type Holding,
} from "@lokdarpan/domain";
import type { UnitHoldingsInputs } from "@lokdarpan/database/holdings";

import { decideFor } from "./publishable";

/**
 * A unit's checklist, in the order a page lists it: places below, then the
 * records filed for the state, then what no source has yet supplied (ADR-076).
 *
 * The gate is this deployment's own (`decideFor`): what a row says about
 * showing or withholding is the decision the rest of the site acts on, never a
 * separate judgement made for the checklist.
 */
export function holdingsOf(inputs: UnitHoldingsInputs, decide: Decide = decideFor): Holding[] {
  const rows = inputs.boundaries.map((b) => boundaryHolding(b, decide));
  if (inputs.audit !== null) rows.push(auditHolding(inputs.audit, decide));
  if (inputs.tenders !== null) {
    // Collection is per state, as audit reports and budgets are filed.
    rows.push(tenderHolding(inputs.tenders, decide, inputs.audit?.filedUnder ?? null));
  }
  if (inputs.budget !== null) rows.push(budgetHolding(inputs.budget, decide));
  rows.push(worksHolding());
  return rows;
}
