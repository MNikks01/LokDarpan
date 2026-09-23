import { UnitService } from "@lokdarpan/domain";

import { inLedger } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/** One unit and its children, in one snapshot, reported with its watermark (ADR-053). */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    return inLedger(({ units }) => new UnitService(units).getUnit(id));
  });
}
