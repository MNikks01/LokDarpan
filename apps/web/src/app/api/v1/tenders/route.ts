import { inLedger } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * The tenders themselves — for one district, one department, or the unplaced.
 *
 * `?unplaced=true` is not a debugging affordance. A tender whose issuing
 * district could not be established is still a real advertisement by a real
 * government office, and it has to stay reachable rather than vanish because
 * the map has nowhere to draw it.
 */
export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    const params = new URL(request.url).searchParams;

    const unitParam = params.get("unit");
    const unitId = unitParam === null ? Number.NaN : Number(unitParam);
    const department = params.get("department");

    return inLedger(async ({ tenders }) => ({
      tenders: await tenders.listTenders({
        ...(Number.isInteger(unitId) && unitId > 0 ? { adminUnitId: unitId } : {}),
        ...(department === null || department === "" ? {} : { department }),
        unplacedOnly: params.get("unplaced") === "true",
      }),
    }));
  });
}
