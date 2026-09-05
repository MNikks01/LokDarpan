/**
 * The explorer's URL contract — pure, and owned by neither side.
 *
 * No `"use client"` here on purpose. The server parses the request's query
 * string and hands the result to the client island as a prop; the client
 * serialises back. Both sides run the same code, which is what keeps a deep
 * link's server-rendered HTML and its first client render identical.
 *
 * WHAT IS IN THE URL
 * Navigational state only: where the reader is, and what they have open. The
 * camera is not — a URL that changed on every pan would be unshareable, and the
 * position is derived from the selection anyway.
 *
 * `unit` is a ledger id rather than a code, because a code is ambiguous: Nagpur
 * is district 484 in the Local Government Directory and 505 in the Census
 * extract. The ledger id names exactly one row.
 */

export interface GeoSelection {
  /** LGD state code, e.g. "27". States are addressed by code because the ledger
   *  holds no boundary for them and the outline comes from a separate source. */
  readonly stateCode: string | null;
  /** Ledger `admin_unit.id` for anything below state level. */
  readonly unitId: number | null;
}

export interface ExplorerState {
  readonly geo: GeoSelection;
  /** The record open in the detail panel — a source document id. */
  readonly selectedDocumentId: number | null;
}

export const PARAM = {
  state: "state",
  unit: "unit",
  document: "doc",
} as const;

export const EMPTY_EXPLORER_STATE: ExplorerState = {
  geo: { stateCode: null, unitId: null },
  selectedDocumentId: null,
};

function positiveInt(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function parseExplorerState(params: URLSearchParams): ExplorerState {
  return {
    geo: {
      stateCode: params.get(PARAM.state),
      unitId: positiveInt(params.get(PARAM.unit)),
    },
    selectedDocumentId: positiveInt(params.get(PARAM.document)),
  };
}

/**
 * A selection naming one state and a unit inside another is not a selection.
 *
 * The two travel independently in the query string, so an edited or truncated
 * link can pair them freely. Nothing checked it: `?state=27&unit=<a Kerala
 * district>` rendered the selector as Maharashtra, framed the map on Kerala and
 * drew Kerala's breadcrumb under a Maharashtra heading — every part correct on
 * its own, and the page as a whole saying something false.
 *
 * The state is kept and the unit dropped, never the reverse. The state is the
 * coarser claim and the one a reader almost certainly meant; taking the unit's
 * state instead would move someone who mistyped an id into a different state
 * without saying so.
 *
 * `actualStateCode` is the state the unit really sits in, or null where the unit
 * does not exist or has no state above it. Both are grounds to drop it: a unit
 * that cannot be placed cannot be shown under a state.
 */
export function reconcile(state: ExplorerState, actualStateCode: string | null): ExplorerState {
  const { stateCode, unitId } = state.geo;
  if (stateCode === null || unitId === null) return state;
  if (actualStateCode === stateCode) return state;
  return { ...state, geo: { stateCode, unitId: null } };
}

/** Defaults are omitted, so a plain `/explore` stays a clean URL. */
export function toQueryString(state: ExplorerState): string {
  const params = new URLSearchParams();
  const set = (key: string, value: string | null): void => {
    if (value !== null && value !== "") params.set(key, value);
  };
  set(PARAM.state, state.geo.stateCode);
  set(PARAM.unit, state.geo.unitId === null ? null : String(state.geo.unitId));
  set(PARAM.document, state.selectedDocumentId === null ? null : String(state.selectedDocumentId));
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
