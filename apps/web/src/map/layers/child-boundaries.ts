import { LEVEL_LABEL, describeSources } from "@lokdarpan/domain";
import type { FeatureCollection } from "geojson";
import { color } from "@/ui/tokens";
import { EMPTY_COLLECTION, EMPTY_SOURCE, Z, type LayerDefinition } from "./types";

/**
 * Whatever level is being drilled into — districts, talukas, municipal bodies,
 * villages. One source, because the map draws one level at a time and the level
 * is decided by the data, not by the renderer.
 */
export const CHILD_SOURCE = "ld-children";

export const CHILD_LAYER = { fill: "ld-child-fill", line: "ld-child-line" } as const;

/** A ledger level rendered for a reader, falling back to the raw value. */
function levelLabel(level: unknown): string {
  if (typeof level !== "string") return "";
  return (LEVEL_LABEL as Readonly<Record<string, string | undefined>>)[level] ?? level;
}

/**
 * The registry ids of the sources the drawn boundaries came from.
 *
 * Read from the features rather than assumed, so a level loaded from a second
 * source names it. A name the registry does not hold is passed through, and is
 * described as a source with no recorded terms rather than dropped.
 */
export function boundarySourceIds(collection: FeatureCollection | null): readonly string[] {
  if (collection === null) return [];
  return collection.features.flatMap((feature) => {
    const name: unknown = feature.properties?.["sourceName"];
    if (typeof name !== "string" || name === "") return [];
    return [/openstreetmap/i.test(name) ? "openstreetmap" : name];
  });
}

export const childBoundaries: LayerDefinition = {
  id: "child-boundaries",
  urlToken: "cb",
  kind: "boundary",
  toggle: "areas",
  sources: { [CHILD_SOURCE]: { ...EMPTY_SOURCE, promoteId: "unitId" } as typeof EMPTY_SOURCE },
  reads: ["childBoundaries"],
  data: (input) => ({ [CHILD_SOURCE]: input.childBoundaries ?? EMPTY_COLLECTION }),
  styleLayers: ({ withBasemap }) => {
    const opacity = withBasemap ? { base: 0.02, hover: 0.22 } : { base: 0.06, hover: 0.55 };
    return [
      {
        z: Z.level,
        spec: {
          id: CHILD_LAYER.fill,
          type: "fill",
          source: CHILD_SOURCE,
          paint: {
            "fill-color": color.bg.surface,
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              opacity.hover,
              opacity.base,
            ],
          },
        },
      },
      {
        z: Z.level,
        spec: {
          id: CHILD_LAYER.line,
          type: "line",
          source: CHILD_SOURCE,
          layout: { "line-join": "round" },
          paint: { "line-color": color.border.strong, "line-width": 1 },
        },
      },
    ];
  },
  hit: {
    styleLayer: CHILD_LAYER.fill,
    order: 10,
    hover: true,
    toSelection: (properties) => {
      const id = properties["unitId"];
      return typeof id === "number" ? { kind: "unit", id } : null;
    },
    describe: (properties) => ({
      title: typeof properties["name"] === "string" ? properties["name"] : "",
      subtitle: levelLabel(properties["level"]),
    }),
  },
  provenance: (input) => describeSources(boundarySourceIds(input.childBoundaries)),
};
