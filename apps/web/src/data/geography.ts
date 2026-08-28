import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BBox } from "geojson";
import type { BoundaryManifest, StateSummary } from "@/domain/geography";
import { geographyRepository } from "@/server/container";

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

/**
 * Who to credit for the outlines the country view draws.
 *
 * ODbL permits redistribution and requires attribution, so this is not a nicety
 * — it is the condition on which the geometry may be shown at all, and it comes
 * from the manifest so it cannot drift from what was actually written.
 */
export async function stateOutlineSource(): Promise<{
  readonly name: string;
  readonly attribution: string;
  readonly licence: string;
}> {
  const manifest = await loadBoundaryManifest();
  return manifest.sources.states;
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

/**
 * States, with their ledger identity attached.
 *
 * Two representations have to meet here, and the reason is honest rather than
 * accidental: the ledger holds the 36 states the Local Government Directory
 * publishes but no boundary for any of them, while the Census extract holds
 * outlines with no ledger identity. They are joined on the LGD state code,
 * which both carry and which OSM also tags as `ref:LGD:state` — so this is a
 * join on a shared registry code, not on a name.
 *
 * A state the ledger does not know is still listed with its outline, and simply
 * cannot be drilled into. That is the truthful state of affairs, and better
 * than hiding a state because our hierarchy is incomplete.
 */
export interface StateOption extends StateSummary {
  /** Ledger unit id, when the directory knows this state. Null otherwise. */
  readonly unitId: number | null;
}

export async function listStateOptions(): Promise<readonly StateOption[]> {
  const outlines = await listStates();
  const units = await ledgerStates();
  return outlines.map((state) => ({ ...state, unitId: units.get(state.code) ?? null }));
}

/**
 * Ledger state ids, or none when the ledger cannot be reached.
 *
 * A map that cannot be drawn at all because the database is down is worse than
 * a map of outlines that says nothing can be drilled into. The outlines come
 * from a file and need no database, so an unreachable ledger degrades to
 * browsing without descent rather than to a 500 — and the selector already says
 * "not in the directory" for a state it has no unit for, which is exactly what
 * is true in that case.
 */
async function ledgerStates(): Promise<ReadonlyMap<string, number>> {
  try {
    return await geographyRepository().statesByLgdCode();
  } catch (error: unknown) {
    process.stdout.write(
      `${JSON.stringify({
        level: "error",
        message: "ledger_unavailable",
        detail: error instanceof Error ? error.message : "unknown",
        service: "web",
        time: new Date().toISOString(),
      })}\n`,
    );
    return new Map();
  }
}
