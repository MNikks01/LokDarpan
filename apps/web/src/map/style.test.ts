import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BASEMAP_STYLE,
  basemapStyleUrl,
  buildStyle,
  fetchBasemap,
  withoutAdministrativeClaims,
} from "./style";

/** The shape of OpenFreeMap's positron style, as fetched on 2026-09-25, cut down. */
const PROVIDER: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.example.invalid/fonts/{fontstack}/{range}.pbf",
  sprite: "https://tiles.example.invalid/sprites/ofm",
  sources: { openmaptiles: { type: "vector", url: "https://tiles.example.invalid/planet" } },
  layers: [
    { id: "background", type: "background" },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water" },
    {
      id: "boundary_2",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 2],
    },
    {
      id: "boundary_disputed",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["==", ["get", "disputed"], 1],
    },
    {
      id: "label_country_1",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "country"],
    },
    {
      id: "label_town",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "town"],
    },
    { id: "label_any", type: "symbol", source: "openmaptiles", "source-layer": "place" },
  ] as LayerSpecification[],
};

const NOT_JURISDICTION = [
  "!",
  ["in", ["get", "class"], ["literal", ["continent", "country", "state", "province"]]],
];

const answer = (response: Response | Error) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response))),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("which base map", () => {
  it("is the hosted default unless configured, and none when configured empty", () => {
    expect(basemapStyleUrl()).toBe(DEFAULT_BASEMAP_STYLE);
    vi.stubEnv("NEXT_PUBLIC_BASEMAP_STYLE_URL", "https://maps.example.invalid/style.json");
    expect(basemapStyleUrl()).toBe("https://maps.example.invalid/style.json");
    vi.stubEnv("NEXT_PUBLIC_BASEMAP_STYLE_URL", "");
    expect(basemapStyleUrl()).toBeNull();
  });
});

describe("the base map makes no administrative claim", () => {
  const stripped = withoutAdministrativeClaims(PROVIDER);
  const byId = new Map(stripped.layers.map((l) => [l.id, l]));

  it("draws no boundary of any kind, disputed or not", () => {
    expect(byId.has("boundary_2")).toBe(false);
    expect(byId.has("boundary_disputed")).toBe(false);
  });

  it("names no country or state, however the provider names its layers", () => {
    // Narrowed rather than removed by id, so a renamed layer cannot bring a
    // country label back.
    expect(byId.get("label_country_1")).toMatchObject({
      filter: ["all", NOT_JURISDICTION, ["==", ["get", "class"], "country"]],
    });
    expect(byId.get("label_any")).toMatchObject({ filter: NOT_JURISDICTION });
  });

  it("keeps the geography a reader navigates by", () => {
    expect(byId.get("water")).toEqual(PROVIDER.layers[1]);
    expect(byId.get("label_town")).toMatchObject({
      filter: ["all", NOT_JURISDICTION, ["==", ["get", "class"], "town"]],
    });
  });
});

describe("fetching the provider's style", () => {
  it("returns it stripped, with the credit the data's licence requires", async () => {
    answer(new Response(JSON.stringify(PROVIDER)));
    const basemap = await fetchBasemap(DEFAULT_BASEMAP_STYLE);
    expect(basemap?.style.layers.some((l) => l.id === "boundary_2")).toBe(false);
    expect(basemap?.attribution).toMatch(/OpenStreetMap contributors/);
  });

  it("uses the credit a provider states, without its markup", async () => {
    const credited = {
      ...PROVIDER,
      sources: {
        tiles: {
          type: "vector",
          url: "https://x.invalid",
          attribution: '<a href="https://x.invalid">© Provider</a> © OpenStreetMap',
        },
      },
    };
    answer(new Response(JSON.stringify(credited)));
    const basemap = await fetchBasemap("https://maps.example.invalid/style.json");
    expect(basemap?.attribution).toBe("© Provider © OpenStreetMap");
  });

  it("names the host when a configured provider states no credit", async () => {
    answer(new Response(JSON.stringify(PROVIDER)));
    const basemap = await fetchBasemap("https://maps.example.invalid/style.json");
    expect(basemap?.attribution).toBe("Base map: maps.example.invalid");
  });

  it("gives up quietly when the provider fails, so the ledger's boundaries still draw", async () => {
    answer(new Response("not found", { status: 404 }));
    await expect(fetchBasemap(DEFAULT_BASEMAP_STYLE)).resolves.toBeNull();
    answer(new Response("<!DOCTYPE html>"));
    await expect(fetchBasemap(DEFAULT_BASEMAP_STYLE)).resolves.toBeNull();
    answer(new Response(JSON.stringify({ version: 7, layers: [], sources: {} })));
    await expect(fetchBasemap(DEFAULT_BASEMAP_STYLE)).resolves.toBeNull();
    answer(new Error("offline"));
    await expect(fetchBasemap(DEFAULT_BASEMAP_STYLE)).resolves.toBeNull();
  });
});

describe("composing the style", () => {
  it("puts the ledger's layers over the base map, with the base's fonts and icons", () => {
    const style = buildStyle({
      basemap: { style: withoutAdministrativeClaims(PROVIDER), attribution: "x" },
    });
    expect(style.glyphs).toBe(PROVIDER.glyphs);
    expect(style.sprite).toBe(PROVIDER.sprite);
    expect(Object.keys(style.sources)).toContain("openmaptiles");
    const ids = style.layers.map((l) => l.id);
    expect(ids[0]).toBe("background");
    expect(ids).not.toContain("ld-background");
    expect(ids.indexOf("water")).toBeLessThan(ids.length - 1);
  });
});
