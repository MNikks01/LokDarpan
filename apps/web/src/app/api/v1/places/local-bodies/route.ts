import { NextResponse } from "next/server";
import { demoRepositories } from "@/data/demo-repository";
import { DEMO_DATASET_VERSION } from "@/data/demo/sources";

export async function GET(request: Request): Promise<NextResponse> {
  const districtId = new URL(request.url).searchParams.get("district");
  if (districtId === null) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "A `district` id is required." } },
      { status: 400 },
    );
  }
  const localBodies = await demoRepositories.geography.listLocalBodies(districtId);
  return NextResponse.json({
    data: { localBodies },
    meta: { datasetVersion: DEMO_DATASET_VERSION, asOf: new Date().toISOString() },
  });
}
