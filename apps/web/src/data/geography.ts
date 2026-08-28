import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BBox } from "geojson";
import type { BoundaryManifest, DistrictSummary, StateSummary } from "@/domain/geography";

/**
 * Administrative geography, from the manifest `scripts/fetch-boundaries.ts`
 * writes.
 *
 * This is real Census 2011 geography, not demo data — the names and the
 * boundaries are what the source publishes. It is separate from the ledger:
 * `admin_unit` holds the units LokDarpan has ingested from the Local Government
 * Directory, which is currently states only, because the directory gates
 * district and village views behind a CAPTCHA. The two agree where they meet:
 * a state's code here is its LGD code, so a selection on the map addresses the
 * ledger directly.
 */

/**
 * Thrown when boundary geometry has not been prepared. A distinct type, not a
 * generic failure, because the fix is a specific command and the page can only
 * say so if it can tell this apart from a genuine error.
 */
export class GeometryNotInstalledError extends Error {
  readonly command = "pnpm --filter @lokdarpan/web geo:fetch";
  constructor() {
    super("Administrative boundary geometry has not been prepared in this checkout.");
    this.name = "GeometryNotInstalledError";
  }
}

let manifestPromise: Promise<BoundaryManifest> | null = null;

export async function loadBoundaryManifest(): Promise<BoundaryManifest> {
  manifestPromise ??= readFile(join(process.cwd(), "public", "geo", "manifest.json"), "utf8")
    .then((raw) => JSON.parse(raw) as BoundaryManifest)
    .catch(() => {
      // Reset so a later request retries rather than caching the failure for
      // the life of the process — the file appears the moment the script runs.
      manifestPromise = null;
      throw new GeometryNotInstalledError();
    });
  return manifestPromise;
}

export const districtId = (stateCode: string, districtCode: string): string =>
  `${stateCode}-${districtCode}`;

/** Fallback anchor for a manifest generated before label points existed. */
function centreOf(box: BBox): readonly [number, number] {
  const [west, south, east, north] = box;
  return [(west + east) / 2, (south + north) / 2];
}

function spanOf(box: BBox): number {
  const [west, south, east, north] = box;
  return (east - west) * (north - south);
}

export async function listStates(): Promise<readonly StateSummary[]> {
  const manifest = await loadBoundaryManifest();
  return manifest.states.map((s) => ({
    id: s.code,
    code: s.code,
    name: s.name,
    slug: s.slug,
    bbox: s.bbox,
    labelPoint: s.labelPoint ?? centreOf(s.bbox),
    labelWeight: s.labelWeight ?? spanOf(s.bbox),
    districtCount: s.districtCount,
  }));
}

export async function listDistricts(stateCode: string): Promise<readonly DistrictSummary[]> {
  const manifest = await loadBoundaryManifest();
  const districts = manifest.districts[stateCode] ?? [];
  return [...districts]
    .map((d) => ({
      id: districtId(stateCode, d.code),
      code: d.code,
      stateCode,
      name: d.name,
      slug: d.slug,
      bbox: d.bbox,
      labelPoint: d.labelPoint ?? centreOf(d.bbox),
      labelWeight: d.labelWeight ?? spanOf(d.bbox),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
