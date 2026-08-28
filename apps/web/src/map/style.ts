/**
 * The map style, and the layer contract the explorer draws against.
 *
 * BASEMAP POLICY
 * The default style renders only geometry this deployment serves: administrative
 * boundaries and works. No tile provider, no API key, no third-party request
 * from a reader's browser — which matters for a civic site whose readers should
 * not be logged by a commercial map vendor to look at a public record.
 *
 * A raster or vector basemap can be switched on with NEXT_PUBLIC_MAP_STYLE_URL.
 * When set, that style is fetched and our sources and layers are appended to it,
 * so the provider is a configuration choice rather than a code change.
 */
import { color } from "@/ui/tokens";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/ui/status";
import type { StyleSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";

export const SOURCE = {
  states: "ld-states",
  districts: "ld-districts",
  roads: "ld-roads",
  extent: "ld-local-body-extent",
} as const;

export const LAYER = {
  background: "ld-background",
  stateFill: "ld-state-fill",
  stateFillActive: "ld-state-fill-active",
  stateLine: "ld-state-line",
  districtFill: "ld-district-fill",
  districtFillActive: "ld-district-fill-active",
  districtLine: "ld-district-line",
  extentLine: "ld-extent-line",
  roadCasing: "ld-road-casing",
  roadHit: "ld-road-hit",
  roadHover: "ld-road-hover",
  roadSelected: "ld-road-selected",
  /** One line layer per status: `line-dasharray` cannot be data-driven. */
  roadByStatus: (status: string): string => `ld-road-${status}`,
} as const;

const EMPTY: SourceSpecification = {
  type: "geojson",
  data: { type: "FeatureCollection", features: [] },
};

/** Layers the explorer owns, in draw order: areas, then lines, then works. */
function overlayLayers(withBasemap: boolean): LayerSpecification[] {
  const layers: LayerSpecification[] = [];

  if (!withBasemap) {
    layers.push({
      id: LAYER.background,
      type: "background",
      paint: { "background-color": color.bg.sunken },
    });
  }

  layers.push(
    {
      id: LAYER.stateFill,
      type: "fill",
      source: SOURCE.states,
      paint: {
        "fill-color": color.bg.surface,
        // Subdued once a state is chosen: the eye should go to the selection,
        // and dimming the rest does that without hiding the country.
        "fill-opacity": ["case", ["boolean", ["feature-state", "dimmed"], false], 0.35, 0.9],
      },
    },
    {
      id: LAYER.stateFillActive,
      type: "fill",
      source: SOURCE.states,
      filter: ["==", ["get", "stateCode"], "__none__"],
      paint: { "fill-color": color.accent.soft, "fill-opacity": 1 },
    },
    {
      id: LAYER.stateLine,
      type: "line",
      source: SOURCE.states,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "active"], false],
          color.accent.base,
          color.border.strong,
        ],
        "line-width": ["case", ["boolean", ["feature-state", "active"], false], 1.8, 0.7],
      },
    },
    {
      id: LAYER.districtFill,
      type: "fill",
      source: SOURCE.districts,
      paint: {
        "fill-color": color.bg.surface,
        "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.65],
      },
    },
    {
      id: LAYER.districtFillActive,
      type: "fill",
      source: SOURCE.districts,
      filter: ["==", ["get", "districtCode"], "__none__"],
      paint: { "fill-color": color.accent.soft, "fill-opacity": 1 },
    },
    {
      id: LAYER.districtLine,
      type: "line",
      source: SOURCE.districts,
      layout: { "line-join": "round" },
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "active"], false],
          color.accent.base,
          color.border.hair,
        ],
        "line-width": ["case", ["boolean", ["feature-state", "active"], false], 1.6, 0.6],
      },
    },
    {
      // The dashed extent of a local body — deliberately NOT a boundary. See
      // `data/demo/places.ts`: no register we have reviewed publishes municipal
      // polygons, and drawing one would be a fabricated fact in map form.
      id: LAYER.extentLine,
      type: "line",
      source: SOURCE.extent,
      layout: { "line-join": "round" },
      paint: {
        "line-color": color.text.tertiary,
        "line-width": 1.2,
        "line-dasharray": [3, 3],
      },
    },
    {
      // An invisible, generous hit target. A 3.4px line is accurate to point at
      // with a mouse and effectively impossible with a thumb, so pointer events
      // are tested against this instead of the drawn line. Zero opacity still
      // hit-tests; `visibility: none` would not.
      id: LAYER.roadHit,
      type: "line",
      source: SOURCE.roads,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": color.text.primary, "line-width": 20, "line-opacity": 0 },
    },
    {
      // A pale casing under every work, so a dark line stays legible over a
      // dark district fill and two works crossing read as two lines.
      id: LAYER.roadCasing,
      type: "line",
      source: SOURCE.roads,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": color.bg.canvas, "line-width": 7, "line-opacity": 0.9 },
    },
    {
      id: LAYER.roadSelected,
      type: "line",
      source: SOURCE.roads,
      filter: ["==", ["get", "id"], "__none__"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": color.text.primary, "line-width": 9, "line-opacity": 0.18 },
    },
    {
      id: LAYER.roadHover,
      type: "line",
      source: SOURCE.roads,
      filter: ["==", ["get", "id"], "__none__"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": color.text.primary, "line-width": 9, "line-opacity": 0.1 },
    },
  );

  for (const status of PROJECT_STATUS_ORDER) {
    const presentation = PROJECT_STATUS[status];
    layers.push({
      id: LAYER.roadByStatus(status),
      type: "line",
      source: SOURCE.roads,
      filter: ["==", ["get", "status"], status],
      layout: { "line-join": "round", "line-cap": presentation.dash === null ? "round" : "butt" },
      paint: {
        "line-color": presentation.line,
        "line-width": presentation.width,
        ...(presentation.dash === null ? {} : { "line-dasharray": [...presentation.dash] }),
      },
    });
  }

  return layers;
}

function sources(): Record<string, SourceSpecification> {
  return {
    [SOURCE.states]: { ...EMPTY, promoteId: "stateCode" } as SourceSpecification,
    [SOURCE.districts]: { ...EMPTY, promoteId: "districtCode" } as SourceSpecification,
    [SOURCE.extent]: EMPTY,
    [SOURCE.roads]: { ...EMPTY, promoteId: "id" } as SourceSpecification,
  };
}

/** The configured basemap, or null for the self-hosted geometry-only style. */
export function basemapStyleUrl(): string | null {
  const configured = process.env["NEXT_PUBLIC_MAP_STYLE_URL"];
  return configured !== undefined && configured !== "" ? configured : null;
}

export async function buildStyle(): Promise<StyleSpecification> {
  const url = basemapStyleUrl();

  if (url === null) {
    return {
      version: 8,
      // No glyphs and no sprite: the default style has no symbol layer, and
      // declaring a font endpoint we do not host would fail at first label.
      sources: sources(),
      layers: overlayLayers(false),
    };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`basemap style ${url} returned ${String(response.status)}`);
  }
  const base = (await response.json()) as StyleSpecification;
  return {
    ...base,
    sources: { ...base.sources, ...sources() },
    layers: [...base.layers, ...overlayLayers(true)],
  };
}
