import { NextResponse } from "next/server";
import { GeometryNotInstalledError, listDistricts } from "@/data/geography";

export async function GET(request: Request): Promise<NextResponse> {
  const stateCode = new URL(request.url).searchParams.get("state");
  if (stateCode === null) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "A `state` code is required." } },
      { status: 400 },
    );
  }
  try {
    const districts = await listDistricts(stateCode);
    return NextResponse.json({ data: { districts } });
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
