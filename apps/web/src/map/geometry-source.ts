/**
 * Client-side access to boundary geometry.
 *
 * Geometry is fetched per view, not bundled: the national outlines are ~160 KB
 * and a single state's districts ~60 KB, so loading all 36 states' districts up
 * front would cost megabytes for a reader who looks at one district. Each file
 * is fetched once and kept, because a reader drilling in and back out again is
 * the normal path and should not re-download.
 *
 * This is the seam where vector tiles go when the dataset outgrows files. The
 * two functions below are all the map knows about how geometry arrives.
 */
import type { FeatureCollection } from "geojson";

export class GeometryUnavailableError extends Error {
  constructor(readonly resource: string) {
    super(
      `Boundary geometry for ${resource} could not be loaded. Run \`pnpm --filter @lokdarpan/web geo:fetch\` to prepare it.`,
    );
    this.name = "GeometryUnavailableError";
  }
}

const cache = new Map<string, Promise<FeatureCollection>>();

function load(path: string, resource: string): Promise<FeatureCollection> {
  const existing = cache.get(path);
  if (existing !== undefined) return existing;

  const request = fetch(path)
    .then(async (response) => {
      if (!response.ok) throw new GeometryUnavailableError(resource);
      return (await response.json()) as FeatureCollection;
    })
    .catch((error: unknown) => {
      // Do not cache a failure: a transient network drop must not permanently
      // blank the map for the rest of the session.
      cache.delete(path);
      throw error instanceof GeometryUnavailableError
        ? error
        : new GeometryUnavailableError(resource);
    });

  cache.set(path, request);
  return request;
}

export function fetchStateOutlines(): Promise<FeatureCollection> {
  return load("/geo/india-states.geojson", "India");
}

export function fetchDistricts(stateCode: string): Promise<FeatureCollection> {
  return load(`/geo/districts/${stateCode}.geojson`, `state ${stateCode}`);
}

export const EMPTY_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] };
