/**
 * The explorer's URL contract — pure, and owned by neither side.
 *
 * No `"use client"` here on purpose. The server parses the request's query
 * string with `parseExplorerState` and hands the result to the client island as
 * a prop; the client serialises back with `toQueryString`. Both sides therefore
 * run the same code, which is what keeps a deep link's server-rendered HTML and
 * its first client render identical.
 *
 * Entity URLs are NOT invented here. `/units/:id` stays the one canonical
 * address for a place (CLAUDE.md §"admin_unit is the one hierarchy"); a parallel
 * `/lokdarpan/maharashtra/nagpur` path would give one entity two indexable URLs.
 * The explorer is a view over places, so its state belongs in its query string.
 */
import type { InfrastructureType, ProjectStatus } from "@/domain/project";
import { PROJECT_STATUS_ORDER } from "@/ui/status";

export interface GeoSelection {
  readonly stateCode: string | null;
  readonly districtId: string | null;
  readonly localBodyId: string | null;
}

export interface OrgFilters {
  readonly departmentId: string | null;
  readonly infrastructureType: InfrastructureType;
  readonly statuses: readonly ProjectStatus[];
  readonly contractorId: string | null;
}

export interface ExplorerState {
  readonly geo: GeoSelection;
  readonly filters: OrgFilters;
  readonly selectedProjectId: string | null;
}

export const ALL_STATUSES: readonly ProjectStatus[] = PROJECT_STATUS_ORDER;

export const PARAM = {
  state: "state",
  district: "district",
  body: "body",
  department: "dept",
  infrastructure: "type",
  status: "status",
  contractor: "firm",
  project: "project",
} as const;

function isInfrastructureType(value: string | null): value is InfrastructureType {
  return (
    value === "road" ||
    value === "bridge" ||
    value === "flyover" ||
    value === "highway" ||
    value === "other"
  );
}

/** An unrecognised or empty status list means "show everything", never "show nothing". */
function readStatuses(raw: string | null): readonly ProjectStatus[] {
  if (raw === null || raw === "") return ALL_STATUSES;
  const wanted = raw.split(",");
  const picked = ALL_STATUSES.filter((s) => wanted.includes(s));
  return picked.length === 0 ? ALL_STATUSES : picked;
}

export const EMPTY_EXPLORER_STATE: ExplorerState = {
  geo: { stateCode: null, districtId: null, localBodyId: null },
  filters: {
    departmentId: null,
    infrastructureType: "road",
    statuses: ALL_STATUSES,
    contractorId: null,
  },
  selectedProjectId: null,
};

export function parseExplorerState(params: URLSearchParams): ExplorerState {
  const type = params.get(PARAM.infrastructure);
  return {
    geo: {
      stateCode: params.get(PARAM.state),
      districtId: params.get(PARAM.district),
      localBodyId: params.get(PARAM.body),
    },
    filters: {
      departmentId: params.get(PARAM.department),
      infrastructureType: isInfrastructureType(type) ? type : "road",
      statuses: readStatuses(params.get(PARAM.status)),
      contractorId: params.get(PARAM.contractor),
    },
    selectedProjectId: params.get(PARAM.project),
  };
}

/** Defaults are omitted, so a plain `/explore` stays a clean URL. */
export function toQueryString(state: ExplorerState): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | null): void => {
    if (value !== null && value !== "") params.set(key, value);
  };
  set(PARAM.state, state.geo.stateCode);
  set(PARAM.district, state.geo.districtId);
  set(PARAM.body, state.geo.localBodyId);
  set(PARAM.department, state.filters.departmentId);
  if (state.filters.infrastructureType !== "road") {
    set(PARAM.infrastructure, state.filters.infrastructureType);
  }
  if (state.filters.statuses.length !== ALL_STATUSES.length) {
    set(PARAM.status, state.filters.statuses.join(","));
  }
  set(PARAM.contractor, state.filters.contractorId);
  set(PARAM.project, state.selectedProjectId);
  return params.toString();
}

/** Next hands `searchParams` as a plain record; the parser wants the real thing. */
export function toSearchParams(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") params.set(key, value);
    // A repeated key is a malformed link, not a multi-select: take the first.
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}
