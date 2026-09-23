/**
 * What a map layer is: a definition, not an effect (ADR-058).
 *
 * Before this, a layer was spread across four places — its style in
 * `map/style.ts`, its data, filter, visibility and hit testing in effects inside
 * `MapCanvas.tsx`, and its toggle in a component. Adding one meant editing all
 * of them and hoping they agreed. A definition says everything about one layer
 * in one file, and the binder (`map/engine/binder.ts`) is the only code that
 * applies definitions to MapLibre.
 *
 * Definitions are pure: they build specifications and read `MapInput`. Nothing
 * here imports MapLibre at runtime, so every definition is tested without a
 * browser.
 */
import type { DataState, SourceDescriptor } from "@lokdarpan/domain";
import type { FilterSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import type { LayerVisibility } from "./visibility";

/** Everything the explorer tells the map. The only thing a layer reads. */
export interface MapInput {
  readonly stateCode: string | null;
  /** The national outlines, from a static file loaded once. */
  readonly stateOutlines: FeatureCollection | null;
  /** Whatever level is being drilled into. */
  readonly childBoundaries: FeatureCollection | null;
  /** The selected unit's own geometry; null when no unit is selected. */
  readonly activeGeometry: unknown;
  /** What the tender shading is drawn from, and on what terms. Null before it has loaded. */
  readonly tenders: {
    readonly sources: readonly SourceDescriptor[];
    readonly state: DataState | null;
    /** Open tenders by the district of the issuing office. Absent districts have none held. */
    readonly counts: readonly { readonly adminUnitId: number; readonly tenderCount: number }[];
  } | null;
  readonly visibility: LayerVisibility;
}

export interface StyleContext {
  /** Whether the base map is drawn under the explorer's layers. Opacities differ. */
  readonly withBasemap: boolean;
}

/**
 * Where a style layer sits, lowest first. A band rather than a position in one
 * file, so a layer's fill and outline can straddle another layer — the selected
 * unit's fill sits under its siblings and its outline over them.
 */
export const Z = {
  region: 10,
  selectionFill: 20,
  aggregate: 30,
  level: 40,
  selectionLine: 50,
} as const;

export interface StyleLayer {
  readonly z: number;
  readonly spec: LayerSpecification;
}

/** What a click resolves to. The shell turns it into a URL change. */
export type Selection =
  | { readonly kind: "state"; readonly code: string }
  | { readonly kind: "unit"; readonly id: number };

type Properties = Readonly<Record<string, unknown>>;

export interface HitSpec {
  /** The style layer queried under the pointer. */
  readonly styleLayer: string;
  /** Lower is tested first; the first layer with a feature under the pointer wins. */
  readonly order: number;
  /** Whether the pointer lifts the feature through `feature-state: hover`. */
  readonly hover: boolean;
  readonly toSelection: (properties: Properties) => Selection | null;
  /** The tooltip: the place's name and what kind of place it is. */
  readonly describe: (properties: Properties) => {
    readonly title: string;
    readonly subtitle: string;
  };
}

export type LayerId = "state-outlines" | "child-boundaries" | "selected-unit" | "tender-offices";

export interface LayerDefinition {
  readonly id: LayerId;
  /** Stable short token for a shared link's `?layers=` (phase 7). Never reused. */
  readonly urlToken: string;
  readonly kind: "boundary" | "aggregate" | "records";
  /** The reader's toggle that shows and hides this layer; null when it always shows. */
  readonly toggle: keyof LayerVisibility | null;
  /** Sources this layer owns. Created empty; filled by `data`. */
  readonly sources: Readonly<Record<string, SourceSpecification>>;
  /** Which input fields `data` reads. The binder recomputes only when one of them changes. */
  readonly reads: readonly (keyof MapInput)[];
  /** The contents of each owned source. */
  readonly data?: (input: MapInput) => Readonly<Record<string, FeatureCollection | Feature>>;
  readonly styleLayers: (context: StyleContext) => readonly StyleLayer[];
  readonly filters?: (input: MapInput) => Readonly<Record<string, FilterSpecification>>;
  readonly hit?: HitSpec;
  /**
   * Where what is drawn came from. A layer that cannot name a source draws
   * nothing: the map-level equivalent of `<Figure>` requiring provenance.
   */
  readonly provenance: (input: MapInput) => readonly SourceDescriptor[];
  /** When `not_collected`, the layer draws nothing rather than an empty-looking map. */
  readonly dataState?: (input: MapInput) => DataState | null;
  /**
   * Numbers set per feature as `feature-state`, so they can change — a new
   * department, a later count — without re-sending the geometry they sit on.
   */
  readonly featureState?: (input: MapInput) => FeatureStates;
}

export interface FeatureStates {
  readonly source: string;
  readonly key: string;
  /** Feature id to value. A feature not here has no state under `key`. */
  readonly values: ReadonlyMap<number, number>;
}

export const EMPTY_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] };

export const EMPTY_SOURCE: SourceSpecification = { type: "geojson", data: EMPTY_COLLECTION };
