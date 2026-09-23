import { UnitService } from "@lokdarpan/domain";
import { AppError } from "@lokdarpan/errors";

import { inLedger } from "@/server/container";
import { respond } from "@/server/respond";

/** Reads the ledger per request; nothing here is prerenderable. */
export const dynamic = "force-dynamic";

/**
 * Every unit at one level. Read in one ledger snapshot and reported with its
 * watermark; each unit carries the version of the load it came from (ADR-053).
 */
export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    const level = new URL(request.url).searchParams.get("level");
    if (level === null) {
      throw AppError.badRequest("A level is required, e.g. ?level=state.");
    }
    return inLedger(({ units }) => new UnitService(units).listByLevel(level));
  });
}
