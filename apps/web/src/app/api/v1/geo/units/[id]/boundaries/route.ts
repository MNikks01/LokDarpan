import { geographyRepository } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * Boundary geometry for one level of the hierarchy, as GeoJSON.
 *
 * Simplified in PostGIS on the way out and returned per parent rather than per
 * state, so the client fetches one level at a time instead of a national
 * dataset it would then have to filter.
 */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const unitId = Number(id);
    if (!Number.isInteger(unitId) || unitId < 1) {
      return { data: { type: "FeatureCollection", features: [] }, datasetVersion: 0 };
    }
    const collection = await geographyRepository().boundariesOfChildren(unitId);
    return { data: collection, datasetVersion: 0 };
  });
}
