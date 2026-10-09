import { AppError } from "@lokdarpan/errors";

import { inLedger } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * The reports and reviewed pages that name this district or taluka (ADR-077).
 * Each page is cited; none is presented as being about the place, only as
 * naming it.
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
    return inLedger(({ places }) => places.mentionsOf(unitId));
  });
}
