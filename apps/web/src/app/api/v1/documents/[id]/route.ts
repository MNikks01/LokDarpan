import { AppError } from "@lokdarpan/errors";

import { publishedFactRepository } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const documentId = Number(id);
    if (!Number.isInteger(documentId) || documentId < 1) {
      throw new AppError("NOT_FOUND", `No document ${id}`);
    }
    const view = await publishedFactRepository().documentFacts(documentId);
    if (view === null) throw new AppError("NOT_FOUND", `No document ${id}`);
    return { data: view, datasetVersion: view.datasetVersion };
  });
}
