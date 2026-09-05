import { tenderRepository } from "@/server/container";
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
 * `?state=<lgd code>` adds `collection`, which answers a question no count can:
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
    const repository = tenderRepository();

    const [districts, departments, windows, unplacedCount, collection] = await Promise.all([
      repository.countsByDistrict(department),
      repository.departments(),
      repository.collectionWindows(),
      repository.unplacedCount(),
      stateLgdCode === null ? Promise.resolve(null) : repository.collectionForState(stateLgdCode),
    ]);

    return {
      data: { districts, departments, windows, unplacedCount, collection },
      datasetVersion: 0,
    };
  });
}
