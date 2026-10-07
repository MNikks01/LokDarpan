/**
 * A government or department, as the reviewed record names it (ADR-074).
 *
 * A body is shown only while at least one reviewed mention confirms it. A
 * mention says a page of a published report names the body; it does not say
 * the page's figures are about that body, and no view built from these types
 * may present them so.
 */

export type PublicBodyKind = "government" | "department";

/** A body named elsewhere on this view, with where to find it. */
export interface PublicBodyRef {
  readonly id: number;
  readonly kind: PublicBodyKind;
  readonly name: string;
  /** Reports whose reviewed pages name it. */
  readonly reportCount: number;
}

/** One reviewed page that names the body. */
export interface BodyMention {
  readonly factId: number;
  readonly pageNumber: number;
  /** The sentence as published, so a reader sees the name in its context. */
  readonly rawText: string;
}

/** A report that names the body, and the reviewed pages where it does. */
export interface BodyMentionsInReport {
  readonly documentId: number;
  readonly title: string;
  readonly issuingAuthority: string;
  /** As the report states it. `null` when it states none. */
  readonly publishedOn: string | null;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly mentions: readonly BodyMention[];
}

export interface PublicBodyView {
  readonly id: number;
  readonly kind: PublicBodyKind;
  readonly name: string;
  /** The territory the body governs. */
  readonly jurisdiction: { readonly unitId: number; readonly name: string };
  /** The government a department belongs to, when that government is itself shown. */
  readonly parent: PublicBodyRef | null;
  /** For a government: its departments that are shown. Empty for a department. */
  readonly departments: readonly PublicBodyRef[];
  readonly reports: readonly BodyMentionsInReport[];
  /** The newest version any row on this view was written under (ADR-053). */
  readonly datasetVersion: number;
}

export interface PublicBodyRepository {
  /** The view, or `null` when no reviewed mention confirms the body. */
  body(id: number): Promise<PublicBodyView | null>;
  /** Shown bodies whose jurisdiction is this unit: governments first, then departments. */
  bodiesOf(unitId: number): Promise<readonly PublicBodyRef[]>;
}
