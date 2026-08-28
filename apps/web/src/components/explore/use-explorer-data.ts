"use client";

import { useEffect, useState } from "react";
import type { DistrictSummary, LocalBody } from "@/domain/geography";
import type { ProjectSummary } from "@/domain/project";
import type { GeoSelection, OrgFilters } from "@/state/useExplorerState";

/**
 * The explorer's reads, one hook per resource.
 *
 * Each one aborts its in-flight request when its input changes, which is what
 * stops a reader clicking through four districts quickly from ending up with
 * the second district's works on the fourth district's map. Every hook fails
 * closed to an empty result rather than to stale data: showing the previous
 * area's records under a new heading is worse than showing none.
 */

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} returned ${String(response.status)}`);
  return (await response.json()) as T;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useDistricts(stateCode: string | null): {
  readonly districts: readonly DistrictSummary[];
  readonly loading: boolean;
} {
  const [districts, setDistricts] = useState<readonly DistrictSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stateCode === null) {
      setDistricts([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    readJson<{ data: { districts: DistrictSummary[] } }>(
      `/api/v1/places/districts?state=${encodeURIComponent(stateCode)}`,
      controller.signal,
    )
      .then((body) => {
        setDistricts(body.data.districts);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setDistricts([]);
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [stateCode]);

  return { districts, loading };
}

export function useLocalBodies(districtId: string | null): readonly LocalBody[] {
  const [localBodies, setLocalBodies] = useState<readonly LocalBody[]>([]);

  useEffect(() => {
    if (districtId === null) {
      setLocalBodies([]);
      return;
    }
    const controller = new AbortController();
    readJson<{ data: { localBodies: LocalBody[] } }>(
      `/api/v1/places/local-bodies?district=${encodeURIComponent(districtId)}`,
      controller.signal,
    )
      .then((body) => {
        setLocalBodies(body.data.localBodies);
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setLocalBodies([]);
      });
    return () => {
      controller.abort();
    };
  }, [districtId]);

  return localBodies;
}

export interface WorksState {
  readonly projects: readonly ProjectSummary[];
  readonly matchedCount: number;
  readonly loading: boolean;
}

function worksQuery(geo: GeoSelection, filters: OrgFilters): string {
  const params = new URLSearchParams();
  const entries: readonly (readonly [string, string | null])[] = [
    ["state", geo.stateCode],
    ["district", geo.districtId],
    ["body", geo.localBodyId],
    ["dept", filters.departmentId],
    ["firm", filters.contractorId],
  ];
  for (const [key, value] of entries) if (value !== null) params.set(key, value);
  params.set("type", filters.infrastructureType);
  params.set("status", filters.statuses.join(","));
  return params.toString();
}

export function useWorks(geo: GeoSelection, filters: OrgFilters, initial: WorksState): WorksState {
  const [works, setWorks] = useState<WorksState>(initial);

  useEffect(() => {
    const controller = new AbortController();
    setWorks((previous) => ({ ...previous, loading: true }));

    readJson<{ data: { projects: ProjectSummary[]; matchedCount: number } }>(
      `/api/v1/projects?${worksQuery(geo, filters)}`,
      controller.signal,
    )
      .then((body) => {
        setWorks({
          projects: body.data.projects,
          matchedCount: body.data.matchedCount,
          loading: false,
        });
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setWorks({ projects: [], matchedCount: 0, loading: false });
      });

    return () => {
      controller.abort();
    };
  }, [geo, filters]);

  return works;
}
