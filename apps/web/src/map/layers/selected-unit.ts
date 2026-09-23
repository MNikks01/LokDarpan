import { describeSources } from "@lokdarpan/domain";
import type { Feature, Geometry } from "geojson";
import { color } from "@/ui/tokens";
import { EMPTY_COLLECTION, EMPTY_SOURCE, Z, type LayerDefinition } from "./types";

/** The selected unit's own boundary, drawn above its siblings. */
export const ACTIVE_SOURCE = "ld-active-unit";

export const ACTIVE_LAYER = { fill: "ld-active-fill", line: "ld-active-line" } as const;

function hasGeometry(geometry: unknown): geometry is Geometry {
  return typeof geometry === "object" && geometry !== null && "type" in geometry;
}

export const selectedUnit: LayerDefinition = {
  id: "selected-unit",
  urlToken: "su",
  kind: "boundary",
  // Always drawn: it is the answer to "where am I?", not a layer to browse.
  toggle: null,
  sources: { [ACTIVE_SOURCE]: EMPTY_SOURCE },
  reads: ["activeGeometry"],
  data: (input) => ({
    [ACTIVE_SOURCE]: hasGeometry(input.activeGeometry)
      ? ({ type: "Feature", properties: {}, geometry: input.activeGeometry } satisfies Feature)
      : EMPTY_COLLECTION,
  }),
  styleLayers: ({ withBasemap }) => [
    {
      z: Z.selectionFill,
      spec: {
        id: ACTIVE_LAYER.fill,
        type: "fill",
        source: ACTIVE_SOURCE,
        paint: { "fill-color": color.accent.soft, "fill-opacity": withBasemap ? 0.16 : 0.55 },
      },
    },
    {
      z: Z.selectionLine,
      spec: {
        id: ACTIVE_LAYER.line,
        type: "line",
        source: ACTIVE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": color.accent.base, "line-width": 2.2 },
      },
    },
  ],
  // The unit's detail geometry comes from the same boundary register as its siblings.
  provenance: (input) =>
    hasGeometry(input.activeGeometry) ? describeSources(["openstreetmap"]) : [],
};
