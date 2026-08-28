/**
 * Administrative geography: the hierarchy, and the boundaries we hold for it.
 *
 * Kept apart from `admin-unit.ts`, which models a unit's identity and
 * provenance in the ledger. This adds the geographic dimension — the boundary,
 * where one exists, and the source that published it.
 *
 * THE CENTRAL DISTINCTION
 * A unit always exists. A boundary often does not. `boundary: null` is the
 * normal case, not an error: the Local Government Directory names units it
 * publishes no polygon for, and inventing one to fill the gap would put a line
 * on a map that no source drew. Callers must render the absence.
 */
import type { AdminUnitLevel } from "./admin-unit";

/**
 * What kind of claim a boundary is.
 *
 * A line published by the government that defines it and a line traced by
 * volunteers are both useful and are not the same assertion. Rendering them
 * identically would overstate the second or understate the first, so the
 * distinction travels with the geometry to the reader.
 */
export type BoundarySourceKind = "official_government" | "open_dataset" | "derived";

export interface BoundaryProvenance {
  readonly kind: BoundarySourceKind;
  readonly sourceName: string;
  readonly sourceLicence: string;
  readonly sourceUrl: string | null;
  /** The identifier this boundary carries in its source, e.g. `relation/1991091`. */
  readonly sourceRef: string | null;
  /** The government body defining it. Present only for `official_government`. */
  readonly authority: string | null;
  readonly retrievedAt: string;
}

export interface GeoUnit {
  readonly id: number;
  readonly name: string;
  readonly level: AdminUnitLevel;
  /** Local Government Directory code, when a registry entry has been matched. */
  readonly lgdCode: string | null;
  readonly osmRelationId: number | null;
  readonly parentId: number | null;
  /** `null` when no boundary is held. The interface must say so. */
  readonly boundary: BoundaryProvenance | null;
  /** `[west, south, east, north]`, present only alongside a boundary. */
  readonly bbox: readonly [number, number, number, number] | null;
}

/**
 * How a level is named to a reader.
 *
 * The ledger's levels are registry terms. "urban_local_body" is what the
 * directory calls it; "Municipal body" is what a person reads.
 */
export const LEVEL_LABEL: Readonly<Record<AdminUnitLevel, string>> = {
  country: "Country",
  state: "State",
  district: "District",
  sub_district: "Taluka",
  block: "Block",
  village: "Village",
  urban_local_body: "Municipal body",
  ward: "Ward",
  gram_panchayat: "Gram Panchayat",
};

/**
 * The order levels nest in, for building a drill-down without hard-coding a
 * fixed sequence. A district may contain talukas, municipal bodies and villages
 * at once — which is why callers ask for children and read their levels, rather
 * than assuming what comes next.
 */
export const LEVEL_DEPTH: Readonly<Record<AdminUnitLevel, number>> = {
  country: 0,
  state: 1,
  district: 2,
  sub_district: 3,
  block: 4,
  urban_local_body: 4,
  gram_panchayat: 5,
  village: 5,
  ward: 6,
};

/** Boundaries as GeoJSON, with each feature carrying its own provenance. */
export interface BoundaryFeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: readonly {
    readonly type: "Feature";
    readonly id: number;
    readonly properties: {
      readonly unitId: number;
      readonly name: string;
      readonly level: AdminUnitLevel;
      readonly sourceKind: BoundarySourceKind;
      readonly sourceName: string;
    };
    readonly geometry: unknown;
  }[];
}

/** The port. Callers depend on this, never on a database driver. */
export interface GeographyRepository {
  /** Units directly inside a parent, whatever levels those turn out to be. */
  childrenOf(parentId: number): Promise<readonly GeoUnit[]>;
  unitById(id: number): Promise<GeoUnit | null>;
  /** The chain from country down to this unit, for a breadcrumb. */
  ancestorsOf(id: number): Promise<readonly GeoUnit[]>;
  /** Boundary geometry for a parent's children, for drawing one level. */
  boundariesOfChildren(parentId: number): Promise<BoundaryFeatureCollection>;
  /** Units whose boundary intersects a viewport, for viewport-scoped loading. */
  unitsIntersecting(
    bbox: readonly [number, number, number, number],
    levels: readonly AdminUnitLevel[],
    limit: number,
  ): Promise<readonly GeoUnit[]>;
}

/**
 * What a search can return.
 *
 * Deliberately a union rather than a list of places. A reader typing "Nagpur"
 * may mean the district, the municipal body, or the audit report named after
 * the CAG office there — and the interface should offer all three rather than
 * guess. Each result says what kind of thing it is, so choosing one is an
 * informed choice.
 */
export type SearchResultKind = "place" | "record";

export interface SearchResult {
  readonly kind: SearchResultKind;
  readonly id: number;
  readonly title: string;
  /** What this is, in the reader's terms: "District", "Audit report". */
  readonly subtitle: string;
  /** Where the result sits, for a place: "Maharashtra". Null when unknown. */
  readonly context: string | null;
  /** The LGD state code to select alongside, for a place inside one. */
  readonly stateCode: string | null;
  /** True when a place has a boundary and can therefore be framed on the map. */
  readonly hasBoundary: boolean;
}

export interface SearchRepository {
  search(term: string, limit: number): Promise<readonly SearchResult[]>;
}
