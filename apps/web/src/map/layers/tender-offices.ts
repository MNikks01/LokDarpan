import { color } from "@/ui/tokens";
import { CHILD_SOURCE } from "./child-boundaries";
import { Z, type LayerDefinition } from "./types";

export const TENDER_LAYER = { fill: "ld-tender-fill" } as const;

/**
 * Tender counts by the district of the ISSUING OFFICE, shaded.
 *
 * Owns no source. The counts ride inside the child boundaries' features
 * (`withTenderCounts`), so there is no second geometry to keep in step. A
 * district with no tenders has no `tenderCount` and stays unshaded: a zero
 * would be shaded palest and read as "we looked and found none", which
 * forward-only collection cannot support.
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
        filter: ["has", "tenderCount"],
        paint: {
          // One hue, light to dark: more is darker, never warmer. No red, and no
          // diverging ramp — a count is not good or bad.
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "tenderCount"],
            1,
            "#CDE7E3",
            3,
            "#7FC4BC",
            6,
            "#3C9A90",
            12,
            color.accent.base,
          ],
          "fill-opacity": 0.72,
        },
      },
    },
  ],
  provenance: (input) => input.tenders?.sources ?? [],
  dataState: (input) => input.tenders?.state ?? null,
};
