import { describe, expect, it } from "vitest";
import type { FeatureCollection, Point } from "geojson";
import { buildStyle } from "@/map/style";
import { boundarySourceIds } from "./child-boundaries";
import { LAYERS, orderedStyleLayers } from "./registry";
import { DEFAULT_LAYERS } from "./visibility";
import type { MapInput } from "./types";

const POINT: Point = { type: "Point", coordinates: [0, 0] };

const ids = (withBasemap: boolean) => orderedStyleLayers({ withBasemap }).map((l) => l.spec.id);

const input = (over: Partial<MapInput> = {}): MapInput => ({
  stateCode: null,
  stateOutlines: null,
  childBoundaries: null,
  activeGeometry: null,
  tenders: null,
  visibility: DEFAULT_LAYERS,
  ...over,
});

/** Every colour literal anywhere in a paint property, however deeply nested in an expression. */
function colours(value: unknown): string[] {
  if (typeof value === "string") return /^#[0-9a-f]{6}$/i.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(colours);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(colours);
  return [];
}

/** Hue in degrees and saturation, for the one check that matters: is it red? */
function isRed(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  if (saturation < 0.25 || max !== r) return false;
  const hue = (60 * ((g - b) / (max - min)) + 360) % 360;
  return hue <= 20 || hue >= 340;
}

describe("the layer registry", () => {
  it("stacks the explorer's layers exactly as the hand-written style did", () => {
    expect(ids(true)).toEqual([
      "ld-state-fill",
      "ld-state-fill-active",
      "ld-state-line",
      "ld-active-fill",
      "ld-tender-fill",
      "ld-child-fill",
      "ld-child-line",
      "ld-active-line",
    ]);
    expect(ids(false)).toEqual(ids(true));
  });

  it("puts a flat background under them only when there is no base map", () => {
    const withoutBasemap = buildStyle({ basemap: null }).layers.map((l) => l.id);
    expect(withoutBasemap).toEqual(["ld-background", ...ids(false)]);
  });

  it("gives every layer, style layer, source and link token a distinct id", () => {
    const unique = (values: readonly string[]) => new Set(values).size === values.length;
    expect(unique(LAYERS.map((l) => l.id))).toBe(true);
    expect(unique(LAYERS.map((l) => l.urlToken))).toBe(true);
    expect(unique(ids(false))).toBe(true);
    expect(unique(LAYERS.flatMap((l) => Object.keys(l.sources)))).toBe(true);
  });

  it("draws every style layer from a source some layer owns", () => {
    const owned = new Set(LAYERS.flatMap((l) => Object.keys(l.sources)));
    for (const { spec } of orderedStyleLayers({ withBasemap: true })) {
      if ("source" in spec) expect(owned, spec.id).toContain(spec.source);
    }
  });

  it("uses no red anywhere, with or without a base map", () => {
    for (const withBasemap of [true, false]) {
      const found = orderedStyleLayers({ withBasemap }).flatMap(({ spec }) =>
        colours("paint" in spec ? spec.paint : undefined),
      );
      expect(found.length).toBeGreaterThan(0);
      expect(found.filter(isRed)).toEqual([]);
    }
  });

  it("the red check itself catches red", () => {
    expect(isRed("#D32F2F")).toBe(true);
    expect(isRed("#C9CDC9")).toBe(false);
    expect(isRed("#0F766E")).toBe(false);
  });

  it("names where the outlines came from without being told", () => {
    const outlines = LAYERS.find((l) => l.id === "state-outlines");
    expect(outlines?.provenance(input()).map((s) => s.sourceId)).toEqual(["openstreetmap", "lgd"]);
  });

  it("names a level's sources from its features, and none for an empty level", () => {
    const level: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: POINT,
          properties: { sourceName: "© OpenStreetMap contributors" },
        },
        { type: "Feature", geometry: POINT, properties: { sourceName: "Survey of Somewhere" } },
        { type: "Feature", geometry: POINT, properties: {} },
      ],
    };
    expect(boundarySourceIds(level)).toEqual(["openstreetmap", "Survey of Somewhere"]);
    expect(boundarySourceIds(null)).toEqual([]);
  });
});
