import type pg from "pg";

import { extractDocument } from "../cag/extract";
import { loadDocument } from "../cag/load";
import { openDatasetVersion, sealDatasetVersion } from "../lgd/load";
import type { ReadableRawStore } from "../raw-store";
import type { ListingFacts } from "./load";

/**
 * Held agency notices, made into documents.
 *
 * A notice PDF retained by `collectListing` is evidence in the raw store; this
 * turns it into a `document` with its pages, through the same extractor and
 * loader the CAG reports use, so a notice's page text, script and
 * glyph-substitution score are recorded exactly as an audit report's are.
 * Facts are read from the pages later (MHA-TENDER-008); nothing here
 * interprets the text.
 *
 * The bytes are read back from the raw store, not fetched again: the store is
 * what makes re-extraction with a better parser possible (ADR-069).
 *
 * A scanned notice — every MHADA notice collected on 2026-10-01 was one — is
 * loaded with every page counted in `pages_without_text`. That is the true
 * state of the document until OCR reads it, and it is reported as such.
 */

export interface NoticeMeta {
  readonly title: string;
  readonly issuingAuthority: string;
  /** As the listing printed it, read into ISO form; null when it could not be. */
  readonly publishedOn: string | null;
}

/** What turns an agency's listing facts into a document's metadata. */
export interface NoticeDescription {
  readonly sourceId: string;
  noticeMetaOf(facts: ListingFacts): NoticeMeta;
}

export interface ExtractCounts {
  documents: number;
  /** Documents with at least one page that has text. */
  withText: number;
  /** Documents with no text on any page: scans awaiting OCR. */
  scanned: number;
  /** Artefacts that would not extract, left without a document. */
  failed: number;
  /** Artefacts held in a store other than the one given; not read. */
  elsewhere: number;
}

interface Pending {
  readonly sha256: string;
  readonly storage_path: string;
  readonly stored_in: string | null;
  readonly content_type: string | null;
  readonly listing_facts: ListingFacts;
}

/** Listing text, or null when the listing gave none. */
export function factText(facts: ListingFacts, key: string): string | null {
  const value = facts[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Retained PDFs of a source with no document yet, each with the first listing row that pointed to it. */
async function pendingNotices(db: pg.ClientBase, sourceId: string): Promise<readonly Pending[]> {
  const result = await db.query<Pending>(
    `SELECT a.sha256, a.storage_path, a.stored_in, a.content_type, first.listing_facts
       FROM source_artifact a
       JOIN LATERAL (
         SELECT s.listing_facts FROM artifact_sighting s
          WHERE s.sha256 = a.sha256 AND s.listing_facts IS NOT NULL
          ORDER BY s.id LIMIT 1
       ) first ON true
       LEFT JOIN document d ON d.source_sha256 = a.sha256
      WHERE a.source_id = $1
        AND d.id IS NULL
        AND a.content_type ILIKE 'application/pdf%'
      ORDER BY a.retrieved_at, a.sha256`,
    [sourceId],
  );
  return result.rows;
}

async function extractOne(
  description: NoticeDescription,
  context: {
    readonly db: pg.ClientBase;
    readonly store: ReadableRawStore;
    readonly version: number;
  },
  notice: Pending,
): Promise<"withText" | "scanned"> {
  const bytes = await context.store.get(notice.storage_path, notice.sha256);
  const extracted = await extractDocument(bytes);
  await loadDocument(context.db, {
    artifact: { sha256: notice.sha256, contentType: notice.content_type ?? "application/pdf" },
    extracted,
    meta: {
      docType: "tender_notice",
      adminUnitId: null,
      ...description.noticeMetaOf(notice.listing_facts),
    },
    datasetVersionId: context.version,
  });
  return extracted.pagesWithoutText === extracted.pageCount ? "scanned" : "withText";
}

export async function extractNotices(
  description: NoticeDescription,
  db: pg.ClientBase,
  store: ReadableRawStore,
  log: (line: string) => void = (): void => undefined,
): Promise<ExtractCounts> {
  const pending = await pendingNotices(db, description.sourceId);
  const counts: ExtractCounts = { documents: 0, withText: 0, scanned: 0, failed: 0, elsewhere: 0 };
  if (pending.length === 0) return counts;

  const version = await openDatasetVersion(
    db,
    `${description.sourceId} notices extracted ${new Date().toISOString()}`,
  );
  for (const notice of pending) {
    if (notice.stored_in !== store.location) {
      counts.elsewhere += 1;
      continue;
    }
    try {
      const kind = await extractOne(description, { db, store, version }, notice);
      counts.documents += 1;
      counts[kind] += 1;
    } catch (error: unknown) {
      counts.failed += 1;
      const why = error instanceof Error ? error.message : String(error);
      log(`not extracted ${notice.sha256.slice(0, 12)}: ${why}`);
    }
  }
  await sealDatasetVersion(db, version);
  return counts;
}
