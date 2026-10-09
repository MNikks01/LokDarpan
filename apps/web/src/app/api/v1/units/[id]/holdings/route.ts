import { AppError } from "@lokdarpan/errors";

import { inLedger } from "@/server/container";
import { holdingsOf } from "@/server/holdings";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * What LokDarpan holds for a unit, one row per kind of record: collected and
 * shown, collected and withheld, or not collected (LD-009, ADR-076). Read in
 * the same snapshot as the version it is reported with (ADR-053).
 */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const unitId = Number(id);
    if (!Number.isInteger(unitId) || unitId < 1) {
      throw new AppError("NOT_FOUND", `No unit ${id}`);
    }
    return inLedger(async ({ holdings }) => {
      const inputs = await holdings.inputsFor(unitId);
      if (inputs === null) throw new AppError("NOT_FOUND", `No unit ${id}`);
      return { state: inputs.state, holdings: holdingsOf(inputs) };
    });
  });
}
