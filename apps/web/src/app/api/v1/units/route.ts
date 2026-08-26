import { AppError } from "@lokdarpan/errors";

import { unitService } from "@/server/container";
import { respond } from "@/server/respond";

/** Reads the ledger per request; nothing here is prerenderable. */
export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    const level = new URL(request.url).searchParams.get("level");
    if (level === null) {
      throw AppError.badRequest("A level is required, e.g. ?level=state.");
    }
    const result = await unitService().listByLevel(level);
    return { data: result, datasetVersion: result.datasetVersion };
  });
}
