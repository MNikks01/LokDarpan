import { NextResponse } from "next/server";
import { demoRepositories } from "@/data/demo-repository";
import { DEMO_DATASET_VERSION } from "@/data/demo/sources";

/**
 * Search. Present here because `.docs/11-api/client-api-contract.md` §7 lists a
 * search endpoint as a P0 gap — the API documentation has none at all — so the
 * client is written against the shape that endpoint will have rather than
 * against a client-side array scan that would have to be deleted later.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const term = new URL(request.url).searchParams.get("q") ?? "";
  const results = await demoRepositories.search.search(term);
  return NextResponse.json(
    {
      data: { results },
      meta: { datasetVersion: DEMO_DATASET_VERSION, asOf: new Date().toISOString() },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
