/**
 * Camera moves.
 *
 * Every geographic transition is a `fitBounds` on a known extent rather than a
 * hand-tuned centre and zoom, so the same code works for Goa and for Rajasthan
 * and nothing has to be re-tuned when a boundary set changes.
 *
 * Durations sit in the 500–900 ms band: long enough that the reader keeps hold
 * of where they were, short enough that a four-step drill-down does not feel
 * like a tour. `prefers-reduced-motion` collapses all of them to an instant cut,
 * which is a jump the user asked for rather than one imposed on them.
 */
import type { LngLatBoundsLike, Map as MapLibreMap, PaddingOptions } from "maplibre-gl";
import type { BBox, Position } from "geojson";

export const CAMERA_MS = {
  country: 900,
  state: 800,
  district: 700,
  localBody: 600,
  feature: 500,
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function toBounds(box: BBox): LngLatBoundsLike {
  const [west, south, east, north] = box;
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * Padding is asymmetric on purpose. Two floating panels overlap the map — the
 * filter rail on the left and the detail drawer on the right — and a fit that
 * ignored them would centre the selection underneath a panel, which reads as
 * the map having jumped to the wrong place.
 */
export function framePadding(
  insets: { readonly left: number; readonly right: number },
  compact: boolean,
): PaddingOptions {
  const base = compact ? 24 : 56;
  return {
    top: base,
    // On a phone the works sheet occupies the lower half of the screen.
    bottom: compact ? 200 : base,
    left: base + insets.left,
    right: base + insets.right,
  };
}

export function fitTo(
  map: MapLibreMap,
  box: BBox,
  options: {
    readonly duration: number;
    readonly padding: PaddingOptions;
    readonly maxZoom?: number;
  },
): void {
  map.fitBounds(toBounds(box), {
    padding: options.padding,
    duration: prefersReducedMotion() ? 0 : options.duration,
    maxZoom: options.maxZoom ?? 14,
    essential: true,
  });
}

export function bboxOfPositions(positions: readonly Position[]): BBox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const position of positions) {
    const lng = position[0];
    const lat = position[1];
    if (lng === undefined || lat === undefined) continue;
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  if (west === Infinity) return null;
  // A straight road has zero height or width; fitBounds on a degenerate box
  // zooms to the maximum. Pad it into a real rectangle first.
  const padLng = Math.max((east - west) * 0.15, 0.004);
  const padLat = Math.max((north - south) * 0.15, 0.004);
  return [west - padLng, south - padLat, east + padLng, north + padLat];
}

/** The rectangle drawn for a local body whose boundary is not published. */
export function extentPolygon(box: BBox): GeoJSON.Feature<GeoJSON.Polygon> {
  const [west, south, east, north] = box;
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
}
