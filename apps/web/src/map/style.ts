/**
 * The map style, and the layer contract the explorer draws against.
 *
 * TWO LAYERS, KEPT APART
 * Layer A is the geographic base — roads, buildings, water, railways, places —
 * from an OpenStreetMap extract served as PMTiles from this deployment's own
 * origin. Layer B is what LokDarpan knows: administrative boundaries now, and
 * government works when a register for them exists. They are composed here and
 * nowhere else, so the base map answers "what is here?" without knowing
 * anything about the ledger, and the ledger's layers sit on top without
 * knowing what a building is.
 *
 * BASEMAP POLICY
 * Self-hosted, so there is no API key, no per-load bill, and no request from a
 * reader's browser to a commercial vendor — a civic site's readers should not be
 * logged by a map company for looking at a public record. This is the same
 * reasoning `.docs/adr/006-maps.md` used to reject Mapbox.
 *
 * The extract is fetched at setup and gitignored, like the boundary geometry.
 * When it is absent the style still builds: the reader gets boundaries without
 * a base map rather than an error, and the panel says which.
 */
import { layers as basemapLayers, namedFlavor } from "@protomaps/basemaps";
import { color } from "@/ui/tokens";
import type { StyleSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";

export const BASE_SOURCE = "protomaps";

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

  // With a base map underneath, these fills exist to catch the pointer and to
  // mark the selection — not to paint the map. An opaque administrative fill
  // over a street map hides the streets, which is the whole reason the base map
  // is there. Without one, they carry the map's legibility instead.
  const opacity = withBasemap
    ? { state: 0.02, stateActive: 0.18, child: 0.02, childHover: 0.22, active: 0.16 }
    : { state: 0.9, stateActive: 1, child: 0.06, childHover: 0.55, active: 0.55 };

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
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "dimmed"], false],
          opacity.state * 0.4,
          opacity.state,
        ],
      },
    },
    {
      id: LAYER.stateFillActive,
      type: "fill",
      source: SOURCE.states,
      filter: ["==", ["get", "stateCode"], "__none__"],
      paint: { "fill-color": color.accent.soft, "fill-opacity": opacity.stateActive },
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
      paint: { "fill-color": color.accent.soft, "fill-opacity": opacity.active },
    },
    {
      id: LAYER.childFill,
      type: "fill",
      source: SOURCE.children,
      paint: {
        // Nearly transparent: the fill exists to catch the pointer and to lift
        // on hover, not to tint the map. The outline carries the shape.
        "fill-color": color.bg.surface,
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          opacity.childHover,
          opacity.child,
        ],
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

/**
 * Where the self-hosted vector extract lives, relative to this origin.
 *
 * Configurable so a deployment can serve a different region — or a whole
 * country — without a code change. `null` disables the base map entirely.
 */
export function basemapUrl(): string | null {
  const configured = process.env["NEXT_PUBLIC_BASEMAP_URL"];
  if (configured === "") return null;
  return configured ?? "/basemap/nagpur.pmtiles";
}

/** Whether the extract is actually present, so the UI can say if it is not. */
export async function basemapAvailable(url: string): Promise<boolean> {
  try {
    // A range request, not a HEAD: PMTiles is served as a static file and the
    // first bytes are the header, so this also proves it is readable.
    const response = await fetch(url, { headers: { range: "bytes=0-15" } });
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
}

/**
 * The geographic base layer, or nothing when no extract is installed.
 *
 * `glyphs` and `sprite` are Protomaps' own hosted assets: fonts and icons, not
 * map data, and without them every label and shield in the base map is missing.
 * They are the one third-party fetch this style makes, and they carry no
 * information about which place the reader is looking at.
 */
function baseLayers(sourceName: string): LayerSpecification[] {
  return basemapLayers(sourceName, namedFlavor("light"), { lang: "en" });
}

export interface StyleOptions {
  /** Set when the extract is present; the base map is omitted otherwise. */
  readonly basemap: string | null;
}

export function buildStyle(options: StyleOptions): StyleSpecification {
  const { basemap } = options;
  const withBasemap = basemap !== null;

  return {
    version: 8,
    ...(withBasemap
      ? {
          glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
          sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
        }
      : {}),
    sources: {
      ...(withBasemap
        ? {
            [BASE_SOURCE]: {
              type: "vector",
              url: `pmtiles://${basemap}`,
              attribution: "© OpenStreetMap contributors",
            } satisfies SourceSpecification,
          }
        : {}),
      ...sources(),
    },
    // Base first, then the ledger's own geometry on top of it.
    layers: [...(withBasemap ? baseLayers(BASE_SOURCE) : []), ...overlayLayers(withBasemap)],
  };
}
