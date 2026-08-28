import { geographyRepository } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * The units directly inside a place, whatever levels those turn out to be.
 *
 * The caller does not say what it expects to find. A district may contain
 * talukas, municipal bodies and villages at once — Nagpur contains all three —
 * so the hierarchy is read from the data rather than assumed by the client.
 */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const unitId = Number(id);
    if (!Number.isInteger(unitId) || unitId < 1) {
      return { data: { units: [] }, datasetVersion: 0 };
    }
    const units = await geographyRepository().childrenOf(unitId);
    return { data: { units }, datasetVersion: 0 };
  });
}
