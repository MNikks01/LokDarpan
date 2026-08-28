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

export type AdminLevel = "country" | "state" | "district" | "local_body";

/**
 * India's local government is not "cities". A municipal corporation, a nagar
 * panchayat and a gram panchayat differ in powers, budget and in which register
 * publishes their works — so the type is carried on the record rather than
 * being flattened into a single label.
 */
export type LocalBodyType =
  | "municipal_corporation"
  | "municipal_council"
  | "nagar_panchayat"
  | "cantonment_board"
  | "gram_panchayat"
  | "zilla_parishad";

export const LOCAL_BODY_TYPE_LABEL: Readonly<Record<LocalBodyType, string>> = {
  municipal_corporation: "Municipal Corporation",
  municipal_council: "Municipal Council",
  nagar_panchayat: "Nagar Panchayat",
  cantonment_board: "Cantonment Board",
  gram_panchayat: "Gram Panchayat",
  zilla_parishad: "Zilla Parishad",
};

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

export interface LocalBody {
  readonly id: string;
  readonly districtId: string;
  readonly stateCode: string;
  readonly name: string;
  readonly slug: string;
  readonly type: LocalBodyType;
  /**
   * Where the map should sit when this body is selected. A bounding box is not
   * a boundary: `boundaryAvailable` says whether an actual polygon exists, and
   * the map must not draw an outline that no register published.
   */
  readonly focusBbox: BBox;
  readonly boundaryAvailable: boolean;
  /** Named so a missing boundary can say which register would carry it. */
  readonly boundarySource: string;
}

export type AreaFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

/** The generated manifest written by `scripts/fetch-boundaries.ts`. */
export interface BoundaryManifest {
  readonly generatedAt: string;
  readonly source: {
    readonly name: string;
    readonly repository: string;
    readonly commit: string;
    readonly licence: string;
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
