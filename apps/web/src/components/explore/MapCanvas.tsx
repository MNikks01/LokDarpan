"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapLibreMap, addProtocol, getVersion, setWorkerUrl } from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { GeoJSONSource, MapMouseEvent, MapSourceDataEvent } from "maplibre-gl";
import type React from "react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { GeoUnit } from "@lokdarpan/domain";
import type { BBox, FeatureCollection } from "geojson";
import { INDIA_BBOX } from "@/domain/geography";
import type { StateOption } from "@/data/geography";
import { CAMERA_MS, fitTo, framePadding } from "@/map/camera";
import { GeometryUnavailableError, fetchStateOutlines } from "@/map/geometry-source";
import { basemapAvailable, basemapUrl, buildStyle } from "@/map/style";
import { createBinder, type Binder, type MapPort } from "@/map/engine/binder";
import type { MapInput } from "@/map/layers/types";
import { CHILD_SOURCE } from "@/map/layers/child-boundaries";
import { MARK, mark } from "@/lib/perf-marks";
import { createPlaceLabelLayer, type PlaceLabel, type PlaceLabelLayer } from "@/map/place-labels";
import type { LayerVisibility } from "@/map/layers/visibility";
import { MapOverlays, MapUnavailable } from "./MapOverlays";
import type { HoverTarget } from "./AreaTooltip";
import styles from "./explorer.module.css";

export interface MapHandle {
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly reframe: () => void;
}

export interface MapCanvasProps {
  readonly stateCode: string | null;
  readonly stateBbox: BBox | null;
  readonly activeUnit: GeoUnit | null;
  readonly activeGeometry: unknown;
  readonly childBoundaries: FeatureCollection | null;
  /** What the tender shading is drawn from, and on what terms. Null before it loads. */
  readonly tenders: MapInput["tenders"];
  readonly states: readonly StateOption[];
  readonly layers: LayerVisibility;
  readonly insets: { readonly left: number; readonly right: number };
  readonly compact: boolean;
  readonly handleRef: React.RefObject<MapHandle | null>;
  readonly onSelectState: (stateCode: string) => void;
  readonly onSelectUnit: (unitId: number) => void;
}

const LOAD_TIMEOUT_MS = 15_000;

/**
 * Register the `pmtiles://` scheme with MapLibre, once.
 *
 * The protocol object is module-scoped rather than per-map: it owns a tile
 * cache, and a fresh one per mount would re-download the archive header on
 * every remount.
 */
let pmtilesRegistered = false;
function registerPmtilesProtocol(): void {
  if (pmtilesRegistered) return;
  addProtocol("pmtiles", new Protocol().tile);
  pmtilesRegistered = true;
}

/**
 * Where MapLibre's worker is served from: copied into `public/` at build by
 * `scripts/copy-maplibre-worker.ts`, under this MapLibre's own version. Left to
 * itself, MapLibre 6 looks for the worker beside its bundled module, which under
 * Next is a `file://` URL, and the map never loads.
 */
let workerConfigured = false;
function configureWorker(): void {
  if (workerConfigured) return;
  setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);
  workerConfigured = true;
}

/** The calls the layer binder makes, bound to one map. */
function portOf(map: MapLibreMap): MapPort {
  return {
    getSource: (id) => map.getSource<GeoJSONSource>(id),
    getLayer: (id) => map.getLayer(id),
    setLayoutProperty: (layerId, name, value) => map.setLayoutProperty(layerId, name, value),
    setFilter: (layerId, filter) => map.setFilter(layerId, filter),
    queryRenderedFeatures: (point, options) =>
      map.queryRenderedFeatures([point.x, point.y], options),
    setFeatureState: (target, state) => {
      map.setFeatureState(target, state);
    },
    removeFeatureState: (target, key) => {
      map.removeFeatureState(target, key);
    },
  };
}

/**
 * Resolve when the map is ready to accept data.
 *
 * Bounded, because `load` can simply never arrive — a failed worker, a lost
 * WebGL context — and an unbounded await leaves the reader looking at an empty
 * frame with no explanation forever. A timeout turns that into a message.
 */
function whenLoaded(map: MapLibreMap): Promise<void> {
  if (map.loaded()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("The map did not finish loading. Its renderer may be unavailable here."));
    }, LOAD_TIMEOUT_MS);
    // `once` is overloaded: with a listener it returns the map, without one it
    // returns a promise. `void` marks the union as deliberately unused.
    void map.once("load", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * The map.
 *
 * What it draws is the layer registry's business (`map/layers/registry.ts`,
 * ADR-058); this component owns the renderer's lifecycle, the pointer, the
 * camera and the place names, and hands everything else to the binder as one
 * `MapInput`. It does not know what levels are being drawn — "children" is one
 * source fed by the ledger, so a district of talukas and a taluka of villages
 * render through the same path with no per-level code.
 *
 * Geometry is handed to MapLibre and never diffed by React.
 */
export function MapCanvas({
  stateCode,
  stateBbox,
  activeUnit,
  activeGeometry,
  childBoundaries,
  tenders,
  states,
  layers,
  insets,
  compact,
  handleRef,
  onSelectState,
  onSelectUnit,
}: MapCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const binderRef = useRef<Binder | null>(null);
  const [stateOutlines, setStateOutlines] = useState<FeatureCollection | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [basemapPresent, setBasemapPresent] = useState(false);

  // Callbacks are read through a ref inside long-lived MapLibre handlers, so a
  // re-render never forces the map to tear its listeners down and rebind them.
  const callbacks = useRef({ onSelectState, onSelectUnit });
  callbacks.current = { onSelectState, onSelectUnit };
  const framing = useRef({ insets, compact });
  framing.current = { insets, compact };

  /* ---------------------------------------------------------------- init */
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const holder: { instance: MapLibreMap | null; cancelled: boolean } = {
      instance: null,
      cancelled: false,
    };
    // Read through a call, not the property: control-flow analysis narrows a
    // property only assigned in the cleanup closure to `false`, and would
    // quietly delete every bail-out below.
    const cancelled = (): boolean => holder.cancelled;

    // Registered once per page, before any map is built: MapLibre resolves
    // `pmtiles://` URLs through it, and a style referencing one without the
    // protocol registered fails with an unhelpful network error.
    registerPmtilesProtocol();
    configureWorker();

    const start = async (): Promise<void> => {
      // A style that names a missing extract renders nothing and says nothing,
      // so presence is checked before it is referenced.
      const configured = basemapUrl();
      const basemap =
        configured !== null && (await basemapAvailable(configured)) ? configured : null;
      if (cancelled()) return;
      setBasemapPresent(basemap !== null);

      const style = buildStyle({ basemap });
      if (cancelled()) return;
      mark(MARK.mapInit);

      const map = new MapLibreMap({
        container,
        style,
        bounds: [
          [INDIA_BBOX[0], INDIA_BBOX[1]],
          [INDIA_BBOX[2], INDIA_BBOX[3]],
        ],
        fitBoundsOptions: { padding: 40 },
        attributionControl: false,
        // The reader is comparing administrative geography, not flying over
        // terrain. Rotation and pitch only make two boundaries harder to compare.
        dragRotate: false,
        pitchWithRotate: false,
        maxZoom: 16,
        minZoom: 3,
      });
      holder.instance = map;
      map.touchZoomRotate.disableRotation();
      map.keyboard.enable();

      // A renderer error is reported, never swallowed. MapLibre keeps a broken
      // map on screen as a blank rectangle, which a reader cannot tell apart
      // from "this area has no records".
      map.on("error", (event: { readonly error?: { readonly message?: string } }) => {
        if (cancelled()) return;
        setFailure(event.error?.message ?? "The map renderer reported an error.");
      });

      await whenLoaded(map);
      if (cancelled()) return;
      mark(MARK.mapLoad);

      const outlines = await fetchStateOutlines();
      if (cancelled()) return;
      binderRef.current = createBinder(portOf(map));
      setStateOutlines(outlines);
      mapRef.current = map;
      setReady(true);
    };

    start().catch((error: unknown) => {
      if (cancelled()) return;
      // The reader gets a sentence they can act on; the console gets the cause,
      // because "the map is blank" is otherwise undiagnosable in the field.
      console.error("[lokdarpan] map initialisation failed", error);
      setFailure(
        error instanceof Error && !(error instanceof GeometryUnavailableError)
          ? error.message
          : error instanceof GeometryUnavailableError
            ? error.message
            : "The map could not be initialised in this browser.",
      );
    });

    return () => {
      holder.cancelled = true;
      holder.instance?.remove();
      mapRef.current = null;
      binderRef.current = null;
      setReady(false);
    };
  }, []);

  /* ------------------------------------------------------------ handlers */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const canvas = map.getCanvas();

    // Feature-state hover, so the fill lifts under the pointer without React
    // re-rendering the map on every mouse move.
    let hovered: { source: string; id: string | number } | undefined;
    const clearHover = (): void => {
      if (hovered !== undefined) {
        map.setFeatureState(hovered, { hover: false });
        hovered = undefined;
      }
    };

    const onMove = (event: MapMouseEvent): void => {
      const hit = binderRef.current?.hitAt(event.point) ?? null;
      if (hit === null) {
        clearHover();
        canvas.style.cursor = "";
        setHover(null);
        return;
      }
      const { feature } = hit;
      if (!hit.hover) {
        clearHover();
      } else if (feature.source !== hovered?.source || feature.id !== hovered.id) {
        clearHover();
        if (feature.id !== undefined) {
          hovered = { source: feature.source, id: feature.id };
          map.setFeatureState(hovered, { hover: true });
        }
      }
      canvas.style.cursor = "pointer";
      const { x, y } = event.point;
      setHover({ kind: "area", title: hit.title, subtitle: hit.subtitle, x, y });
    };

    const onLeave = (): void => {
      clearHover();
      canvas.style.cursor = "";
      setHover(null);
    };

    const onClick = (event: MapMouseEvent): void => {
      const selection = binderRef.current?.hitAt(event.point)?.selection ?? null;
      if (selection === null) return;
      if (selection.kind === "unit") callbacks.current.onSelectUnit(selection.id);
      else callbacks.current.onSelectState(selection.code);
    };

    map.on("mousemove", onMove);
    map.on("mouseout", onLeave);
    map.on("click", onClick);
    return () => {
      clearHover();
      map.off("mousemove", onMove);
      map.off("mouseout", onLeave);
      map.off("click", onClick);
    };
  }, [ready]);

  /* --------------------------------------------------------------- layers */
  const input = useMemo<MapInput>(
    () => ({
      stateCode,
      stateOutlines,
      childBoundaries,
      activeGeometry,
      tenders,
      visibility: layers,
    }),
    [activeGeometry, childBoundaries, layers, stateCode, stateOutlines, tenders],
  );

  useEffect(() => {
    if (!ready) return;
    binderRef.current?.update(input);
  }, [input, ready]);

  // For the performance harness: when a level's boundaries have been drawn —
  // the first frame rendered after their source finished loading. Not `idle`:
  // that also waits for the camera's flight and every base-map tile, and timed
  // those instead of the boundaries.
  useEffect(() => {
    const map = mapRef.current;
    const features = childBoundaries?.features.length ?? 0;
    if (map === null || !ready || features === 0) return;
    const onRender = (): void => {
      mark(MARK.boundariesDrawn, { features });
    };
    const onData = (event: MapSourceDataEvent): void => {
      if (event.sourceId !== CHILD_SOURCE || !event.isSourceLoaded) return;
      map.off("sourcedata", onData);
      void map.once("render", onRender);
    };
    map.on("sourcedata", onData);
    return () => {
      map.off("sourcedata", onData);
      map.off("render", onRender);
    };
  }, [childBoundaries, ready]);

  /* --------------------------------------------------------------- labels */
  const labelLayerRef = useRef<PlaceLabelLayer | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const layer = createPlaceLabelLayer(map);
    labelLayerRef.current = layer;
    return () => {
      labelLayerRef.current = null;
      layer.destroy();
    };
  }, [ready]);

  const selectedUnitId = activeUnit?.id ?? null;
  const labels = useMemo(
    () => labelsFor(stateCode, states, childBoundaries, selectedUnitId),
    [childBoundaries, selectedUnitId, stateCode, states],
  );

  useEffect(() => {
    labelLayerRef.current?.setLabels(labels);
  }, [labels, ready]);

  useEffect(() => {
    labelLayerRef.current?.setVisible(layers.placeNames);
  }, [layers.placeNames, ready]);

  /* --------------------------------------------------------------- camera */
  const frame = useCallback(() => {
    const map = mapRef.current;
    if (map === null) return;
    const padding = framePadding(framing.current.insets, framing.current.compact);

    // The selected unit's own extent first, then the state's, then the country.
    if (activeUnit?.bbox != null) {
      fitTo(map, [...activeUnit.bbox] as BBox, {
        duration: CAMERA_MS.district,
        padding,
        maxZoom: 13,
      });
      return;
    }
    if (stateBbox !== null) {
      fitTo(map, stateBbox, { duration: CAMERA_MS.state, padding, maxZoom: 9 });
      return;
    }
    fitTo(map, INDIA_BBOX, { duration: CAMERA_MS.country, padding, maxZoom: 6 });
  }, [activeUnit, stateBbox]);

  useEffect(() => {
    if (ready) frame();
  }, [frame, ready]);

  // MapLibre watches the window, not its container. A container that changes
  // size on its own leaves the canvas at a stale resolution.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null || !ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        mapRef.current?.resize();
        frame();
      }, 150);
    });
    observer.observe(container);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [frame, ready]);

  useImperativeHandle(
    handleRef,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
      reframe: frame,
    }),
    [frame, handleRef],
  );

  if (failure !== null) return <MapUnavailable reason={failure} />;

  return (
    <>
      <div ref={containerRef} className={styles.map} data-testid="map-canvas" />
      <MapOverlays
        basemapPresent={basemapPresent}
        hover={hover}
        placeName={activeUnit?.name ?? null}
        stateName={states.find((s) => s.code === stateCode)?.name ?? null}
        loading={!ready}
      />
    </>
  );
}

/**
 * Which places are named.
 *
 * One level at a time. Showing state names over a district view produces a map
 * where the labels compete with each other instead of describing what the
 * reader is looking at. Below state level the anchors and sizes come from the
 * ledger itself (migration 0032), so a name sits inside its place and a level
 * nobody anticipated still gets labelled.
 *
 * Only selection, level and size reach the labels. Which name wins an overlap
 * is never decided by anything a place's records say.
 */
function labelsFor(
  stateCode: string | null,
  states: readonly StateOption[],
  children: FeatureCollection | null,
  selectedUnitId: number | null,
): readonly PlaceLabel[] {
  if (stateCode === null) {
    return states.map((s) => ({
      id: `state-${s.code}`,
      text: s.name,
      lngLat: s.labelPoint,
      level: "state",
      // Area of the state's largest ring, from the boundary manifest. Only
      // compared with other states, so its unit does not matter.
      size: s.labelWeight,
      selected: false,
      tone: "primary" as const,
    }));
  }
  if (children === null) return [];

  return children.features.flatMap((feature) => {
    const properties = feature.properties ?? {};
    const name: unknown = properties["name"];
    const unitId: unknown = properties["unitId"];
    const level: unknown = properties["level"];
    const labelPoint = pointOf(properties["labelPoint"]);
    const areaM2: unknown = properties["areaM2"];
    // No stored anchor means no name, rather than a guessed position. The ledger
    // computes one for every boundary, so this is a defect to surface, not a case.
    if (typeof name !== "string" || typeof unitId !== "number" || labelPoint === null) return [];
    return [
      {
        id: `unit-${String(unitId)}`,
        text: name,
        lngLat: labelPoint,
        level: typeof level === "string" ? level : "unknown",
        size: typeof areaM2 === "number" ? areaM2 : 0,
        selected: unitId === selectedUnitId,
        tone: "primary" as const,
      },
    ];
  });
}

function pointOf(value: unknown): readonly [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const lng: unknown = value[0];
  const lat: unknown = value[1];
  return typeof lng === "number" && typeof lat === "number" ? [lng, lat] : null;
}
