import { describe, expect, it } from "vitest";
import type { FeatureCollection, Point } from "geojson";
import { describeSources, type DataState } from "@lokdarpan/domain";
import { DEFAULT_LAYERS } from "@/map/layers/visibility";
import { EMPTY_COLLECTION, type MapInput } from "@/map/layers/types";
import { createBinder, type HitFeature, type MapPort } from "./binder";

const POINT: Point = { type: "Point", coordinates: [0, 0] };

/** A map that records what the binder asked of it, and answers hit tests from a table. */
function fakeMap(hits: Record<string, HitFeature[]> = {}) {
  const calls: string[] = [];
  const data = new Map<string, unknown>();
  const states = new Map<string, number>();
  const visibility = new Map<string, string>();
  const layerIds = new Set([
    "ld-state-fill",
    "ld-state-fill-active",
    "ld-state-line",
    "ld-active-fill",
    "ld-tender-fill",
    "ld-child-fill",
    "ld-child-line",
    "ld-active-line",
  ]);
  const map: MapPort = {
    getSource: (id) => ({
      setData: (value: never) => {
        calls.push(`setData ${id}`);
        data.set(id, value);
      },
    }),
    getLayer: (id) => (layerIds.has(id) ? { id } : undefined),
    setLayoutProperty: (id, _name, value) => {
      calls.push(`visibility ${id} ${value}`);
      visibility.set(id, value);
    },
    setFilter: (id) => {
      calls.push(`filter ${id}`);
    },
    queryRenderedFeatures: (_point, options) => hits[options.layers[0] ?? ""] ?? [],
    setFeatureState: (target, state) => {
      calls.push(`state ${target.source} ${String(target.id)}`);
      for (const [key, value] of Object.entries(state)) {
        states.set(`${target.source}/${String(target.id)}/${key}`, value);
      }
    },
    removeFeatureState: (target, key) => {
      calls.push(`unstate ${target.source} ${String(target.id)}`);
      states.delete(`${target.source}/${String(target.id)}/${key}`);
    },
  };
  return { map, calls, data, visibility, states };
}

const level: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: 7,
      geometry: POINT,
      properties: {
        unitId: 7,
        name: "Nagpur",
        level: "district",
        sourceName: "© OpenStreetMap contributors",
      },
    },
  ],
};

const outlines: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: POINT, properties: { stateCode: "27", stateName: "Maharashtra" } },
  ],
};

const collected = { collection: "collected" } as DataState;
const notCollected = { collection: "not_collected" } as DataState;

const input = (over: Partial<MapInput> = {}): MapInput => ({
  stateCode: "27",
  stateOutlines: outlines,
  childBoundaries: level,
  activeGeometry: null,
  tenders: {
    sources: describeSources(["gepnic-od"]),
    state: collected,
    counts: [{ adminUnitId: 7, tenderCount: 4 }],
  },
  visibility: DEFAULT_LAYERS,
  ...over,
});

describe("the layer binder", () => {
  it("sends a source's data once, and again only when what it reads changes", () => {
    const { map, calls } = fakeMap();
    const binder = createBinder(map);
    const first = input();

    binder.update(first);
    binder.update({ ...first, visibility: { ...DEFAULT_LAYERS } });
    expect(calls.filter((c) => c === "setData ld-children")).toHaveLength(1);

    binder.update({ ...first, childBoundaries: { ...level } });
    expect(calls.filter((c) => c === "setData ld-children")).toHaveLength(2);
  });

  it("sets a filter only when it changes", () => {
    const { map, calls } = fakeMap();
    const binder = createBinder(map);
    binder.update(input());
    binder.update(input());
    binder.update(input({ stateCode: "21" }));
    expect(calls.filter((c) => c === "filter ld-state-fill-active")).toHaveLength(2);
  });

  it("follows the reader's toggles", () => {
    const { map, visibility } = fakeMap();
    const binder = createBinder(map);
    binder.update(input({ visibility: { ...DEFAULT_LAYERS, areas: false } }));
    expect(visibility.get("ld-child-fill")).toBe("none");
    expect(visibility.get("ld-child-line")).toBe("none");
    expect(visibility.get("ld-state-fill")).toBe("visible");
  });

  it("draws nothing for tenders in a state that is not collected", () => {
    const { map, visibility } = fakeMap();
    const binder = createBinder(map);
    binder.update(
      input({
        tenders: { sources: describeSources(["gepnic-od"]), state: notCollected, counts: [] },
      }),
    );
    expect(visibility.get("ld-tender-fill")).toBe("none");
    expect(binder.refused().get("tender-offices")).toBe("not collected");
  });

  it("draws nothing for tenders whose sources it cannot name", () => {
    const { map, visibility } = fakeMap();
    const binder = createBinder(map);
    binder.update(input({ tenders: null }));
    expect(visibility.get("ld-tender-fill")).toBe("none");
    expect(binder.refused().get("tender-offices")).toBe("no provenance");
  });

  it("empties a refused layer's source rather than only hiding it, and refills it after", () => {
    const { map, data } = fakeMap();
    const binder = createBinder(map);
    binder.update(input());
    const noSource = { ...level, features: level.features.map((f) => ({ ...f, properties: {} })) };

    binder.update(input({ childBoundaries: noSource }));
    expect(data.get("ld-children")).toBe(EMPTY_COLLECTION);
    expect(binder.refused().get("child-boundaries")).toBe("no provenance");

    binder.update(input());
    expect(data.get("ld-children")).toBe(level);
  });

  it("tests the level under the pointer before the state, and resolves it to a selection", () => {
    const { map } = fakeMap({
      "ld-child-fill": [
        { id: 7, source: "ld-children", properties: level.features[0]?.properties ?? {} },
      ],
      "ld-state-fill": [
        { source: "ld-states", properties: { stateCode: "27", stateName: "Maharashtra" } },
      ],
    });
    const binder = createBinder(map);
    binder.update(input());

    expect(binder.hitAt({ x: 1, y: 1 })).toMatchObject({
      layer: "child-boundaries",
      selection: { kind: "unit", id: 7 },
      title: "Nagpur",
      subtitle: "District",
      hover: true,
    });
  });

  it("skips a hidden layer and falls through to the one beneath", () => {
    const { map } = fakeMap({
      "ld-child-fill": [{ id: 7, source: "ld-children", properties: { unitId: 7 } }],
      "ld-state-fill": [
        { source: "ld-states", properties: { stateCode: "27", stateName: "Maharashtra" } },
      ],
    });
    const binder = createBinder(map);
    binder.update(input({ visibility: { ...DEFAULT_LAYERS, areas: false } }));

    expect(binder.hitAt({ x: 1, y: 1 })).toMatchObject({
      layer: "state-outlines",
      selection: { kind: "state", code: "27" },
      title: "Maharashtra",
      subtitle: "State",
      hover: false,
    });
  });

  it("finds nothing where nothing is drawn", () => {
    const { map } = fakeMap();
    const binder = createBinder(map);
    binder.update(input());
    expect(binder.hitAt({ x: 1, y: 1 })).toBeNull();
  });

  it("shades by feature-state, never by re-sending the level", () => {
    const { map, calls, states } = fakeMap();
    const binder = createBinder(map);
    const first = input();
    binder.update(first);
    expect(states.get("ld-children/7/tenderCount")).toBe(4);

    // The counts change — a department is chosen — and the geometry does not move.
    binder.update({
      ...first,
      tenders: {
        ...(first.tenders ?? { sources: [], state: null }),
        counts: [{ adminUnitId: 7, tenderCount: 1 }],
      },
    });
    expect(states.get("ld-children/7/tenderCount")).toBe(1);
    expect(calls.filter((c) => c === "setData ld-children")).toHaveLength(1);
  });

  it("gives a district with no tenders no state, not a zero", () => {
    const { map, states } = fakeMap();
    const binder = createBinder(map);
    binder.update(
      input({
        tenders: {
          sources: describeSources(["gepnic-od"]),
          state: collected,
          counts: [
            { adminUnitId: 7, tenderCount: 0 },
            { adminUnitId: 8, tenderCount: 2 },
          ],
        },
      }),
    );
    expect(states.has("ld-children/7/tenderCount")).toBe(false);
    expect(states.get("ld-children/8/tenderCount")).toBe(2);
  });

  it("removes a count that is no longer held, and every count when the layer is refused", () => {
    const { map, states } = fakeMap();
    const binder = createBinder(map);
    binder.update(input());
    binder.update(
      input({ tenders: { sources: describeSources(["gepnic-od"]), state: collected, counts: [] } }),
    );
    expect(states.has("ld-children/7/tenderCount")).toBe(false);

    binder.update(input());
    expect(states.get("ld-children/7/tenderCount")).toBe(4);
    binder.update(
      input({
        tenders: {
          sources: describeSources(["gepnic-od"]),
          state: notCollected,
          counts: [{ adminUnitId: 7, tenderCount: 4 }],
        },
      }),
    );
    expect(states.size).toBe(0);
  });

  it("re-applies counts after the level's data is re-sent", () => {
    const { map, calls } = fakeMap();
    const binder = createBinder(map);
    binder.update(input());
    binder.update(input({ childBoundaries: { ...level } }));
    expect(calls.filter((c) => c === "state ld-children 7")).toHaveLength(2);
  });
});
