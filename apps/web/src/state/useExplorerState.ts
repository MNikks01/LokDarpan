"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { EMPTY_EXPLORER_STATE, toQueryString, type ExplorerState } from "./explorer-url";

export type { ExplorerState, GeoSelection } from "./explorer-url";
export { EMPTY_EXPLORER_STATE, parseExplorerState } from "./explorer-url";

/**
 * Explorer state: where you are, and which record is open.
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
      // A unit id from Maharashtra is meaningless once the reader moves to
      // Gujarat, and a record is recorded against a unit — both are dropped.
      apply(() => ({ geo: { stateCode, unitId: null }, selectedDocumentId: null }));
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
        apply((previous) => ({ ...previous, geo: { stateCode, unitId } }));
      },
      selectDocument: (selectedDocumentId) => {
        apply((previous) => ({ ...previous, selectedDocumentId }));
      },
      resetAll: () => {
        apply(() => EMPTY_EXPLORER_STATE);
      },
    }),
    [apply, selectState],
  );

  return { ...state, actions };
}
