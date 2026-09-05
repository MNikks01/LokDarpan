import { geographyRepository } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * The units directly inside a place, whatever levels those turn out to be.
 *
 * The caller does not say what it expects to find. A district may contain
 * talukas, municipal bodies and villages at once — Nagpur contains all three —
 * so the hierarchy is read from the data rather than assumed by the client.
 *
 * `coverage` travels with the list because it is what the list means. Pune holds
 * 14 talukas and no municipal body, and Pune Municipal Corporation plainly
 * exists — so the units alone say "here is what we hold" and get read as "here
 * is what there is". A client that received one without the other would draw
 * exactly the conclusion the coverage record was added to prevent.
 */
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return respond(request, async () => {
    const { id } = await context.params;
    const unitId = Number(id);
    if (!Number.isInteger(unitId) || unitId < 1) {
      return { data: { units: [], coverage: [] }, datasetVersion: 0 };
    }
    const repository = geographyRepository();
    const [units, coverage] = await Promise.all([
      repository.childrenOf(unitId),
      repository.coverageIn(unitId),
    ]);
    return { data: { units, coverage }, datasetVersion: 0 };
  });
}
