import { portalForState, portalHomeUrl } from "@lokdarpan/domain";
import { inLedger } from "@/server/container";
import { tenderDetailsArePublishable } from "@/server/publishable";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * The tenders themselves — for one district, one department, or the unplaced.
 *
 * `?unplaced=true` is not a debugging affordance. A tender whose issuing
 * district could not be established is still a real advertisement by a real
 * government office, and it has to stay reachable rather than vanish because
 * the map has nowhere to draw it. `&state=<lgd code>` narrows that list to the
 * state's own portals, so it agrees with the count the panel shows under it.
 *
 * DETAILS ARE WITHHELD BY DEFAULT
 * Every collected portal permits reproduction only with the issuing
 * department's permission, which has not been sought (ADR-056). Until
 * `PUBLISH_TENDER_DETAILS` is set, this returns how many tenders are held and a
 * link to the state's portal, which its terms permit without asking. The
 * details are not read at all, so they cannot reach a response or a cache.
 */
export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    const params = new URL(request.url).searchParams;

    const unitParam = params.get("unit");
    const unitId = unitParam === null ? Number.NaN : Number(unitParam);
    const department = params.get("department");
    const requestedState = params.get("state");

    const filter = {
      ...(Number.isInteger(unitId) && unitId > 0 ? { adminUnitId: unitId } : {}),
      ...(department === null || department === "" ? {} : { department }),
      unplacedOnly: params.get("unplaced") === "true",
      // Validated as the shape an LGD code takes: it reaches a query.
      ...(requestedState !== null && /^\d{1,7}$/u.test(requestedState)
        ? { stateLgdCode: requestedState }
        : {}),
    };

    return inLedger(async ({ tenders, geography }) => {
      // An unplaced tender has no state, so there is no single portal to name.
      const stateCode =
        filter.adminUnitId === undefined ? null : await geography.stateCodeOf(filter.adminUnitId);
      const portal = stateCode === null ? undefined : portalForState(stateCode);
      const portalUrl = portal === undefined ? null : portalHomeUrl(portal);

      if (!tenderDetailsArePublishable()) {
        return {
          tenders: [],
          detailsWithheld: true,
          heldCount: await tenders.countTenders(filter),
          portalUrl,
        };
      }
      // Counted separately: the list is capped, and its length would understate.
      const [listed, heldCount] = await Promise.all([
        tenders.listTenders(filter),
        tenders.countTenders(filter),
      ]);
      return { tenders: listed, detailsWithheld: false, heldCount, portalUrl };
    });
  });
}
