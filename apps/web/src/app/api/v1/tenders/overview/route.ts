import { describeSources, tenderCollectionState } from "@lokdarpan/domain";
import { inLedger } from "@/server/container";
import { tenderDetailsArePublishable } from "@/server/publishable";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * Everything the map needs to shade itself, in one call.
 *
 * Four things travel together because they are only truthful together: the
 * counts, the departments they can be filtered by, when collection began, and
 * how many tenders we hold but could not place. A client that fetched the
 * counts alone would draw a confident map with no way to say what is missing
 * from it.
 *
 * `?department=` narrows the counts. The department list is deliberately NOT
 * narrowed with them, so the filter still offers every other choice once one
 * has been made.
 *
 * `?state=<lgd code>` scopes the counts, the departments and the unplaced
 * total to that state. Without it they are the country's, and the panel under
 * a state was stating the country's number as the state's.
 *
 * It also adds `collection`, which answers a question no count can:
 * whether tenders are collected for that state at all. Maharashtra holds none,
 * and the panel reported "0 tenders" — a true count and a false statement,
 * because no Maharashtra portal is collected, so the zero describes our reach
 * and reads as the government's silence.
 *
 * The state is identified by its LGD code, the identity the rest of the ledger
 * resolves against, never by name.
 */
export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    const params = new URL(request.url).searchParams;
    const requested = params.get("department");
    const department = requested === null || requested === "" ? undefined : requested;
    // Validated as the shape an LGD code takes rather than trusted: it reaches a
    // query, and a state code is digits.
    const requestedState = params.get("state");
    const stateLgdCode =
      requestedState !== null && /^\d{1,7}$/u.test(requestedState) ? requestedState : null;
    // One snapshot for all five reads: the counts, the unplaced total and the
    // collection status are only truthful together if they describe one state.
    return inLedger(async ({ tenders }) => {
      const [districts, departments, windows, unplacedCount, collection] = await Promise.all([
        tenders.countsByDistrict(department, stateLgdCode ?? undefined),
        tenders.departments(stateLgdCode ?? undefined),
        tenders.collectionWindows(),
        tenders.unplacedCount(stateLgdCode ?? undefined),
        stateLgdCode === null ? Promise.resolve(null) : tenders.collectionForState(stateLgdCode),
      ]);
      const collectionState = collection === null ? null : tenderCollectionState(collection);
      return {
        districts,
        departments,
        windows,
        unplacedCount,
        collection,
        // The same facts as `collection`, in the shared data-state model (ADR-054).
        // `collection` stays for one release while the panels move over.
        collectionState,
        // Whether the panel may offer tender details at all (ADR-056).
        detailsWithheld: !tenderDetailsArePublishable(),
        // What the shading accounts for, summed here rather than in the browser:
        // client code does no arithmetic on what it shows (ADR-059, rule A).
        placed: {
          tenders: districts.reduce((sum, d) => sum + d.tenderCount, 0),
          districts: districts.length,
          // Placed by pincode or place name, not named by the issuing office.
          inferred: districts.reduce((sum, d) => sum + d.inferredCount, 0),
        },
        // The terms each portal's material is held under (ADR-055). For the whole
        // country, every collected portal contributes to the counts.
        sources: describeSources(
          collectionState === null
            ? windows.map((w) => `gepnic-${w.portalCode}`)
            : collectionState.sourceIds,
        ),
      };
    });
  });
}
