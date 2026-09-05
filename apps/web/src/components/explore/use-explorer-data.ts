"use client";

import { useEffect, useMemo, useState } from "react";
import type { DocumentSummary, GeoUnit } from "@lokdarpan/domain";
import type { StateOption } from "@/data/geography";
import type { FeatureCollection } from "geojson";

/**
 * The explorer's reads, one hook per resource.
 *
 * Each aborts its in-flight request when its input changes, which is what stops
 * a reader clicking through four places quickly from ending up with the second
 * one's data under the fourth one's heading. Each fails closed to an empty
 * result rather than to stale data: showing the previous area's records under a
 * new heading is worse than showing none.
 *
 * Nothing here holds geometry in React state beyond the one collection the map
 * is currently drawing. Boundaries go from `fetch` to a MapLibre source and are
 * replaced wholesale on the next selection — React never diffs them.
 */

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} returned ${String(response.status)}`);
  return (await response.json()) as T;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * How complete our holdings are at one level inside the unit being browsed.
 *
 * Travels with the children so the list cannot be read as a census of the
 * place. `not_collected` and an empty list are different claims: the first says
 * nobody looked, the second says nothing was found, and only the first can be
 * true while the places exist.
 */
export interface LevelCoverage {
  readonly level: string;
  readonly status: "complete" | "partial" | "not_collected";
  readonly note: string | null;
  readonly sourceId: string;
  readonly checkedAt: string;
  readonly inherited: boolean;
}

export interface ChildrenState {
  readonly units: readonly GeoUnit[];
  readonly coverage: readonly LevelCoverage[];
  readonly loading: boolean;
  readonly failed: boolean;
}

/**
 * The units inside a place, whatever levels those turn out to be.
 *
 * The caller does not say what it expects. A district may hold talukas,
 * municipal bodies and villages at once, and the panel groups whatever comes
 * back by level rather than assuming a fixed sequence.
 */
export function useChildUnits(unitId: number | null): ChildrenState {
  const [state, setState] = useState<ChildrenState>({
    units: [],
    coverage: [],
    loading: false,
    failed: false,
  });

  useEffect(() => {
    if (unitId === null) {
      setState({ units: [], coverage: [], loading: false, failed: false });
      return;
    }
    const controller = new AbortController();
    setState({ units: [], coverage: [], loading: true, failed: false });

    readJson<{ data: { units: GeoUnit[]; coverage: LevelCoverage[] } }>(
      `/api/v1/geo/units/${String(unitId)}/children`,
      controller.signal,
    )
      .then((body) => {
        setState({
          units: body.data.units,
          coverage: body.data.coverage,
          loading: false,
          failed: false,
        });
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ units: [], coverage: [], loading: false, failed: true });
      });

    return () => {
      controller.abort();
    };
  }, [unitId]);

  return state;
}

/** Boundary geometry for one level, simplified server-side. */
export function useChildBoundaries(unitId: number | null): FeatureCollection | null {
  const [collection, setCollection] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    if (unitId === null) {
      setCollection(null);
      return;
    }
    const controller = new AbortController();
    readJson<{ data: FeatureCollection }>(
      `/api/v1/geo/units/${String(unitId)}/boundaries`,
      controller.signal,
    )
      .then((body) => {
        setCollection(body.data);
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setCollection(null);
      });
    return () => {
      controller.abort();
    };
  }, [unitId]);

  return collection;
}

export interface UnitDetail {
  readonly unit: GeoUnit;
  readonly ancestors: readonly GeoUnit[];
  readonly geometry: unknown;
}

/** One unit with its ancestors and its own boundary, for framing and breadcrumbs. */
export function useUnit(unitId: number | null): UnitDetail | null {
  const [detail, setDetail] = useState<UnitDetail | null>(null);

  useEffect(() => {
    if (unitId === null) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    readJson<{ data: UnitDetail }>(`/api/v1/geo/units/${String(unitId)}`, controller.signal)
      .then((body) => {
        setDetail(body.data);
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) setDetail(null);
      });
    return () => {
      controller.abort();
    };
  }, [unitId]);

  return detail;
}

export interface RecordsState {
  readonly documents: readonly DocumentSummary[];
  readonly loading: boolean;
  readonly failed: boolean;
}

/**
 * Documents recorded against a unit, by LGD code.
 *
 * Keyed on the LGD code because that is what `document.admin_unit_id` resolves
 * to, and because the map's state codes are LGD codes — so a selection
 * addresses the ledger directly with no name matching in between.
 */
export function useRecords(lgdCode: string | null): RecordsState {
  const [state, setState] = useState<RecordsState>({
    documents: [],
    loading: false,
    failed: false,
  });

  useEffect(() => {
    if (lgdCode === null) {
      setState({ documents: [], loading: false, failed: false });
      return;
    }
    const controller = new AbortController();
    setState({ documents: [], loading: true, failed: false });

    readJson<{ data: { documents: DocumentSummary[] } }>(
      `/api/v1/documents?unit=${encodeURIComponent(lgdCode)}`,
      controller.signal,
    )
      .then((body) => {
        setState({ documents: body.data.documents, loading: false, failed: false });
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ documents: [], loading: false, failed: true });
      });

    return () => {
      controller.abort();
    };
  }, [lgdCode]);

  return state;
}

/**
 * Everything the explorer needs to know about where the reader is.
 *
 * Bundled so the shell reads as composition rather than as a run of optional
 * chains. The drill-down descends from the selected unit when there is one and
 * from the state's own ledger unit otherwise — which is what lets the same
 * control serve state → district and district → municipal body.
 */
export interface ExplorerGeography {
  readonly selectedState: StateOption | null;
  readonly units: readonly GeoUnit[];
  /** What is known about how complete `units` is. Never inferred from its length. */
  readonly coverage: readonly LevelCoverage[];
  readonly loadingChildren: boolean;
  readonly childBoundaries: FeatureCollection | null;
  readonly activeUnit: GeoUnit | null;
  readonly activeGeometry: unknown;
  readonly ancestors: readonly GeoUnit[];
  readonly records: RecordsState;
  readonly scopeLabel: string;
}

export function useExplorerGeography(
  states: readonly StateOption[],
  stateCode: string | null,
  unitId: number | null,
): ExplorerGeography {
  const selectedState = useMemo(
    () => states.find((s) => s.code === stateCode) ?? null,
    [stateCode, states],
  );

  const parentUnitId = unitId ?? selectedState?.unitId ?? null;
  const { units, coverage, loading: loadingChildren } = useChildUnits(parentUnitId);
  const childBoundaries = useChildBoundaries(parentUnitId);
  const detail = useUnit(unitId);
  const records = useRecords(stateCode);

  return {
    selectedState,
    units,
    coverage,
    loadingChildren,
    childBoundaries,
    ...unpackDetail(detail),
    records,
    scopeLabel: scopeLabelFor(detail, selectedState),
  };
}

/** The optional parts of a unit detail, defaulted once rather than at each use. */
function unpackDetail(detail: UnitDetail | null): {
  readonly activeUnit: GeoUnit | null;
  readonly activeGeometry: unknown;
  readonly ancestors: readonly GeoUnit[];
} {
  if (detail === null) return { activeUnit: null, activeGeometry: null, ancestors: [] };
  return { activeUnit: detail.unit, activeGeometry: detail.geometry, ancestors: detail.ancestors };
}

/** The narrowest place the reader has selected, for panel headings. */
function scopeLabelFor(detail: UnitDetail | null, state: StateOption | null): string {
  if (detail !== null) return detail.unit.name;
  if (state !== null) return state.name;
  return "India";
}
