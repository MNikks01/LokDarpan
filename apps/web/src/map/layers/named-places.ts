import { describeSources, type NamedPlace } from "@lokdarpan/domain";
import type { FeatureCollection } from "geojson";
import { placesCopy } from "@/copy/places";
import { color } from "@/ui/tokens";
import { EMPTY_COLLECTION, EMPTY_SOURCE, Z, type LayerDefinition, type MapInput } from "./types";

/**
 * A pin on each district and taluka a reviewed audit page names (ADR-077).
 *
 * The first point layer. Every pin is drawn the same: size and colour carry no
 * count, because "what is drawn is not what is ranked"
 * (`.docs/decisions/gods-eye-view-adoption.md`), and a pin that grew with the
 * number of pages naming a place would turn a citation index into a map of
 * where the auditor looked hardest, read as a map of where things went wrong.
 * The count is in the tooltip, as words.
 *
 * A pin sits at the centre of the place's own boundary. It marks that a page
 * names the place, never where any money was spent.
 */
export const NAMED_PLACES_SOURCE = "ld-named-places";
export const NAMED_PLACES_LAYER = { circle: "ld-named-places-circle" } as const;

export function namedPlaceFeatures(places: readonly NamedPlace[] | null): FeatureCollection {
  if (places === null) return EMPTY_COLLECTION;
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      id: p.unitId,
      geometry: { type: "Point", coordinates: [p.point[0], p.point[1]] },
      properties: { unitId: p.unitId, name: p.name, pages: p.pages, reports: p.reports },
    })),
  };
}

const count = (value: unknown): number => (typeof value === "number" ? value : 0);

export const namedPlaces: LayerDefinition = {
  id: "named-places",
  urlToken: "ap",
  kind: "records",
  toggle: "auditPlaces",
  sources: {
    [NAMED_PLACES_SOURCE]: { ...EMPTY_SOURCE, promoteId: "unitId" } as typeof EMPTY_SOURCE,
  },
  reads: ["namedPlaces"],
  data: (input: MapInput) => ({ [NAMED_PLACES_SOURCE]: namedPlaceFeatures(input.namedPlaces) }),
  styleLayers: () => [
    {
      z: Z.records,
      spec: {
        id: NAMED_PLACES_LAYER.circle,
        type: "circle",
        source: NAMED_PLACES_SOURCE,
        paint: {
          // One size and one colour for every pin; hover lifts, nothing else varies.
          "circle-radius": ["case", ["boolean", ["feature-state", "hover"], false], 7, 5],
          "circle-color": color.accent.base,
          "circle-stroke-color": color.bg.surface,
          "circle-stroke-width": 1.5,
        },
      },
    },
  ],
  hit: {
    styleLayer: NAMED_PLACES_LAYER.circle,
    // Before the area under it, so a pin is reachable where it sits.
    order: 5,
    hover: true,
    toSelection: (properties) => {
      const id = properties["unitId"];
      return typeof id === "number" ? { kind: "unit", id } : null;
    },
    describe: (properties) => ({
      title: typeof properties["name"] === "string" ? properties["name"] : "",
      subtitle: placesCopy.pinSubtitle(count(properties["pages"]), count(properties["reports"])),
    }),
  },
  provenance: (input) =>
    input.namedPlaces === null || input.namedPlaces.length === 0 ? [] : describeSources(["cag"]),
};
