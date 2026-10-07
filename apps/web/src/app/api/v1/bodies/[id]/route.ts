import { AppError } from "@lokdarpan/errors";

import { inLedger } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * A government or department, with the reviewed report pages that name it
 * (ADR-074). Not found unless a reviewed mention from a republishable source
 * confirms it: an empty body would still assert we hold a record of it.
 */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const bodyId = Number(id);
    if (!Number.isInteger(bodyId) || bodyId < 1) {
      throw new AppError("NOT_FOUND", `No public body ${id}`);
    }
    // Read in one snapshot and reported with its watermark (ADR-053).
    return inLedger(async ({ bodies }) => {
      const view = await bodies.body(bodyId);
      if (view === null) throw new AppError("NOT_FOUND", `No public body ${id}`);
      return view;
    });
  });
}
