import { NextResponse } from "next/server";
import { demoRepositories } from "@/data/demo-repository";
import type { ProjectQuery } from "@/data/repositories";
import { DEMO_DATASET_VERSION } from "@/data/demo/sources";
import type { InfrastructureType, ProjectStatus } from "@/domain/project";
import { PROJECT_STATUS_ORDER } from "@/ui/status";

const INFRASTRUCTURE: readonly InfrastructureType[] = [
  "road",
  "bridge",
  "flyover",
  "highway",
  "other",
];

/**
 * Works matching a query. The query is parsed defensively rather than cast: a
 * status the client invented must not become a filter the repository silently
 * matches nothing against, because an empty map is indistinguishable from a
 * genuine absence of records.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const params = new URL(request.url).searchParams;

  const type = params.get("type");
  const statuses = (params.get("status") ?? "")
    .split(",")
    .filter((value): value is ProjectStatus =>
      PROJECT_STATUS_ORDER.includes(value as ProjectStatus),
    );

  // `exactOptionalPropertyTypes` means an absent filter must be an absent KEY,
  // not a key holding undefined, so the present ones are collected first.
  const scalars: Readonly<Record<string, string | null>> = {
    stateCode: params.get("state"),
    districtId: params.get("district"),
    localBodyId: params.get("body"),
    departmentId: params.get("dept"),
    contractorId: params.get("firm"),
  };
  const present = Object.fromEntries(
    Object.entries(scalars).filter((entry): entry is [string, string] => entry[1] !== null),
  );
  const infrastructure = INFRASTRUCTURE.find((known) => known === type);

  const query: ProjectQuery = {
    ...present,
    ...(infrastructure === undefined ? {} : { infrastructureType: infrastructure }),
    ...(statuses.length > 0 ? { statuses } : {}),
  };

  const page = await demoRepositories.projects.find(query);
  return NextResponse.json({
    data: { projects: page.projects, matchedCount: page.matchedCount },
    meta: { datasetVersion: DEMO_DATASET_VERSION, asOf: new Date().toISOString() },
  });
}
