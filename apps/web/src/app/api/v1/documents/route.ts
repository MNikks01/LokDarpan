import { publishedFactRepository } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/**
 * The documents held, optionally scoped to one place.
 *
 * `?unit=<admin_unit id>` returns the documents filed against exactly that
 * unit — not its state's, and not its children's. Selecting a district that has
 * nothing filed against it returns nothing, which is the honest answer and the
 * reason the panel must not phrase it as an absence of audits.
 *
 * The id, not the LGD code this used to take: LGD codes are per-register and
 * collide across levels, so a state's own code also names a district elsewhere
 * and the old scoping could return another state's records.
 *
 * `?unresolved=true` returns the documents no unit could be established for, so
 * they stay reachable rather than vanishing because no page claims them.
 */
export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    const params = new URL(request.url).searchParams;
    const repository = publishedFactRepository();

    if (params.get("unresolved") === "true") {
      return {
        data: { documents: await repository.listUnattributedDocuments() },
        datasetVersion: 0,
      };
    }

    // Validated as a positive integer rather than trusted: it reaches a query,
    // and an id is a number.
    const raw = params.get("unit");
    const unitId = raw === null || raw === "" ? null : Number(raw);
    if (unitId !== null && (!Number.isInteger(unitId) || unitId < 1)) {
      // A malformed id is not a request for everything. Answering with the whole
      // ledger would put every state's records under whatever was selected.
      return { data: { documents: [] }, datasetVersion: 0 };
    }

    const documents =
      unitId === null
        ? await repository.listDocuments()
        : await repository.listDocumentsForUnit(unitId);
    return { data: { documents }, datasetVersion: 0 };
  });
}
