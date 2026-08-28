"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapLibreMap } from "maplibre-gl";
import type { GeoJSONSource, MapGeoJSONFeature, MapMouseEvent } from "maplibre-gl";
import type React from "react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { GeoUnit } from "@lokdarpan/domain";
import { LEVEL_LABEL } from "@lokdarpan/domain";
import type { BBox, FeatureCollection } from "geojson";
import { INDIA_BBOX } from "@/domain/geography";
import type { StateOption } from "@/data/geography";
import { CAMERA_MS, fitTo, framePadding } from "@/map/camera";
import {
  EMPTY_COLLECTION,
  GeometryUnavailableError,
  fetchStateOutlines,
} from "@/map/geometry-source";
import { LAYER, SOURCE, buildStyle } from "@/map/style";
import { createPlaceLabelLayer, type PlaceLabel, type PlaceLabelLayer } from "@/map/place-labels";
import type { LayerVisibility } from "./layer-visibility";
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
  readonly states: readonly StateOption[];
  readonly layers: LayerVisibility;
  readonly insets: { readonly left: number; readonly right: number };
  readonly compact: boolean;
  readonly handleRef: React.RefObject<MapHandle | null>;
  readonly onSelectState: (stateCode: string) => void;
  readonly onSelectUnit: (unitId: number) => void;
}

const LOAD_TIMEOUT_MS = 15_000;

/** A ledger level rendered for a reader, falling back to the raw value. */
function levelLabel(level: string): string {
  return (LEVEL_LABEL as Readonly<Record<string, string | undefined>>)[level] ?? level;
}

function setSourceData(map: MapLibreMap, id: string, data: unknown): void {
  const source = map.getSource(id);
  // `setData` returns the source for chaining; nothing here needs the return.
  if (source !== undefined) (source as GeoJSONSource).setData(data as FeatureCollection);
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
 * Draws three things: state outlines, the boundaries of whatever level is being
 * drilled into, and the selected unit. It does not know what those levels are —
 * "children" is one source fed by the ledger, so a district of talukas and a
 * taluka of villages render through the same path with no per-level code.
 *
 * Geometry is handed to MapLibre and never diffed by React.
 */
export function MapCanvas({
  stateCode,
  stateBbox,
  activeUnit,
  activeGeometry,
  childBoundaries,
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
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);

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

    const start = async (): Promise<void> => {
      const style = await buildStyle();
      if (cancelled()) return;

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

      const outlines = await fetchStateOutlines();
      if (cancelled()) return;
      setSourceData(map, SOURCE.states, outlines);
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
      setReady(false);
    };
  }, []);

  /* ------------------------------------------------------------ handlers */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const canvas = map.getCanvas();

    /**
     * ONE hit test, not one listener per layer. Per-layer handlers all fire for
     * the same pointer and the last to run wins, so the state polygon underneath
     * an area was overwriting the area's own hover.
     */
    const topmost = (point: MapMouseEvent["point"]): MapGeoJSONFeature | null => {
      for (const id of [LAYER.childFill, LAYER.stateFill]) {
        if (map.getLayer(id) === undefined) continue;
        const [hit] = map.queryRenderedFeatures(point, { layers: [id] });
        if (hit !== undefined) return hit;
      }
      return null;
    };

    // Feature-state hover, so the fill lifts under the pointer without React
    // re-rendering the map on every mouse move.
    let hovered: string | number | undefined;
    const clearHover = (): void => {
      if (hovered !== undefined) {
        map.setFeatureState({ source: SOURCE.children, id: hovered }, { hover: false });
        hovered = undefined;
      }
    };

    const onMove = (event: MapMouseEvent): void => {
      const feature = topmost(event.point);
      if (feature === null) {
        clearHover();
        canvas.style.cursor = "";
        setHover(null);
        return;
      }
      if (feature.source === SOURCE.children && feature.id !== hovered) {
        clearHover();
        hovered = feature.id;
        if (hovered !== undefined) {
          map.setFeatureState({ source: SOURCE.children, id: hovered }, { hover: true });
        }
      }
      canvas.style.cursor = "pointer";
      const { x, y } = event.point;
      const level: unknown = feature.properties["level"];
      setHover({
        kind: "area",
        title: String(feature.properties["name"] ?? feature.properties["stateName"] ?? ""),
        subtitle: typeof level === "string" ? levelLabel(level) : "State",
        x,
        y,
      });
    };

    const onLeave = (): void => {
      clearHover();
      canvas.style.cursor = "";
      setHover(null);
    };

    const onClick = (event: MapMouseEvent): void => {
      const feature = topmost(event.point);
      if (feature === null) return;
      const unitId: unknown = feature.properties["unitId"];
      if (typeof unitId === "number") {
        callbacks.current.onSelectUnit(unitId);
        return;
      }
      const code: unknown = feature.properties["stateCode"];
      if (typeof code === "string") callbacks.current.onSelectState(code);
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

  /* ------------------------------------------------------------ geometry */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    setSourceData(map, SOURCE.children, childBoundaries ?? EMPTY_COLLECTION);
  }, [childBoundaries, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    setSourceData(
      map,
      SOURCE.active,
      activeGeometry === null || activeGeometry === undefined
        ? EMPTY_COLLECTION
        : { type: "Feature", properties: {}, geometry: activeGeometry },
    );
  }, [activeGeometry, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    map.setFilter(LAYER.stateFillActive, ["==", ["get", "stateCode"], stateCode ?? "__none__"]);
  }, [ready, stateCode]);

  /* ------------------------------------------------------ layer visibility */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    const show = (id: string, visible: boolean): void => {
      if (map.getLayer(id) !== undefined) {
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      }
    };
    show(LAYER.stateLine, layers.states);
    show(LAYER.stateFill, layers.states);
    show(LAYER.childFill, layers.areas);
    show(LAYER.childLine, layers.areas);
  }, [layers, ready]);

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

  const labels = useMemo(
    () => labelsFor(stateCode, states, childBoundaries),
    [childBoundaries, stateCode, states],
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
        hover={hover}
        placeName={activeUnit?.name ?? null}
        stateName={states.find((s) => s.code === stateCode)?.name ?? null}
        loading={!ready}
      />
    </>
  );
}

/**
 * Which places are named, and how loudly.
 *
 * One level at a time. Showing state names over a district view produces a map
 * where the labels compete with each other instead of describing what the
 * reader is looking at. Below state level the anchors come from the boundaries
 * themselves, so a level nobody anticipated still gets labelled.
 */
function labelsFor(
  stateCode: string | null,
  states: readonly StateOption[],
  children: FeatureCollection | null,
): readonly PlaceLabel[] {
  if (stateCode === null) {
    return states.map((s) => ({
      id: `state-${s.code}`,
      text: s.name,
      lngLat: s.labelPoint,
      priority: s.labelWeight,
      tone: "primary" as const,
    }));
  }
  if (children === null) return [];

  return children.features.flatMap((feature) => {
    const anchor = centroidOf(feature.geometry);
    const properties = feature.properties ?? {};
    const name: unknown = properties["name"];
    if (anchor === null || typeof name !== "string") return [];
    return [
      {
        id: `unit-${String(properties["unitId"] ?? name)}`,
        text: name,
        lngLat: anchor,
        // Bigger areas win a collision, measured from the geometry itself.
        priority: extentOf(feature.geometry),
        tone: "primary" as const,
      },
    ];
  });
}

/** Every coordinate in a geometry, however deeply nested. */
function* positions(geometry: unknown): Generator<readonly [number, number]> {
  if (!Array.isArray(geometry)) return;
  if (typeof geometry[0] === "number" && typeof geometry[1] === "number") {
    yield [geometry[0], geometry[1]];
    return;
  }
  for (const part of geometry) yield* positions(part);
}

function coordsOf(geometry: unknown): readonly (readonly [number, number])[] {
  if (typeof geometry !== "object" || geometry === null) return [];
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  return [...positions(coordinates)];
}

function centroidOf(geometry: unknown): readonly [number, number] | null {
  const points = coordsOf(geometry);
  if (points.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  return [(west + east) / 2, (south + north) / 2];
}

function extentOf(geometry: unknown): number {
  const points = coordsOf(geometry);
  if (points.length === 0) return 0;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  return (east - west) * (north - south);
}
