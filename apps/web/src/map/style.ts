/**
 * The map style: the base map, with the explorer's registered layers on top.
 *
 * TWO LAYERS, KEPT APART
 * Layer A is the geographic base — roads, water, railways, towns — from a
 * hosted tile provider. Layer B is what LokDarpan knows: administrative
 * boundaries now, and government works when a register for them exists. They
 * are composed here and nowhere else, so the base map answers "what is here?"
 * without knowing anything about the ledger, and the ledger's layers sit on top
 * without knowing what a road is.
 *
 * BASEMAP POLICY (ADR-066)
 * Hosted, not self-hosted, by decision: an all-India extract is not worth
 * building and serving at this stage. The default is OpenFreeMap, which needs no
 * account and no key; any provider serving an OpenMapTiles-schema MapLibre style
 * can replace it through `NEXT_PUBLIC_BASEMAP_STYLE_URL`.
 *
 * The base map draws NO administrative boundary and names NO country or state.
 * A hosted style draws the lines its data holds, and for India those are
 * OpenStreetMap's, not the Survey of India's. The only boundaries on this map
 * are the ledger's own, each with its source named in the panel, so a line
 * whose authority nobody can state is never drawn beside one whose authority
 * is recorded.
 *
 * When the provider cannot be reached the style still builds: the reader gets
 * boundaries without a base map rather than an error, and the map says which.
 */
import { color } from "@/ui/tokens";
import { LAYERS, orderedStyleLayers } from "./layers/registry";
import type {
  FilterSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

const BACKGROUND_LAYER = "ld-background";

export const DEFAULT_BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

/**
 * OpenFreeMap's style carries no attribution of its own, and the tiles are
 * OpenMapTiles-schema data from OpenStreetMap, whose licence requires credit.
 */
const DEFAULT_ATTRIBUTION = "OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors (ODbL)";

/**
 * Place classes that assert where a jurisdiction is. Their names are the
 * ledger's to draw (ADR-057), from records whose source is stated.
 */
const JURISDICTION_CLASSES = ["continent", "country", "state", "province"];

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
 * The provider's style URL. An empty value disables the base map, for a
 * deployment that wants no third-party request from a reader's browser at all.
 */
export function basemapStyleUrl(): string | null {
  const configured = process.env["NEXT_PUBLIC_BASEMAP_STYLE_URL"];
  if (configured === "") return null;
  return configured ?? DEFAULT_BASEMAP_STYLE;
}

export interface Basemap {
  readonly style: StyleSpecification;
  /** Shown on the map; a provider's terms and the data's licence both require it. */
  readonly attribution: string;
}

/**
 * The provider's style with every administrative claim taken out.
 *
 * `boundary` layers go entirely. Place layers keep towns, villages and
 * neighbourhoods but lose the jurisdiction classes, by narrowing each layer's
 * own filter rather than guessing from its id — a provider renaming a layer
 * cannot then bring a country label back.
 *
 * Assumes expression-syntax filters, which OpenMapTiles styles use; legacy and
 * expression syntax cannot be combined in one filter.
 */
export function withoutAdministrativeClaims(style: StyleSpecification): StyleSpecification {
  const notJurisdiction: FilterSpecification = [
    "!",
    ["in", ["get", "class"], ["literal", JURISDICTION_CLASSES]],
  ];
  const layers = style.layers.flatMap((layer): LayerSpecification[] => {
    const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
    if (sourceLayer === "boundary") return [];
    if (sourceLayer !== "place") return [layer];
    const filter = "filter" in layer ? layer.filter : undefined;
    return [
      {
        ...layer,
        filter:
          filter === undefined
            ? notJurisdiction
            : (["all", notJurisdiction, filter] as FilterSpecification),
      } as LayerSpecification,
    ];
  });
  return { ...style, layers };
}

function attributionOf(style: StyleSpecification, url: string): string {
  const stated = Object.values(style.sources)
    .map((source) => ("attribution" in source ? source.attribution : undefined))
    .filter((text): text is string => typeof text === "string" && text.trim() !== "")
    .map((text) => text.replace(/<[^>]*>/gu, "").trim());
  if (stated.length > 0) return [...new Set(stated)].join(" · ");
  const configured = process.env["NEXT_PUBLIC_BASEMAP_ATTRIBUTION"];
  if (configured !== undefined && configured !== "") return configured;
  return url === DEFAULT_BASEMAP_STYLE ? DEFAULT_ATTRIBUTION : `Base map: ${new URL(url).host}`;
}

/**
 * The provider's style, fetched once per map, or null when it cannot be had.
 *
 * Null is not an error to show: the ledger's boundaries draw on a flat
 * background and the attribution line says no base map is shown.
 */
export async function fetchBasemap(url: string): Promise<Basemap | null> {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const style = (await response.json()) as Partial<StyleSpecification>;
    if (style.version !== 8 || !Array.isArray(style.layers) || typeof style.sources !== "object") {
      return null;
    }
    const complete = style as StyleSpecification;
    return {
      style: withoutAdministrativeClaims(complete),
      attribution: attributionOf(complete, url),
    };
  } catch {
    return null;
  }
}

export interface StyleOptions {
  /** The base map when the provider answered; omitted otherwise. */
  readonly basemap: Basemap | null;
}

export function buildStyle(options: StyleOptions): StyleSpecification {
  const base = options.basemap?.style ?? null;
  const withBasemap = base !== null;

  return {
    version: 8,
    ...(base?.glyphs === undefined ? {} : { glyphs: base.glyphs }),
    ...(base?.sprite === undefined ? {} : { sprite: base.sprite }),
    sources: { ...(base?.sources ?? {}), ...sources() },
    // Base first, then the ledger's own geometry on top of it.
    layers: [...(base?.layers ?? []), ...overlayLayers(withBasemap)],
  };
}
