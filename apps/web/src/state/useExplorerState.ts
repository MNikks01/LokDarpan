"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { InfrastructureType, ProjectStatus } from "@/domain/project";
import {
  ALL_STATUSES,
  EMPTY_EXPLORER_STATE,
  toQueryString,
  type ExplorerState,
} from "./explorer-url";

export type { ExplorerState, GeoSelection, OrgFilters } from "./explorer-url";
export { ALL_STATUSES, EMPTY_EXPLORER_STATE, parseExplorerState } from "./explorer-url";

/**
 * Explorer state, split the way the product is: where you are, what you are
 * filtering for, and what the interface is doing. They change for different
 * reasons and at different rates, so they are three values rather than one
 * object — a status toggle must not invalidate anything that depends on place.
 *
 * The initial value is PARSED ON THE SERVER and passed in, never read from
 * `window` here. See `explorer-url.ts` for why.
 *
 * Updates are mirrored into the query string with `history.replaceState`, not
 * `router.replace`. The distinction matters: this page's content is already in
 * the browser, and a router navigation would send the whole selection back to
 * the server for a re-render that produces the same markup. Shallow updates keep
 * the drill-down at interaction speed and still leave a URL that can be copied
 * into a message.
 */
function writeUrl(state: ExplorerState): void {
  if (typeof window === "undefined") return;
  const query = toQueryString(state);
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${query === "" ? "" : `?${query}`}`,
  );
}

/**
 * Declared as function PROPERTIES rather than methods. A method signature is
 * bivariant and `this`-bearing, so handing `actions.selectState` straight to an
 * `onChange` is flagged as an unbound method; a property type says what these
 * actually are — closures with no receiver.
 */
export interface ExplorerActions {
  readonly selectState: (stateCode: string | null) => void;
  readonly selectDistrict: (districtId: string | null) => void;
  readonly selectLocalBody: (localBodyId: string | null) => void;
  readonly selectPlace: (stateCode: string | null, districtId: string | null) => void;
  readonly setDepartment: (departmentId: string | null) => void;
  readonly setInfrastructureType: (type: InfrastructureType) => void;
  readonly toggleStatus: (status: ProjectStatus) => void;
  readonly setContractor: (contractorId: string | null) => void;
  readonly selectProject: (projectId: string | null) => void;
  readonly resetFilters: () => void;
  readonly resetAll: () => void;
}

export function useExplorerState(
  initial: ExplorerState,
): ExplorerState & { readonly actions: ExplorerActions } {
  const [state, setState] = useState<ExplorerState>(initial);
  // The URL is written from a ref-stable callback so the actions object below
  // never changes identity, which keeps the map from re-binding its handlers.
  const apply = useRef((next: (previous: ExplorerState) => ExplorerState) => {
    setState((previous) => {
      const value = next(previous);
      writeUrl(value);
      return value;
    });
  }).current;

  const selectState = useCallback(
    (stateCode: string | null) => {
      apply((previous) => ({
        ...previous,
        // Narrower selections cannot survive a change of state — a district id
        // from Maharashtra is meaningless once the reader moves to Gujarat.
        geo: { stateCode, districtId: null, localBodyId: null },
        filters: { ...previous.filters, departmentId: null },
        selectedProjectId: null,
      }));
    },
    [apply],
  );

  const selectDistrict = useCallback(
    (districtId: string | null) => {
      apply((previous) => ({
        ...previous,
        geo: { ...previous.geo, districtId, localBodyId: null },
        selectedProjectId: null,
      }));
    },
    [apply],
  );

  const selectLocalBody = useCallback(
    (localBodyId: string | null) => {
      apply((previous) => ({
        ...previous,
        geo: { ...previous.geo, localBodyId },
        selectedProjectId: null,
      }));
    },
    [apply],
  );

  const selectPlace = useCallback(
    (stateCode: string | null, districtId: string | null) => {
      apply((previous) => ({
        ...previous,
        geo: { stateCode, districtId, localBodyId: null },
        selectedProjectId: null,
      }));
    },
    [apply],
  );

  const actions = useMemo<ExplorerActions>(
    () => ({
      selectState,
      selectDistrict,
      selectLocalBody,
      selectPlace,
      setDepartment: (departmentId) => {
        apply((previous) => ({ ...previous, filters: { ...previous.filters, departmentId } }));
      },
      setInfrastructureType: (infrastructureType) => {
        apply((previous) => ({
          ...previous,
          filters: { ...previous.filters, infrastructureType },
          selectedProjectId: null,
        }));
      },
      toggleStatus: (status) => {
        apply((previous) => {
          const active = previous.filters.statuses.includes(status);
          const next = active
            ? previous.filters.statuses.filter((s) => s !== status)
            : ALL_STATUSES.filter((s) => s === status || previous.filters.statuses.includes(s));
          // Turning off the last status would show an empty map with no way
          // back that reads as a bug; keep at least one on.
          return next.length === 0
            ? previous
            : { ...previous, filters: { ...previous.filters, statuses: next } };
        });
      },
      setContractor: (contractorId) => {
        apply((previous) => ({ ...previous, filters: { ...previous.filters, contractorId } }));
      },
      selectProject: (selectedProjectId) => {
        apply((previous) => ({ ...previous, selectedProjectId }));
      },
      resetFilters: () => {
        apply((previous) => ({
          ...previous,
          filters: {
            departmentId: null,
            infrastructureType: "road",
            statuses: ALL_STATUSES,
            contractorId: null,
          },
        }));
      },
      resetAll: () => {
        apply(() => EMPTY_EXPLORER_STATE);
      },
    }),
    [apply, selectState, selectDistrict, selectLocalBody, selectPlace],
  );

  return { ...state, actions };
}
