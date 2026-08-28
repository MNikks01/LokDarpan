import { NextResponse } from "next/server";
import { GeometryNotInstalledError, demoRepositories } from "@/data/demo-repository";
import { DEMO_DATASET_VERSION } from "@/data/demo/sources";

export async function GET(request: Request): Promise<NextResponse> {
  const stateCode = new URL(request.url).searchParams.get("state");
  if (stateCode === null) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "A `state` code is required." } },
      { status: 400 },
    );
  }
  try {
    const districts = await demoRepositories.geography.listDistricts(stateCode);
    return NextResponse.json({
      data: { districts },
      meta: { datasetVersion: DEMO_DATASET_VERSION, asOf: new Date().toISOString() },
    });
  } catch (error: unknown) {
    if (error instanceof GeometryNotInstalledError) {
      return NextResponse.json(
        {
          error: { code: "geometry_not_installed", message: error.message, remedy: error.command },
        },
        { status: 503 },
      );
    }
    throw error;
  }
}
