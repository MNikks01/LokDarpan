#!/usr/bin/env tsx
/**
 * Build-time preparation of administrative boundary geometry.
 *
 * WHY THIS IS A SCRIPT AND NOT COMMITTED DATA
 * The upstream repository publishes Census-2011-derived district polygons but
 * declares no licence. `.docs/17-legal/legal-ethical-rules.md` and the source
 * registry rule both forbid republishing material whose terms we have not
 * established, so the geometry is fetched into a gitignored directory at setup
 * and never checked in. `apps/web/public/geo/manifest.json` records the source,
 * the pinned commit and the retrieval date, so what is on disk is traceable —
 * the same standard the ingestion pipeline applies to government sources.
 *
 * Run: pnpm --filter @lokdarpan/web geo:fetch
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bbox from "@turf/bbox";
import dissolve from "@turf/dissolve";
import flatten from "@turf/flatten";
import simplify from "@turf/simplify";
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from "geojson";

/** Pinned to a commit: an unpinned `main` would change geometry under us silently. */
const SOURCE = {
  name: "india-maps-data (Census 2011 administrative boundaries)",
  repository: "https://github.com/udit-001/india-maps-data",
  commit: "2884453",
  url: "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@2884453/geojson/india.geojson",
  licence: "unknown — not declared by the upstream repository as of retrieval",
} as const;

/**
 * Two resolutions, because one does not serve both views. The national view
 * draws 700+ polygons at once and must stay under a few hundred kilobytes; a
 * single state is drawn alone and can afford ten times the vertex budget.
 */
const TOLERANCE_NATIONAL = 0.02;
const TOLERANCE_STATE = 0.004;

interface SourceProperties {
  readonly st_nm: string;
  readonly st_code: string;
  readonly district: string;
  readonly dt_code: string;
}

type AreaFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function simplified(feature: AreaFeature, tolerance: number): AreaFeature {
  // `mutate` is safe here: every feature is freshly parsed JSON owned by this
  // process, and copying 700 polygons twice is the slowest part of the run.
  return simplify(feature, { tolerance, highQuality: false, mutate: true });
}

/**
 * A point to hang a place's label on.
 *
 * The centroid of the largest ring, not the centre of the bounding box: for a
 * long or crooked state the bbox centre can sit well outside the land, and a
 * label floating in the sea beside Maharashtra reads as an error. Computed here
 * rather than in the browser because it depends only on geometry, and geometry
 * is what this script already has in memory.
 */
function labelPointOf(feature: AreaFeature): [number, number] {
  const largest = largestRing(feature);
  if (largest === null) {
    const [west, south, east, north] = bbox(feature);
    return [(west + east) / 2, (south + north) / 2];
  }
  return ringCentroid(largest);
}

/**
 * How much land the place actually covers, used to rank labels when two
 * collide. NOT the bounding-box area: a territory with scattered enclaves —
 * Puducherry spans four of them, 800 km apart — has an enormous bbox and a tiny
 * footprint, and ranking by bbox let it outrank Tamil Nadu and suppress it.
 */
function labelWeightOf(feature: AreaFeature): number {
  const largest = largestRing(feature);
  return largest === null ? 0 : Math.abs(signedArea(largest));
}

/** The ring enclosing the most area — a state's mainland, not its islands. */
function largestRing(feature: AreaFeature): Position[] | null {
  const rings =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates[0]]
      : feature.geometry.coordinates.map((polygon) => polygon[0]);

  let best: Position[] | null = null;
  let bestArea = 0;
  for (const ring of rings) {
    if (ring === undefined || ring.length < 3) continue;
    const area = Math.abs(signedArea(ring));
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  return best;
}

function ringCentroid(ring: readonly Position[]): [number, number] {
  const area = signedArea(ring);
  let x = 0;
  let y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    if (a === undefined || b === undefined) continue;
    const cross = (a[0] ?? 0) * (b[1] ?? 0) - (b[0] ?? 0) * (a[1] ?? 0);
    x += ((a[0] ?? 0) + (b[0] ?? 0)) * cross;
    y += ((a[1] ?? 0) + (b[1] ?? 0)) * cross;
  }
  return [x / (6 * area), y / (6 * area)];
}

function signedArea(ring: readonly Position[]): number {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    if (a === undefined || b === undefined) continue;
    total += (a[0] ?? 0) * (b[1] ?? 0) - (b[0] ?? 0) * (a[1] ?? 0);
  }
  return total / 2;
}

/**
 * A state's national-view shape. Preferred: the outline the source publishes.
 * Fallback: dissolve its districts — which must run on flattened polygons,
 * because dissolve rejects MultiPolygon input.
 */
function outlineGeometry(
  stateCode: string,
  districts: readonly AreaFeature[],
  published: ReadonlyMap<string, Feature<Polygon | MultiPolygon, SourceProperties>>,
): Polygon | MultiPolygon {
  const asPublished = published.get(stateCode);
  if (asPublished !== undefined) {
    return simplified(
      { type: "Feature", properties: {}, geometry: asPublished.geometry },
      TOLERANCE_NATIONAL,
    ).geometry;
  }

  const parts = flatten({
    type: "FeatureCollection",
    features: districts.map((f) => simplified(structuredClone(f), TOLERANCE_NATIONAL)),
  } as FeatureCollection<Polygon | MultiPolygon>);
  const merged = dissolve(parts);
  const only = merged.features[0];
  if (merged.features.length === 1 && only !== undefined) return only.geometry;
  return { type: "MultiPolygon", coordinates: merged.features.map((f) => f.geometry.coordinates) };
}

async function main(): Promise<void> {
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "geo");

  process.stdout.write(`Fetching ${SOURCE.url}\n`);
  const response = await fetch(SOURCE.url);
  if (!response.ok) {
    throw new Error(`boundary source returned ${String(response.status)} — geometry not written`);
  }
  const raw = (await response.json()) as FeatureCollection<
    Polygon | MultiPolygon,
    SourceProperties
  >;
  process.stdout.write(`  ${String(raw.features.length)} district features\n`);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, "districts"), { recursive: true });

  // The source mixes two kinds of feature in one collection: district polygons,
  // and whole-state outlines that carry no `district` property. Splitting them
  // here means a state outline is used as published wherever one exists, and
  // only reconstructed by dissolving districts for the states that lack one.
  const byState = new Map<string, Feature<Polygon | MultiPolygon, SourceProperties>[]>();
  const publishedOutlines = new Map<string, Feature<Polygon | MultiPolygon, SourceProperties>>();
  for (const feature of raw.features) {
    const code = feature.properties.st_code;
    if (typeof feature.properties.district !== "string") {
      publishedOutlines.set(code, feature);
      continue;
    }
    const bucket = byState.get(code);
    if (bucket === undefined) byState.set(code, [feature]);
    else bucket.push(feature);
  }

  const states: unknown[] = [];
  const districtIndex: Record<string, unknown[]> = {};
  const nationalOutlines: AreaFeature[] = [];

  for (const [stateCode, features] of [...byState.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const stateName = features[0]?.properties.st_nm ?? "Unknown";

    const districtFeatures: AreaFeature[] = features.map((f) =>
      simplified(
        {
          type: "Feature",
          properties: {
            districtCode: f.properties.dt_code,
            districtName: f.properties.district,
            districtSlug: slugify(f.properties.district),
            stateCode,
            stateName,
          },
          geometry: f.geometry,
        },
        TOLERANCE_STATE,
      ),
    );

    const collection: FeatureCollection = { type: "FeatureCollection", features: districtFeatures };
    await writeFile(join(outDir, "districts", `${stateCode}.geojson`), JSON.stringify(collection));

    districtIndex[stateCode] = districtFeatures.map((f) => ({
      code: f.properties["districtCode"],
      name: f.properties["districtName"],
      slug: f.properties["districtSlug"],
      bbox: bbox(f),
      labelPoint: labelPointOf(f),
      labelWeight: labelWeightOf(f),
    }));

    const outline: AreaFeature = {
      type: "Feature",
      properties: { stateCode, stateName, stateSlug: slugify(stateName) },
      geometry: outlineGeometry(stateCode, districtFeatures, publishedOutlines),
    };
    nationalOutlines.push(outline);

    states.push({
      code: stateCode,
      name: stateName,
      slug: slugify(stateName),
      bbox: bbox(outline),
      labelPoint: labelPointOf(outline),
      labelWeight: labelWeightOf(outline),
      districtCount: districtFeatures.length,
    });
    process.stdout.write(`  ${stateName} — ${String(districtFeatures.length)} districts\n`);
  }

  await writeFile(
    join(outDir, "india-states.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: nationalOutlines }),
  );

  await writeFile(
    join(outDir, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: SOURCE,
        note: "Administrative boundaries only. Boundary depiction follows the upstream dataset and is not an authoritative statement of any border.",
        states: (states as { name: string }[]).sort((a, b) => a.name.localeCompare(b.name)),
        districts: districtIndex,
      },
      null,
      2,
    ),
  );

  process.stdout.write(`\n✓ geometry written to apps/web/public/geo\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
