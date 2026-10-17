import type { AdminUnitLevel } from "./admin-unit";

/**
 * Where the audit reports name a place (ADR-077).
 *
 * A mention says a page of a published report names the district or taluka.
 * It does not say the page's figures were spent there or are about that place,
 * and no view built from these types may present them so.
 */

/** A place a reviewed page names, with where to draw it. */
export interface NamedPlace {
  readonly unitId: number;
  readonly name: string;
  readonly level: AdminUnitLevel;
  /** The point a pin is drawn at: the centre of the place's own boundary, as [lon, lat]. */
  readonly point: readonly [number, number];
  /** Reviewed pages that name it. */
  readonly pages: number;
  /** Reports those pages belong to. */
  readonly reports: number;
}

/** One reviewed page that names the place. */
export interface PlaceMentionPage {
  readonly pageNumber: number;
  /** The sentence as published, so a reader sees the name in its context. */
  readonly excerpt: string;
}

/** A report that names the place, and the reviewed pages where it does. */
export interface PlaceMentionsInReport {
  readonly documentId: number;
  readonly title: string;
  readonly issuingAuthority: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly pages: readonly PlaceMentionPage[];
}

export interface PlaceMentionRepository {
  /** Places named on reviewed pages, at or anywhere inside the unit. */
  namedWithin(unitId: number): Promise<readonly NamedPlace[]>;
  /** The reports and pages that name this unit itself, in report and page order. */
  mentionsOf(unitId: number): Promise<readonly PlaceMentionsInReport[]>;
}
