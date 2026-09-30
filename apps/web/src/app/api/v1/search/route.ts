import { inLedger } from "@/server/container";
import { AppError, respond } from "@/server/respond";

export const dynamic = "force-dynamic";

/** Results per kind: places, reports, figures and pages each get their own. */
const LIMIT = 8;

/**
 * Longer than any place name or phrase a reader types. A search term is the one
 * input here a script controls entirely, and every character of it reaches a
 * full-text query; bounding it bounds that.
 */
const MAX_TERM_LENGTH = 100;

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
    if (term.length > MAX_TERM_LENGTH) {
      throw AppError.badRequest(`A search term is at most ${String(MAX_TERM_LENGTH)} characters.`);
    }
    return inLedger(async ({ geography }) => ({
      results: await geography.search(term, LIMIT),
    }));
  });
}
