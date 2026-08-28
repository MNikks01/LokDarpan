"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Map as MapLibreMap } from "maplibre-gl";
import type { GeoJSONSource, MapGeoJSONFeature, MapMouseEvent } from "maplibre-gl";
import type React from "react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { DistrictSummary, LocalBody, StateSummary } from "@/domain/geography";
import { INDIA_BBOX } from "@/domain/geography";
import type { ProjectSummary } from "@/domain/project";
import { CAMERA_MS, bboxOfPositions, extentPolygon, fitTo, framePadding } from "@/map/camera";
import {
  EMPTY_COLLECTION,
  GeometryUnavailableError,
  fetchDistricts,
  fetchStateOutlines,
} from "@/map/geometry-source";
import { LAYER, SOURCE, buildStyle } from "@/map/style";
import { createPlaceLabelLayer, type PlaceLabel, type PlaceLabelLayer } from "@/map/place-labels";
import type { LOCAL_BODY_TYPE_LABEL } from "@/domain/geography";
import { PROJECT_STATUS_ORDER } from "@/ui/status";
import type { GeoSelection } from "@/state/useExplorerState";
import type { LayerVisibility } from "./layer-visibility";
import { MapOverlays, MapUnavailable } from "./MapOverlays";
import type { HoverTarget } from "./RoadTooltip";
import styles from "./explorer.module.css";
import type { FeatureCollection } from "geojson";

export interface MapHandle {
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  /** Re-frame the current selection; used by "Reset view". */
  readonly reframe: () => void;
}

export interface MapCanvasProps {
  readonly geo: GeoSelection;
  readonly state: StateSummary | null;
  readonly district: DistrictSummary | null;
  readonly localBody: LocalBody | null;
  /** Everything nameable at the current level, for the label layer. */
  readonly states: readonly StateSummary[];
  readonly districts: readonly DistrictSummary[];
  readonly localBodies: readonly LocalBody[];
  readonly projects: readonly ProjectSummary[];
  readonly selectedProjectId: string | null;
  readonly layers: LayerVisibility;
  readonly insets: { readonly left: number; readonly right: number };
  readonly compact: boolean;
  readonly handleRef: React.RefObject<MapHandle | null>;
  readonly onSelectState: (stateCode: string) => void;
  readonly onSelectDistrict: (districtId: string) => void;
  readonly onSelectProject: (projectId: string) => void;
}

const ROAD_LAYERS = PROJECT_STATUS_ORDER.map((status) => LAYER.roadByStatus(status));

function roadCollection(projects: readonly ProjectSummary[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: projects.map((project) => ({
      type: "Feature",
      id: project.id,
      properties: {
        id: project.id,
        name: project.name,
        status: project.status,
        externalId: project.externalId,
      },
      geometry: project.geometry.geometry,
    })),
  };
}

function setSourceData(
  map: MapLibreMap,
  id: string,
  data: FeatureCollection | GeoJSON.Feature,
): void {
  const source = map.getSource(id);
  // `setData` returns the source for chaining; nothing here needs the return.
  if (source !== undefined) (source as GeoJSONSource).setData(data);
}

/**
 * Resolve when the map is ready to accept data.
 *
 * Bounded, because `load` can simply never arrive — a failed worker, a lost
 * WebGL context — and an unbounded await leaves the reader looking at an empty
 * frame with no explanation forever. A timeout turns that into a message.
 */
const LOAD_TIMEOUT_MS = 15_000;

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

export function MapCanvas({
  geo,
  state,
  district,
  localBody,
  states,
  districts,
  localBodies,
  projects,
  selectedProjectId,
  layers,
  insets,
  compact,
  handleRef,
  onSelectState,
  onSelectDistrict,
  onSelectProject,
}: MapCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);

  // Callbacks are read through a ref inside long-lived MapLibre handlers, so a
  // re-render never forces the map to tear its listeners down and rebind them.
  const callbacks = useRef({ onSelectState, onSelectDistrict, onSelectProject });
  callbacks.current = { onSelectState, onSelectDistrict, onSelectProject };

  const framing = useRef({ insets, compact });
  framing.current = { insets, compact };

  /* ---------------------------------------------------------------- init */
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    // The instance lives on a mutable holder rather than a `let`: the cleanup
    // closure runs after the async setup, and a plain binding would be narrowed
    // to its initial `null` by control-flow analysis.
    const holder: { instance: MapLibreMap | null; cancelled: boolean } = {
      instance: null,
      cancelled: false,
    };
    // Read through a call, not the property: control-flow analysis narrows a
    // property that is only ever assigned in the cleanup closure to `false`,
    // and would quietly delete every bail-out below.
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
      // from "this area has no records" — the one confusion this product must
      // not create.
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
        error instanceof Error
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
     * ONE hit test, not one listener per layer.
     *
     * Per-layer `mousemove` handlers all fire for the same pointer position and
     * the last one to run wins, so the district polygon underneath a road was
     * overwriting the road's own hover — the reader got "Nagpur, District" while
     * pointing straight at a work. Querying in priority order makes precedence
     * explicit: the smallest thing under the cursor is the thing you meant.
     */
    const topmost = (point: MapMouseEvent["point"]): MapGeoJSONFeature | null => {
      for (const layers of [[LAYER.roadHit], [LAYER.districtFill], [LAYER.stateFill]]) {
        const present = layers.filter((id) => map.getLayer(id) !== undefined);
        if (present.length === 0) continue;
        const [hit] = map.queryRenderedFeatures(point, { layers: present });
        if (hit !== undefined) return hit;
      }
      return null;
    };

    const onMove = (event: MapMouseEvent): void => {
      const feature = topmost(event.point);
      if (feature === null) {
        canvas.style.cursor = "";
        setHover(null);
        return;
      }
      canvas.style.cursor = "pointer";
      const { x, y } = event.point;

      if (typeof feature.properties["status"] === "string") {
        setHover({ kind: "project", projectId: String(feature.properties["id"]), x, y });
        return;
      }
      const districtName: unknown = feature.properties["districtName"];
      setHover({
        kind: "area",
        title: String(districtName ?? feature.properties["stateName"] ?? ""),
        subtitle: districtName === undefined ? "State" : "District",
        x,
        y,
      });
    };

    const onLeave = (): void => {
      canvas.style.cursor = "";
      setHover(null);
    };

    const onClick = (event: MapMouseEvent): void => {
      const feature = topmost(event.point);
      if (feature === null) return;
      const properties = feature.properties;

      if (typeof properties["status"] === "string") {
        callbacks.current.onSelectProject(String(properties["id"]));
        return;
      }
      const districtCode: unknown = properties["districtCode"];
      if (typeof districtCode === "string") {
        callbacks.current.onSelectDistrict(`${String(properties["stateCode"])}-${districtCode}`);
        return;
      }
      if (typeof properties["stateCode"] === "string") {
        callbacks.current.onSelectState(properties["stateCode"]);
      }
    };

    map.on("mousemove", onMove);
    map.on("mouseout", onLeave);
    map.on("click", onClick);

    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onLeave);
      map.off("click", onClick);
    };
  }, [ready]);

  /* ------------------------------------------------------------- geometry */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    let cancelled = false;

    if (geo.stateCode === null) {
      setSourceData(map, SOURCE.districts, EMPTY_COLLECTION);
      return;
    }
    void fetchDistricts(geo.stateCode)
      .then((collection) => {
        if (!cancelled && mapRef.current !== null) {
          setSourceData(mapRef.current, SOURCE.districts, collection);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFailure(
            error instanceof GeometryUnavailableError
              ? error.message
              : "District boundaries could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [geo.stateCode, ready]);

  /* -------------------------------------------------------------- filters */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;

    map.setFilter(LAYER.stateFillActive, ["==", ["get", "stateCode"], geo.stateCode ?? "__none__"]);
    map.setFilter(LAYER.districtFillActive, [
      "==",
      ["get", "districtCode"],
      district?.code ?? "__none__",
    ]);
    map.setFilter(LAYER.roadSelected, ["==", ["get", "id"], selectedProjectId ?? "__none__"]);
    map.setFilter(LAYER.roadHover, [
      "==",
      ["get", "id"],
      hover?.kind === "project" ? hover.projectId : "__none__",
    ]);
  }, [district, geo.stateCode, hover, ready, selectedProjectId]);

  /* ---------------------------------------------------------------- works */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    setSourceData(map, SOURCE.roads, roadCollection(projects));
  }, [projects, ready]);

  /* ------------------------------------------------------- local body extent */
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready) return;
    setSourceData(
      map,
      SOURCE.extent,
      localBody === null ? EMPTY_COLLECTION : extentPolygon(localBody.focusBbox),
    );
  }, [localBody, ready]);

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
    show(LAYER.districtLine, layers.districts);
    show(LAYER.districtFill, layers.districts);
    show(LAYER.extentLine, layers.localBodies);
    show(LAYER.roadHit, layers.works);
    show(LAYER.roadCasing, layers.works);
    show(LAYER.roadSelected, layers.works);
    show(LAYER.roadHover, layers.works);
    for (const layer of ROAD_LAYERS) show(layer, layers.works);
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
    () => labelsFor({ geo, states, districts, localBodies, district }),
    [district, districts, geo, localBodies, states],
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

    if (localBody !== null) {
      fitTo(map, localBody.focusBbox, { duration: CAMERA_MS.localBody, padding, maxZoom: 13 });
      return;
    }
    if (district !== null) {
      fitTo(map, district.bbox, { duration: CAMERA_MS.district, padding, maxZoom: 11 });
      return;
    }
    if (state !== null) {
      fitTo(map, state.bbox, { duration: CAMERA_MS.state, padding, maxZoom: 9 });
      return;
    }
    fitTo(map, INDIA_BBOX, { duration: CAMERA_MS.country, padding, maxZoom: 6 });
  }, [district, localBody, state]);

  useEffect(() => {
    if (ready) frame();
  }, [frame, ready]);

  // Re-frame when the viewport changes size. MapLibre resizes its canvas on its
  // own but keeps the centre and zoom, so a window that grows leaves the
  // selection sitting small and off-centre — the reader sees the map "drift"
  // for no reason they caused.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null || !ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // MapLibre only watches the window, not its container. A container that
        // changes size on its own leaves the canvas at a stale resolution, so
        // the resize has to be handed to it before the camera is re-framed.
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

  // Selecting a work frames the work itself. Without this the reader clicks a
  // line in a list and nothing on the map moves, which breaks the link between
  // the record and the place it describes.
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !ready || selectedProjectId === null) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (project === undefined) return;
    const box = bboxOfPositions(project.geometry.geometry.coordinates);
    if (box === null) return;
    fitTo(map, box, {
      duration: CAMERA_MS.feature,
      padding: framePadding(framing.current.insets, framing.current.compact),
      maxZoom: 14,
    });
  }, [projects, ready, selectedProjectId]);

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
        projects={projects}
        state={state}
        district={district}
        localBody={localBody}
        loading={!ready}
      />
    </>
  );
}

/**
 * Which places are named, and how loudly.
 *
 * One level at a time. Showing state names over a district view, or district
 * names over a single town, produces a map where the labels compete with each
 * other instead of describing what the reader is looking at.
 *
 * Priority decides who survives a collision: bigger administrative units first,
 * and among local bodies the denser ones, because a municipal corporation is
 * what a reader is most likely looking for and a gram panchayat the least.
 */
function labelsFor(scope: {
  readonly geo: GeoSelection;
  readonly states: readonly StateSummary[];
  readonly districts: readonly DistrictSummary[];
  readonly localBodies: readonly LocalBody[];
  readonly district: DistrictSummary | null;
}): readonly PlaceLabel[] {
  const { geo, states, districts, localBodies, district } = scope;

  if (geo.stateCode === null) {
    return states.map((s) => ({
      id: `state-${s.code}`,
      text: s.name,
      lngLat: s.labelPoint,
      priority: s.labelWeight,
      tone: "primary" as const,
    }));
  }

  if (geo.districtId === null) {
    return districts.map((d) => ({
      id: `district-${d.id}`,
      text: d.name,
      lngLat: d.labelPoint,
      priority: d.labelWeight,
      tone: "primary" as const,
    }));
  }

  // Inside a district: name the district itself, then the towns and villages
  // the records hold for it.
  const bodies: PlaceLabel[] = localBodies.map((body) => ({
    id: `body-${body.id}`,
    text: body.name,
    lngLat: centreOfBbox(body.focusBbox),
    priority: LOCAL_BODY_RANK[body.type],
    tone: "primary" as const,
  }));

  return district === null
    ? bodies
    : [
        {
          id: `district-${district.id}`,
          text: `${district.name} district`,
          lngLat: district.labelPoint,
          priority: 0,
          tone: "secondary" as const,
        },
        ...bodies,
      ];
}

/** Denser bodies win a collision; the ranking is the local-government tier. */
const LOCAL_BODY_RANK: Readonly<Record<keyof typeof LOCAL_BODY_TYPE_LABEL, number>> = {
  municipal_corporation: 60,
  municipal_council: 50,
  cantonment_board: 40,
  nagar_panchayat: 30,
  zilla_parishad: 20,
  gram_panchayat: 10,
};

function centreOfBbox(box: GeoJSON.BBox): readonly [number, number] {
  const [west, south, east, north] = box;
  return [(west + east) / 2, (south + north) / 2];
}
