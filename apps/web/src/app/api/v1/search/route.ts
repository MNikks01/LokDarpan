import { geographyRepository } from "@/server/container";
import { respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/** How many results a reader can usefully scan before the list stops helping. */
const LIMIT = 12;

/**
 * Search across places and records.
 *
 * `.docs/11-api/client-api-contract.md` §7 lists search as a P0 gap — the API
 * documentation has none — so the client is written against the shape that
 * endpoint will have rather than against a client-side scan that would have to
 * be deleted at the first real dataset.
 */
export function GET(request: Request): Promise<Response> {
  return respond(request, async () => {
    const term = new URL(request.url).searchParams.get("q") ?? "";
    const results = await geographyRepository().search(term, LIMIT);
    return { data: { results }, datasetVersion: 0 };
  });
}
