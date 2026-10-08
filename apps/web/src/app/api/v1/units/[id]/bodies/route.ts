import { AppError } from "@lokdarpan/errors";

import { inLedger } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * The governments and departments shown for a unit: those whose jurisdiction it
 * is and whose names a reviewed report page confirms (ADR-074). An empty list
 * means none is confirmed yet, never that the unit has no government.
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
    return inLedger(({ bodies }) => bodies.bodiesOf(unitId));
  });
}
