/**
 * The one place layer definitions touch MapLibre (ADR-058).
 *
 * It receives the map rather than importing it, through `MapPort`: the few
 * calls it makes. That is what lets the whole lifecycle — data, filters,
 * visibility, the refuse rule and hit testing — be tested with a fake map.
 *
 * Every call is made only when its value changes. MapLibre re-tiles a GeoJSON
 * source on every `setData`, so re-sending an unchanged level would stall the
 * frame for nothing.
 */
import type { FilterSpecification } from "maplibre-gl";
import { LAYERS } from "@/map/layers/registry";
import {
  EMPTY_COLLECTION,
  type LayerDefinition,
  type LayerId,
  type MapInput,
  type Selection,
} from "@/map/layers/types";

export interface HitFeature {
  readonly id?: string | number | undefined;
  readonly source: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

/** The subset of MapLibre's `Map` the binder uses. */
export interface MapPort {
  getSource(id: string): { setData(data: never): unknown } | undefined;
  getLayer(id: string): unknown;
  setLayoutProperty(layerId: string, name: "visibility", value: "visible" | "none"): unknown;
  setFilter(layerId: string, filter: FilterSpecification): unknown;
  queryRenderedFeatures(
    point: { readonly x: number; readonly y: number },
    options: { layers: string[] },
  ): readonly HitFeature[];
  setFeatureState(
    target: { readonly source: string; readonly id: number },
    state: Readonly<Record<string, number>>,
  ): unknown;
  removeFeatureState(
    target: { readonly source: string; readonly id: number },
    key: string,
  ): unknown;
}

export interface Hit {
  readonly layer: LayerId;
  readonly feature: HitFeature;
  readonly selection: Selection | null;
  readonly title: string;
  readonly subtitle: string;
  /** Whether the feature should be lifted by `feature-state: hover`. */
  readonly hover: boolean;
}

/** Why a layer draws nothing, or null when it draws. */
export function refusal(layer: LayerDefinition, input: MapInput): string | null {
  if (layer.dataState?.(input)?.collection === "not_collected") return "not collected";
  if (layer.provenance(input).length === 0) return "no provenance";
  return null;
}

export interface Binder {
  update(input: MapInput): void;
  hitAt(point: { readonly x: number; readonly y: number }): Hit | null;
  /** Layers currently refused, with the reason. For diagnostics and tests. */
  refused(): ReadonlyMap<LayerId, string>;
}

export function createBinder(map: MapPort, layers: readonly LayerDefinition[] = LAYERS): Binder {
  // Style layer ids do not depend on the style context; the ids are what matter here.
  const styleIds = new Map(
    layers.map((layer) => [
      layer.id,
      layer.styleLayers({ withBasemap: false }).map((s) => s.spec.id),
    ]),
  );
  const hitOrder = layers
    .filter((layer) => layer.hit !== undefined)
    .sort((a, b) => (a.hit?.order ?? 0) - (b.hit?.order ?? 0));

  const sentData = new Map<string, unknown>();
  /** Feature-state last applied, by `source|key`. Forgotten when that source's data is re-sent. */
  const sentStates = new Map<string, ReadonlyMap<number, number>>();
  const sentVisibility = new Map<string, "visible" | "none">();
  const sentFilter = new Map<string, string>();
  const readSnapshot = new Map<LayerId, readonly unknown[]>();
  const refusedNow = new Map<LayerId, string>();
  const visibleNow = new Set<LayerId>();

  const setData = (sourceId: string, data: unknown): void => {
    if (sentData.get(sourceId) === data) return;
    const source = map.getSource(sourceId);
    if (source === undefined) return;
    source.setData(data as never);
    sentData.set(sourceId, data);
    // New data may bring new features, or drop state with the old ones: the
    // next feature-state pass re-applies everything for this source.
    for (const key of sentStates.keys()) {
      if (key.startsWith(`${sourceId}|`)) sentStates.delete(key);
    }
  };

  const setVisibility = (styleId: string, value: "visible" | "none"): void => {
    if (sentVisibility.get(styleId) === value || map.getLayer(styleId) === undefined) return;
    map.setLayoutProperty(styleId, "visibility", value);
    sentVisibility.set(styleId, value);
  };

  const readsChanged = (layer: LayerDefinition, input: MapInput): boolean => {
    const current = layer.reads.map((key) => input[key]);
    const previous = readSnapshot.get(layer.id);
    readSnapshot.set(layer.id, current);
    return previous === undefined || current.some((value, i) => value !== previous[i]);
  };

  const bindData = (layer: LayerDefinition, input: MapInput, refused: boolean): void => {
    if (layer.data === undefined) return;
    if (refused) {
      // A refused layer's sources are emptied, not just hidden, so no query or
      // label can read geometry the map will not show.
      for (const sourceId of Object.keys(layer.sources)) setData(sourceId, EMPTY_COLLECTION);
      readSnapshot.delete(layer.id);
      return;
    }
    if (!readsChanged(layer, input)) return;
    for (const [sourceId, data] of Object.entries(layer.data(input))) setData(sourceId, data);
  };

  const bindFilters = (layer: LayerDefinition, input: MapInput): void => {
    for (const [styleId, filter] of Object.entries(layer.filters?.(input) ?? {})) {
      const key = JSON.stringify(filter);
      if (sentFilter.get(styleId) === key || map.getLayer(styleId) === undefined) continue;
      map.setFilter(styleId, filter);
      sentFilter.set(styleId, key);
    }
  };

  const bindFeatureState = (layer: LayerDefinition, input: MapInput, refused: boolean): void => {
    const spec = layer.featureState?.(input);
    if (spec === undefined) return;
    const key = `${spec.source}|${spec.key}`;
    const previous = sentStates.get(key) ?? new Map<number, number>();
    // A refused layer keeps no numbers on the map, not just no visible ones.
    const next = refused ? new Map<number, number>() : spec.values;
    for (const id of previous.keys()) {
      if (!next.has(id)) map.removeFeatureState({ source: spec.source, id }, spec.key);
    }
    for (const [id, value] of next) {
      if (previous.get(id) !== value) {
        map.setFeatureState({ source: spec.source, id }, { [spec.key]: value });
      }
    }
    sentStates.set(key, new Map(next));
  };

  const bindVisibility = (layer: LayerDefinition, visible: boolean): void => {
    if (visible) visibleNow.add(layer.id);
    else visibleNow.delete(layer.id);
    for (const styleId of styleIds.get(layer.id) ?? []) {
      setVisibility(styleId, visible ? "visible" : "none");
    }
  };

  return {
    update(input) {
      // Data first, for every layer, so a feature-state pass never runs before
      // the data it annotates has been sent in the same update.
      const reasons = new Map(layers.map((layer) => [layer.id, refusal(layer, input)]));
      for (const layer of layers) {
        const reason = reasons.get(layer.id) ?? null;
        if (reason === null) refusedNow.delete(layer.id);
        else refusedNow.set(layer.id, reason);
        bindData(layer, input, reason !== null);
      }
      for (const layer of layers) {
        const reason = reasons.get(layer.id) ?? null;
        bindFilters(layer, input);
        bindFeatureState(layer, input, reason !== null);
        bindVisibility(
          layer,
          reason === null && (layer.toggle === null || input.visibility[layer.toggle]),
        );
      }
    },

    hitAt(point) {
      // One hit test in a fixed order, not one listener per layer: per-layer
      // handlers all fire for the same pointer and the last to run wins, so the
      // state polygon underneath an area overwrote the area's own hover.
      for (const layer of hitOrder) {
        const hit = layer.hit;
        if (hit === undefined || !visibleNow.has(layer.id)) continue;
        if (map.getLayer(hit.styleLayer) === undefined) continue;
        const [feature] = map.queryRenderedFeatures(point, { layers: [hit.styleLayer] });
        if (feature === undefined) continue;
        return {
          layer: layer.id,
          feature,
          selection: hit.toSelection(feature.properties),
          ...hit.describe(feature.properties),
          hover: hit.hover,
        };
      }
      return null;
    },

    refused: () => new Map(refusedNow),
  };
}
