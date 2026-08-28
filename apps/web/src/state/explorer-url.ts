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

export interface GeoSelection {
  readonly stateCode: string | null;
  readonly districtId: string | null;
}

export interface ExplorerState {
  readonly geo: GeoSelection;
  /** The record open in the detail panel — a source document id. */
  readonly selectedDocumentId: number | null;
}

export const PARAM = {
  state: "state",
  district: "district",
  document: "doc",
} as const;

export const EMPTY_EXPLORER_STATE: ExplorerState = {
  geo: { stateCode: null, districtId: null },
  selectedDocumentId: null,
};

export function parseExplorerState(params: URLSearchParams): ExplorerState {
  const document = params.get(PARAM.document);
  const documentId = document === null ? null : Number(document);
  return {
    geo: {
      stateCode: params.get(PARAM.state),
      districtId: params.get(PARAM.district),
    },
    selectedDocumentId:
      documentId !== null && Number.isInteger(documentId) && documentId > 0 ? documentId : null,
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
