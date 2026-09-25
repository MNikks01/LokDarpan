/**
 * The map style: the base map, with the explorer's registered layers on top.
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
import { LAYERS, orderedStyleLayers } from "./layers/registry";
import type { StyleSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";

export const BASE_SOURCE = "protomaps";

const BACKGROUND_LAYER = "ld-background";

/**
 * Layers the explorer owns, from the layer registry (ADR-058), over a flat
 * background when there is no base map to draw them on.
 *
 * There is no works layer. No register of individual works has been located for
 * any area, so there is nothing to draw — and a layer fed demo geometry would
 * make a blank map look like a populated one.
 */
function overlayLayers(withBasemap: boolean): LayerSpecification[] {
  const background: LayerSpecification[] = withBasemap
    ? []
    : [
        {
          id: BACKGROUND_LAYER,
          type: "background",
          paint: { "background-color": color.bg.sunken },
        },
      ];
  return [...background, ...orderedStyleLayers({ withBasemap }).map((layer) => layer.spec)];
}

function sources(): Record<string, SourceSpecification> {
  return Object.assign({}, ...LAYERS.map((layer) => layer.sources)) as Record<
    string,
    SourceSpecification
  >;
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
/** Every PMTiles archive begins with these seven bytes (spec v3 §3). */
const PMTILES_MAGIC = "PMTiles";

export async function basemapAvailable(url: string): Promise<boolean> {
  try {
    // A range request, not a HEAD: PMTiles is served as a static file and the
    // first bytes are the header, so reading them proves it is there and is an
    // archive. The status alone proves neither: for a missing file Vercel
    // answered 206 with the first bytes of the site's HTML 404 page, and the
    // map then failed with "Wrong magic number for PMTiles archive".
    const response = await fetch(url, { headers: { range: "bytes=0-15" } });
    if (!response.ok) return false;
    const head = new Uint8Array(await response.arrayBuffer()).subarray(0, PMTILES_MAGIC.length);
    return new TextDecoder().decode(head) === PMTILES_MAGIC;
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
