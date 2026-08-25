import { unitService } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const view = await unitService().getUnit(id);
    return { data: view, datasetVersion: view.datasetVersion };
  });
}
