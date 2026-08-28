/**
 * Geography — the one hierarchy.
 *
 * CLAUDE.md / `.docs/05-data-model/database-design.md`: `admin_unit` is the only
 * hierarchy, and clients address a place through it. These types are the shape
 * of a unit as the explorer needs it, not a second hierarchy: `AdminLevel`
 * mirrors the closure table's levels and `unitId` is the handle that a real
 * backend will resolve to `/units/:id`.
 */
import type { Feature, MultiPolygon, Polygon, BBox } from "geojson";

export type AdminLevel = "country" | "state" | "district";

/** Where a place's name is drawn. See `scripts/fetch-boundaries.ts`. */
export type LabelPoint = readonly [number, number];

export interface StateSummary {
  readonly id: string;
  /** LGD/Census state code, e.g. "27" for Maharashtra. */
  readonly code: string;
  readonly name: string;
  readonly slug: string;
  readonly bbox: BBox;
  readonly labelPoint: LabelPoint;
  /** Land area in square degrees; ranks labels when two collide. */
  readonly labelWeight: number;
  readonly districtCount: number;
}

export interface DistrictSummary {
  readonly id: string;
  readonly code: string;
  readonly stateCode: string;
  readonly name: string;
  readonly slug: string;
  readonly bbox: BBox;
  readonly labelPoint: LabelPoint;
  readonly labelWeight: number;
}

export type AreaFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

/** The generated manifest written by `scripts/fetch-boundaries.ts`. */
export interface BoundaryManifest {
  readonly generatedAt: string;
  /**
   * One entry per layer, because the layers do not share terms: state outlines
   * are ODbL and may be redistributed with attribution, districts come from an
   * extract that declares no licence at all.
   */
  readonly sources: {
    readonly states: {
      readonly name: string;
      readonly attribution: string;
      readonly licence: string;
      readonly retrievedFrom: string;
    };
    readonly districts: {
      readonly name: string;
      readonly repository: string;
      readonly commit: string;
      readonly licence: string;
    };
  };
  readonly note: string;
  readonly states: readonly {
    readonly code: string;
    readonly name: string;
    readonly slug: string;
    readonly bbox: BBox;
    /** Absent in manifests written before place labels existed. */
    readonly labelPoint?: LabelPoint;
    readonly labelWeight?: number;
    readonly districtCount: number;
  }[];
  readonly districts: Readonly<
    Record<
      string,
      readonly {
        readonly code: string;
        readonly name: string;
        readonly slug: string;
        readonly bbox: BBox;
        readonly labelPoint?: LabelPoint;
        readonly labelWeight?: number;
      }[]
    >
  >;
}

/** India, as the opening viewport. */
export const INDIA_BBOX: BBox = [68.1, 6.5, 97.4, 35.7];
