import { AppError } from "@lokdarpan/errors";

import { inLedger } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * The districts and talukas, at or inside a unit, that a reviewed audit page
 * names (ADR-077), with the point each is drawn at. An empty list means none is
 * confirmed yet, never that no report concerns the place.
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
    return inLedger(({ places }) => places.namedWithin(unitId));
  });
}
