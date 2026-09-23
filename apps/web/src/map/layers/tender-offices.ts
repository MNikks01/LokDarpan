import type { ExpressionSpecification } from "maplibre-gl";
import { color } from "@/ui/tokens";
import { CHILD_SOURCE } from "./child-boundaries";
import { Z, type FeatureStates, type LayerDefinition, type MapInput } from "./types";

export const TENDER_LAYER = { fill: "ld-tender-fill" } as const;

const COUNT: ExpressionSpecification = ["coalesce", ["feature-state", "tenderCount"], 0];

/**
 * Each district's count, as feature-state on the child boundaries' source.
 *
 * Only districts with at least one tender get a value. A district with none
 * held gets no state and stays unshaded: a zero would be shaded palest and read
 * as "we looked and found none", which forward-only collection cannot support.
 */
export function tenderStates(input: MapInput): FeatureStates {
  const counts = input.tenders?.counts ?? [];
  return {
    source: CHILD_SOURCE,
    key: "tenderCount",
    values: new Map(
      counts.filter((c) => c.tenderCount > 0).map((c) => [c.adminUnitId, c.tenderCount]),
    ),
  };
}

/**
 * Tender counts by the district of the ISSUING OFFICE, shaded.
 *
 * Owns no source and sends no geometry. The counts are feature-state on the
 * child boundaries (ADR-065): when they arrive, or the department changes, only
 * numbers move. They used to be merged into the features, which re-sent and
 * re-tiled the whole level each time and drew it twice on every visit.
 *
 * Drawn only where collection is recorded, and only with the portals named. A
 * state that is not collected draws nothing rather than an unshaded map that
 * looks like a finding.
 */
export const tenderOffices: LayerDefinition = {
  id: "tender-offices",
  urlToken: "to",
  kind: "aggregate",
  toggle: null,
  sources: {},
  reads: [],
  styleLayers: () => [
    {
      z: Z.aggregate,
      spec: {
        id: TENDER_LAYER.fill,
        type: "fill",
        source: CHILD_SOURCE,
        paint: {
          // One hue, light to dark: more is darker, never warmer. No red, and no
          // diverging ramp — a count is not good or bad.
          "fill-color": [
            "interpolate",
            ["linear"],
            COUNT,
            1,
            "#CDE7E3",
            3,
            "#7FC4BC",
            6,
            "#3C9A90",
            12,
            color.accent.base,
          ],
          // Transparent where no state is set: unshaded, not shaded zero.
          "fill-opacity": ["case", [">", COUNT, 0], 0.72, 0],
        },
      },
    },
  ],
  featureState: tenderStates,
  provenance: (input) => input.tenders?.sources ?? [],
  dataState: (input) => input.tenders?.state ?? null,
};
