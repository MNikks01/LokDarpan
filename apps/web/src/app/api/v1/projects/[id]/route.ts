import { NextResponse } from "next/server";
import { demoRepositories } from "@/data/demo-repository";

/**
 * One work, with everything the detail panel shows, in one payload.
 *
 * `.docs/adr/012`: one view, one request, one `datasetVersion`. Splitting this
 * into per-section calls would let two figures on one screen carry different
 * provenance vintages — a traceability defect, not a caching preference.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const dossier = await demoRepositories.projects.getDossier(id);

  if (dossier === null) {
    return NextResponse.json(
      { error: { code: "not_found", message: `No work is held with id ${id}.` } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: dossier,
    meta: { datasetVersion: dossier.datasetVersion, asOf: new Date().toISOString() },
  });
}
