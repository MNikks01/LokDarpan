import { describeSources } from "@lokdarpan/domain";
import { color } from "@/ui/tokens";
import { EMPTY_COLLECTION, EMPTY_SOURCE, Z, type LayerDefinition } from "./types";

export const STATE_SOURCE = "ld-states";

export const STATE_LAYER = {
  fill: "ld-state-fill",
  fillActive: "ld-state-fill-active",
  line: "ld-state-line",
} as const;

/**
 * The national outlines, from a static generalised file built at setup.
 *
 * The one layer whose geometry is not read from the ledger: the country view
 * needs all 36 at once, and a static file costs no database read per visit.
 * The selected state is shown by filter rather than by a second source.
 */
export const stateOutlines: LayerDefinition = {
  id: "state-outlines",
  urlToken: "so",
  kind: "boundary",
  toggle: "states",
  sources: { [STATE_SOURCE]: { ...EMPTY_SOURCE, promoteId: "stateCode" } as typeof EMPTY_SOURCE },
  reads: ["stateOutlines"],
  data: (input) => ({ [STATE_SOURCE]: input.stateOutlines ?? EMPTY_COLLECTION }),
  styleLayers: ({ withBasemap }) => {
    const opacity = withBasemap ? { state: 0.02, active: 0.18 } : { state: 0.9, active: 1 };
    return [
      {
        z: Z.region,
        spec: {
          id: STATE_LAYER.fill,
          type: "fill",
          source: STATE_SOURCE,
          paint: {
            "fill-color": color.bg.surface,
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "dimmed"], false],
              opacity.state * 0.4,
              opacity.state,
            ],
          },
        },
      },
      {
        z: Z.region,
        spec: {
          id: STATE_LAYER.fillActive,
          type: "fill",
          source: STATE_SOURCE,
          filter: ["==", ["get", "stateCode"], "__none__"],
          paint: { "fill-color": color.accent.soft, "fill-opacity": opacity.active },
        },
      },
      {
        z: Z.region,
        spec: {
          id: STATE_LAYER.line,
          type: "line",
          source: STATE_SOURCE,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "active"], false],
              color.accent.base,
              color.border.strong,
            ],
            "line-width": ["case", ["boolean", ["feature-state", "active"], false], 1.8, 0.7],
          },
        },
      },
    ];
  },
  filters: (input) => ({
    [STATE_LAYER.fillActive]: ["==", ["get", "stateCode"], input.stateCode ?? "__none__"],
  }),
  hit: {
    styleLayer: STATE_LAYER.fill,
    order: 20,
    hover: false,
    toSelection: (properties) => {
      const code = properties["stateCode"];
      return typeof code === "string" ? { kind: "state", code } : null;
    },
    describe: (properties) => {
      const name = properties["stateName"];
      return { title: typeof name === "string" ? name : "", subtitle: "State" };
    },
  },
  // OpenStreetMap geometry, matched to states in the Local Government Directory.
  provenance: () => describeSources(["openstreetmap", "lgd"]),
};
