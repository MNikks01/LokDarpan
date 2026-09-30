import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BBox, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { BoundaryManifest } from "@/domain/geography";
import { loadBoundaryManifest } from "@/data/geography";

/**
 * India's state outlines as SVG paths, drawn on the server.
 *
 * The same ledger-generated geometry the explorer draws — OpenStreetMap
 * boundaries under ODbL, with the attribution and boundary note the manifest
 * carries — projected here so the homepage ships a picture, not a map library.
 * Nothing is drawn that was not loaded from that file: if it is missing, this
 * returns null and the page falls back to a schematic rather than a sketch of
 * a border from memory.
 */

export type Point = readonly [number, number];

export interface Projection {
  readonly width: number;
  readonly height: number;
  project(lon: number, lat: number): Point;
}

/**
 * Equirectangular, with longitude scaled by the cosine of the middle latitude.
 * At India's extent that is within a few per cent of any conformal projection,
 * and it needs no library.
 */
export function projectionFor(
  bbox: readonly [number, number, number, number],
  width: number,
): Projection {
  const [west, south, east, north] = bbox;
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const scale = width / ((east - west) * k);
  const height = (north - south) * scale;
  return {
    width,
    height,
    project: (lon, lat) => [(lon - west) * k * scale, (north - lat) * scale],
  };
}

const round = (n: number): string => Math.round(n).toString();

/**
 * One ring as a path segment, thinned to what can be seen.
 *
 * A vertex closer than `tolerance` pixels to the last one kept is dropped, and
 * a ring smaller than that across is dropped whole: a speck of island at this
 * scale is noise, and the explorer is where the detail lives.
 */
export function ringPath(
  ring: readonly Position[],
  projection: Projection,
  tolerance: number,
): string {
  const kept: Point[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const position of ring) {
    const [lon, lat] = position;
    if (lon === undefined || lat === undefined) continue;
    const point = projection.project(lon, lat);
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
    const last = kept.at(-1);
    if (last !== undefined && Math.hypot(point[0] - last[0], point[1] - last[1]) < tolerance) {
      continue;
    }
    kept.push(point);
  }
  if (kept.length < 3 || Math.max(maxX - minX, maxY - minY) < tolerance * 1.5) return "";
  return `M${kept.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`;
}

export function geometryPath(
  geometry: Polygon | MultiPolygon,
  projection: Projection,
  tolerance: number,
): string {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .flatMap((polygon) => polygon.map((ring) => ringPath(ring, projection, tolerance)))
    .join("");
}

export interface StateShape {
  readonly code: string;
  readonly name: string;
  readonly d: string;
  /** Where the state's marker sits, in the same pixel space. */
  readonly anchor: Point;
  /** The state's projected extent: [minX, minY, maxX, maxY]. */
  readonly box: readonly [number, number, number, number];
}

export interface IndiaOutline {
  readonly width: number;
  readonly height: number;
  readonly states: readonly StateShape[];
  /** District anchors, keyed `${stateCode}-${districtCode}`. */
  readonly districts: ReadonlyMap<string, { readonly name: string; readonly anchor: Point }>;
  readonly attribution: string;
  readonly licence: string;
  readonly note: string;
}

/** The drawing's width in SVG units; the page scales it to fit. */
const WIDTH = 600;
/** Pixels. Finer than this cannot be seen at the size the hero is shown. */
const TOLERANCE = 1.6;

type StateCollection = FeatureCollection<
  Polygon | MultiPolygon,
  { stateCode?: string; stateName?: string }
>;

interface Sources {
  readonly manifest: BoundaryManifest;
  readonly collection: StateCollection;
}

let sourcesPromise: Promise<Sources> | null = null;

function loadSources(): Promise<Sources> {
  sourcesPromise ??= Promise.all([
    loadBoundaryManifest(),
    readFile(join(process.cwd(), "public", "geo", "india-states.geojson"), "utf8"),
  ])
    .then(([manifest, raw]) => ({ manifest, collection: JSON.parse(raw) as StateCollection }))
    .catch((error: unknown) => {
      // Not cached: the file appears the moment `geo:fetch` runs.
      sourcesPromise = null;
      throw error;
    });
  return sourcesPromise;
}

const labelOf = (entry: {
  readonly bbox: BBox;
  readonly labelPoint?: readonly [number, number];
}): readonly [number, number] =>
  entry.labelPoint ?? [(entry.bbox[0] + entry.bbox[2]) / 2, (entry.bbox[1] + entry.bbox[3]) / 2];

/** The country, or null when the geometry has not been generated. */
export async function loadIndiaOutline(): Promise<IndiaOutline | null> {
  const sources = await loadSources().catch(() => null);
  return sources === null ? null : outlineOf(sources);
}

function outlineOf({ manifest, collection }: Sources): IndiaOutline {
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const state of manifest.states) {
    bbox[0] = Math.min(bbox[0], state.bbox[0]);
    bbox[1] = Math.min(bbox[1], state.bbox[1]);
    bbox[2] = Math.max(bbox[2], state.bbox[2]);
    bbox[3] = Math.max(bbox[3], state.bbox[3]);
  }
  const projection = projectionFor(bbox, WIDTH);
  const byCode = new Map(manifest.states.map((s) => [s.code, s]));

  const states: StateShape[] = [];
  for (const feature of collection.features) {
    const code = feature.properties.stateCode;
    const entry = code === undefined ? undefined : byCode.get(code);
    if (code === undefined || entry === undefined) continue;
    const d = geometryPath(feature.geometry, projection, TOLERANCE);
    if (d === "") continue;
    const [west, south, east, north] = entry.bbox;
    const [minX, minY] = projection.project(west, north);
    const [maxX, maxY] = projection.project(east, south);
    const label = labelOf(entry);
    states.push({
      code,
      name: entry.name,
      d,
      anchor: projection.project(label[0], label[1]),
      box: [minX, minY, maxX, maxY],
    });
  }

  const districts = new Map<string, { name: string; anchor: Point }>();
  for (const [stateCode, list] of Object.entries(manifest.districts)) {
    for (const district of list) {
      const label = labelOf(district);
      districts.set(`${stateCode}-${district.code}`, {
        name: district.name,
        anchor: projection.project(label[0], label[1]),
      });
    }
  }

  return {
    width: projection.width,
    height: projection.height,
    states,
    districts,
    attribution: manifest.sources.states.attribution,
    licence: manifest.sources.states.licence,
    note: manifest.note,
  };
}

export interface StateCloseUp {
  readonly code: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly d: string;
  /** Every district the manifest lists for the state, with its marker position. */
  readonly districts: readonly {
    readonly code: string;
    readonly name: string;
    readonly anchor: Point;
  }[];
}

/**
 * One state, projected on its own so its outline keeps its detail when drawn
 * large. Districts are markers at their label points, not outlines: the
 * product preview shows where things are, and the explorer draws the shapes.
 */
export async function loadStateCloseUp(code: string, width = 420): Promise<StateCloseUp | null> {
  const sources = await loadSources().catch(() => null);
  if (sources === null) return null;
  const entry = sources.manifest.states.find((s) => s.code === code);
  const feature = sources.collection.features.find((f) => f.properties.stateCode === code);
  if (entry === undefined || feature === undefined) return null;
  const [west, south, east, north] = entry.bbox;
  const projection = projectionFor([west, south, east, north], width);
  const d = geometryPath(feature.geometry, projection, 0.9);
  if (d === "") return null;
  return {
    code,
    name: entry.name,
    width: projection.width,
    height: projection.height,
    d,
    districts: (sources.manifest.districts[code] ?? []).map((district) => {
      const label = labelOf(district);
      return {
        code: district.code,
        name: district.name,
        anchor: projection.project(label[0], label[1]),
      };
    }),
  };
}
