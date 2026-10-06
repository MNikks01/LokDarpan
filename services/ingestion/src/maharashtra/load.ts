import type pg from "pg";

import type { RawArtifact } from "../raw-store";

/**
 * Writes for the Maharashtra agency collectors: the artefact, and each time it
 * was seen.
 *
 * An artefact row is written once per content hash and never changed
 * (`source_artifact`). A sighting is appended every time a collector fetches
 * an artefact, and says what pointed it there
 * (`database/migrations/0040_an_artifact_remembers_how_it_was_found.sql`).
 */

export async function recordArtifact(db: pg.ClientBase, artifact: RawArtifact): Promise<void> {
  await db.query(
    `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, http_status,
                                  content_type, byte_size, storage_path, stored_in)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (sha256) DO NOTHING`,
    [
      artifact.sha256,
      artifact.sourceId,
      artifact.sourceUrl,
      artifact.retrievedAt,
      artifact.httpStatus,
      artifact.contentType,
      artifact.byteSize,
      artifact.storagePath,
      artifact.storedIn,
    ],
  );
}

/** What a listing row says, as printed: text, or a flag the reader raised about it. */
export type ListingFacts = Readonly<Record<string, string | boolean | null>>;

export interface Sighting {
  readonly sha256: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly discoveredFrom: string | null;
  readonly discoveredFromSha256: string | null;
  /** What the listing row said, as printed. Requires `discoveredFromSha256`. */
  readonly listingFacts: ListingFacts | null;
  readonly seenAt: Date;
  readonly httpStatus: number;
  readonly etag: string | null;
  readonly lastModified: string | null;
}

export async function recordSighting(db: pg.ClientBase, sighting: Sighting): Promise<void> {
  await db.query(
    `INSERT INTO artifact_sighting (sha256, source_id, source_url, discovered_from,
                                    discovered_from_sha256, listing_facts, seen_at,
                                    http_status, http_etag, http_last_modified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      sighting.sha256,
      sighting.sourceId,
      sighting.sourceUrl,
      sighting.discoveredFrom,
      sighting.discoveredFromSha256,
      sighting.listingFacts === null ? null : JSON.stringify(sighting.listingFacts),
      sighting.seenAt,
      sighting.httpStatus,
      sighting.etag,
      sighting.lastModified,
    ],
  );
}

/**
 * Document URLs this source has already fetched successfully.
 *
 * A notice PDF, once held, is not fetched again on the nightly run: its bytes
 * are in the raw store under their hash. A file replaced at the same URL would
 * be caught by a deliberate re-check, not by fetching every file every night.
 */
export async function heldDocumentUrls(
  db: pg.ClientBase,
  sourceId: string,
): Promise<ReadonlySet<string>> {
  const result = await db.query<{ source_url: string }>(
    `SELECT DISTINCT source_url FROM artifact_sighting
      WHERE source_id = $1 AND discovered_from IS NOT NULL AND http_status = 200`,
    [sourceId],
  );
  return new Set(result.rows.map((row) => row.source_url));
}
