"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { LayerVisibility } from "@/map/layers/visibility";
import { EMPTY_EXPLORER_STATE, toQueryString, type ExplorerState } from "./explorer-url";

export type { ExplorerState, GeoSelection } from "./explorer-url";
export { EMPTY_EXPLORER_STATE, parseExplorerState } from "./explorer-url";

/**
 * Explorer state: where you are, which record is open, which layers are drawn
 * and which department the tenders are narrowed to.
 *
 * The initial value is PARSED ON THE SERVER and passed in, never read from
 * `window` here. A `typeof window` branch made the server render a deep link as
 * a bare "India" breadcrumb while the client rendered the full trail, and React
 * responded by discarding and regenerating the whole subtree.
 *
 * Updates are mirrored into the query string with `history.replaceState`, not
 * `router.replace`. The content is already in the browser, and a router
 * navigation would send the selection back to the server for a re-render that
 * produces the same markup.
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
  /** Any unit below state level: district, taluka, municipal body, village. */
  readonly selectUnit: (unitId: number | null) => void;
  /** State and unit together, for arriving from a search result. */
  readonly selectPlace: (stateCode: string | null, unitId: number | null) => void;
  readonly selectDocument: (documentId: number | null) => void;
  readonly toggleLayer: (key: keyof LayerVisibility) => void;
  readonly selectDepartment: (department: string | null) => void;
  /** Back to the whole country. The reader's layer choices are kept. */
  readonly resetAll: () => void;
}

export function useExplorerState(
  initial: ExplorerState,
): ExplorerState & { readonly actions: ExplorerActions } {
  const [state, setState] = useState<ExplorerState>(initial);
  // The URL is written from a ref-stable callback so the actions object below
  // never changes identity, which keeps the map from re-binding its handlers.
  //
  // Every change drops a pinned version: once the reader moves, the view is no
  // longer the one that version describes (ADR-061).
  const apply = useRef((next: (previous: ExplorerState) => ExplorerState) => {
    setState((previous) => {
      const value = { ...next(previous), pinnedVersion: null };
      writeUrl(value);
      return value;
    });
  }).current;

  const selectState = useCallback(
    (stateCode: string | null) => {
      // A unit id from Maharashtra is meaningless once the reader moves to
      // Gujarat, and a record is recorded against a unit — both are dropped. So
      // is the department: the list offered is the new state's.
      apply((previous) => ({
        ...previous,
        geo: { stateCode, unitId: null },
        selectedDocumentId: null,
        department: null,
      }));
    },
    [apply],
  );

  const actions = useMemo<ExplorerActions>(
    () => ({
      selectState,
      selectUnit: (unitId) => {
        apply((previous) => ({ ...previous, geo: { ...previous.geo, unitId } }));
      },
      selectPlace: (stateCode, unitId) => {
        apply((previous) => ({
          ...previous,
          geo: { stateCode, unitId },
          department: stateCode === previous.geo.stateCode ? previous.department : null,
        }));
      },
      selectDocument: (selectedDocumentId) => {
        apply((previous) => ({ ...previous, selectedDocumentId }));
      },
      toggleLayer: (key) => {
        apply((previous) => ({
          ...previous,
          layers: { ...previous.layers, [key]: !previous.layers[key] },
        }));
      },
      selectDepartment: (department) => {
        apply((previous) => ({ ...previous, department }));
      },
      resetAll: () => {
        apply((previous) => ({ ...EMPTY_EXPLORER_STATE, layers: previous.layers }));
      },
    }),
    [apply, selectState],
  );

  return { ...state, actions };
}
