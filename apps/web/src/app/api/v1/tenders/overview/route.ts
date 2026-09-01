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
 */
export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    const requested = new URL(request.url).searchParams.get("department");
    const department = requested === null || requested === "" ? undefined : requested;
    const repository = tenderRepository();

    const [districts, departments, windows, unplacedCount] = await Promise.all([
      repository.countsByDistrict(department),
      repository.departments(),
      repository.collectionWindows(),
      repository.unplacedCount(),
    ]);

    return { data: { districts, departments, windows, unplacedCount }, datasetVersion: 0 };
  });
}
