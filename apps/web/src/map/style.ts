/**
 * The map style, and the layer contract the explorer draws against.
 *
 * BASEMAP POLICY
 * The default style renders only geometry this deployment serves: administrative
 * boundaries. No tile provider, no API key, no third-party request
 * from a reader's browser — which matters for a civic site whose readers should
 * not be logged by a commercial map vendor to look at a public record.
 *
 * A raster or vector basemap can be switched on with NEXT_PUBLIC_MAP_STYLE_URL.
 * When set, that style is fetched and our sources and layers are appended to it,
 * so the provider is a configuration choice rather than a code change.
 */
import { color } from "@/ui/tokens";
import type { StyleSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";

export const SOURCE = {
  states: "ld-states",
  /** Whatever level is currently being drilled into — districts, talukas,
   *  municipal bodies, villages. One source, because the map draws one level at
   *  a time and the level is decided by the data, not by the renderer. */
  children: "ld-children",
  /** The selected unit's own boundary, drawn above its siblings. */
  active: "ld-active-unit",
} as const;

export const LAYER = {
  background: "ld-background",
  stateFill: "ld-state-fill",
  stateFillActive: "ld-state-fill-active",
  stateLine: "ld-state-line",
  childFill: "ld-child-fill",
  childLine: "ld-child-line",
  activeFill: "ld-active-fill",
  activeLine: "ld-active-line",
} as const;

const EMPTY: SourceSpecification = {
  type: "geojson",
  data: { type: "FeatureCollection", features: [] },
};

/**
 * Layers the explorer owns: administrative areas and their outlines.
 *
 * There is no works layer. No register of individual works has been located for
 * any area, so there is nothing to draw — and a layer fed demo geometry would
 * make a blank map look like a populated one.
 */
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
      // The selected unit is a BACKDROP, drawn beneath its children. Painted on
      // top it covered the very boundaries the reader drilled in to see.
      id: LAYER.activeFill,
      type: "fill",
      source: SOURCE.active,
      paint: { "fill-color": color.accent.soft, "fill-opacity": 0.55 },
    },
    {
      id: LAYER.childFill,
      type: "fill",
      source: SOURCE.children,
      paint: {
        // Nearly transparent: the fill exists to catch the pointer and to lift
        // on hover, not to tint the map. The outline carries the shape.
        "fill-color": color.bg.surface,
        "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.55, 0.06],
      },
    },
    {
      id: LAYER.childLine,
      type: "line",
      source: SOURCE.children,
      layout: { "line-join": "round" },
      paint: { "line-color": color.border.strong, "line-width": 1 },
    },
    {
      id: LAYER.activeLine,
      type: "line",
      source: SOURCE.active,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": color.accent.base, "line-width": 2.2 },
    },
  );

  return layers;
}

function sources(): Record<string, SourceSpecification> {
  return {
    [SOURCE.states]: { ...EMPTY, promoteId: "stateCode" } as SourceSpecification,
    [SOURCE.children]: { ...EMPTY, promoteId: "unitId" } as SourceSpecification,
    [SOURCE.active]: EMPTY,
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
