"use client";

import { useMemo } from "react";
import type { DataState, DocumentSummary, GeoUnit } from "@lokdarpan/domain";
import type { StateOption } from "@/data/geography";
import type { FeatureCollection } from "geojson";
import { useResource } from "@/lib/use-resource";

/**
 * The explorer's reads.
 *
 * Every read goes through the shared resource cache (`@/lib/use-resource`), so
 * two panels asking for the same thing share one request, a place the reader
 * returns to draws from memory, and a newer dataset version seen by any panel
 * makes the others read again rather than sit on an older ledger (ADR-064).
 *
 * Each fails closed to an empty result rather than to stale data: showing the
 * previous area's records under a new heading is worse than showing none.
 *
 * Boundaries are held once, in the cache, and handed to a MapLibre source by
 * reference; they are replaced wholesale on the next selection and React
 * never diffs them.
 */

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
  /** The same facts in the shared data-state model (ADR-054). What the panels read. */
  readonly state: DataState;
}

export interface LevelState {
  readonly units: readonly GeoUnit[];
  readonly coverage: readonly LevelCoverage[];
  readonly boundaries: FeatureCollection | null;
  readonly loading: boolean;
  readonly failed: boolean;
}

interface LevelPayload {
  readonly units: GeoUnit[];
  readonly coverage: LevelCoverage[];
  readonly boundaries: FeatureCollection;
}

/**
 * The units inside a place, whatever levels those turn out to be, with their
 * boundaries and coverage — one request, one dataset version.
 *
 * The caller does not say what it expects. A district may hold talukas,
 * municipal bodies and villages at once, and the panel groups whatever comes
 * back by level rather than assuming a fixed sequence.
 */
export function useLevel(unitId: number | null): LevelState {
  const { data, loading, failed } = useResource<LevelPayload>(
    unitId === null ? null : `/api/v1/geo/units/${String(unitId)}/level`,
  );
  return {
    units: data?.units ?? [],
    coverage: data?.coverage ?? [],
    boundaries: data?.boundaries ?? null,
    loading,
    failed,
  };
}

export interface UnitDetail {
  readonly unit: GeoUnit;
  readonly ancestors: readonly GeoUnit[];
  readonly geometry: unknown;
}

/** One unit with its ancestors and its own boundary, for framing and breadcrumbs. */
export function useUnit(unitId: number | null): UnitDetail | null {
  return useResource<UnitDetail>(unitId === null ? null : `/api/v1/geo/units/${String(unitId)}`)
    .data;
}

export interface RecordsState {
  readonly documents: readonly DocumentSummary[];
  readonly loading: boolean;
  readonly failed: boolean;
}

/**
 * Documents filed against the selected unit, by `admin_unit.id`.
 *
 * Keyed on the unit the reader is actually looking at, not on the state they
 * are inside. Before this, every level asked for the state's records, so a
 * district and a municipal corporation showed the same thirty state-wide audit
 * reports and a reader could only read that as findings about the place they
 * had selected.
 *
 * The id rather than the LGD code: codes are per-register and collide across
 * levels, so a state's own code also names a district elsewhere.
 */
export function useRecords(unitId: number | null): RecordsState {
  const { data, loading, failed } = useResource<{ documents: DocumentSummary[] }>(
    unitId === null ? null : `/api/v1/documents?unit=${String(unitId)}`,
  );
  return { documents: data?.documents ?? [], loading, failed };
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
  const {
    units,
    coverage,
    boundaries: childBoundaries,
    loading: loadingChildren,
  } = useLevel(parentUnitId);
  const detail = useUnit(unitId);
  const records = useRecords(parentUnitId);

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
