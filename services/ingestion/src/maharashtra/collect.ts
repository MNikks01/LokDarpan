import type pg from "pg";

import { AGENCY_DOCUMENT, AGENCY_PAGE } from "../net/limits";
import { putArtifact, type RawStore } from "../raw-store";
import { PathNotPermitted, type PoliteClient } from "./http";
import { heldDocumentUrls, recordArtifact, recordSighting, type ListingFacts } from "./load";

/**
 * One collection from an agency's tender listing: listing pages, then the
 * notices they point to.
 *
 * An agency is described by an `AgencyListing` — where its pages are, how to
 * read one, and what each row points to — so MHADA, MSIDC and the agencies
 * after them share one collector rather than each growing its own.
 *
 * Every listing page read is itself retained: it is the evidence for the
 * listing facts recorded against each notice. A notice already held is not
 * fetched again. With `stopWhenAllHeld`, collection stops at the first page
 * whose every notice is already held — listings run newest first, so
 * everything after it was collected before. A backfill passes an explicit page
 * range and reads it all.
 */

export interface AgencyListing<Row> {
  /** Registry id, also the raw store's prefix and `ingestion_run.source_id`. */
  readonly sourceId: string;
  /** The last listing page; 0 for a single-page listing. */
  readonly lastPage: number;
  pageUrl(page: number): string;
  /** Throws if the page is not the listing it expects: never "no notices". */
  parse(html: string): readonly Row[];
  documentsOf(row: Row): readonly string[];
  /** What the row says, as printed, for `artifact_sighting.listing_facts`. */
  factsOf(row: Row): ListingFacts;
}

export interface CollectOptions {
  readonly fromPage: number;
  readonly toPage: number;
  /** Stop at the first page on which every notice is already held. */
  readonly stopWhenAllHeld: boolean;
  /** Read listings and report, but fetch no notice and write nothing. */
  readonly dryRun: boolean;
  readonly log?: (line: string) => void;
}

export interface CollectCounts {
  readonly pages: number;
  /** Notice documents the listing pages pointed to. */
  readonly listed: number;
  /** Notices fetched and retained this run. */
  readonly fetched: number;
  /** Notices already held, not fetched again. */
  readonly alreadyHeld: number;
  /** Notices whose path the host's robots.txt refuses. */
  readonly notPermitted: number;
  /** Notices that answered with anything but 200, or failed to arrive. */
  readonly failed: number;
}

/** Why a notice was not retained. */
type Outcome = "notPermitted" | "failed";

/** A notice fetched this run: enough to record another row's sighting of it. */
interface Retained {
  readonly sha256: string;
  readonly url: string;
  readonly retrievedAt: Date;
  readonly status: number;
  readonly etag: string | null;
  readonly lastModified: string | null;
}

interface Tally {
  pages: number;
  listed: number;
  fetched: number;
  alreadyHeld: number;
  notPermitted: number;
  failed: number;
}

interface Listing {
  readonly url: string;
  readonly sha256: string | null;
}

/** What a collection runs against. */
export interface Collector {
  readonly client: PoliteClient;
  readonly db: pg.ClientBase;
  readonly store: RawStore;
}

interface Context<Row> extends Collector {
  readonly agency: AgencyListing<Row>;
}

async function retainListing<Row>(
  { agency, client, db, store }: Context<Row>,
  page: number,
  dryRun: boolean,
): Promise<{ readonly listing: Listing; readonly rows: readonly Row[] }> {
  const fetched = await client.get(agency.pageUrl(page), AGENCY_PAGE);
  if (fetched.status !== 200) {
    throw new Error(
      `${agency.sourceId} listing page ${String(page)} answered HTTP ${String(fetched.status)}`,
    );
  }
  // Parsed before anything is written: a page not understood records nothing.
  const rows = agency.parse(fetched.body.toString("utf8"));
  if (dryRun) return { listing: { url: fetched.url, sha256: null }, rows };

  const artifact = await putArtifact(store, fetched.body, {
    sourceId: agency.sourceId,
    sourceUrl: fetched.url,
    retrievedAt: fetched.retrievedAt,
    httpStatus: fetched.status,
    contentType: fetched.contentType ?? "text/html",
  });
  await recordArtifact(db, artifact);
  return { listing: { url: fetched.url, sha256: artifact.sha256 }, rows };
}

async function retainNotice<Row>(
  context: Context<Row>,
  document: string,
  row: Row,
  listing: Listing,
): Promise<Outcome | Retained> {
  const { agency, client, db, store } = context;
  let fetched;
  try {
    fetched = await client.get(document, AGENCY_DOCUMENT);
  } catch (error: unknown) {
    return error instanceof PathNotPermitted ? "notPermitted" : "failed";
  }
  if (fetched.status !== 200) return "failed";

  const artifact = await putArtifact(store, fetched.body, {
    sourceId: agency.sourceId,
    sourceUrl: fetched.url,
    retrievedAt: fetched.retrievedAt,
    httpStatus: fetched.status,
    contentType: fetched.contentType,
  });
  await recordArtifact(db, artifact);
  const retained: Retained = {
    sha256: artifact.sha256,
    url: document,
    retrievedAt: fetched.retrievedAt,
    status: fetched.status,
    etag: fetched.etag,
    lastModified: fetched.lastModified,
  };
  await recordRowSighting(context, retained, row, listing);
  return retained;
}

/**
 * One row's sighting of a notice. Called again, without refetching, when a
 * later row on the same run points to the same file — MSIDC lists each package
 * of a multi-package notice as its own row, sharing one PDF, and each row's
 * name of work is worth keeping.
 */
async function recordRowSighting<Row>(
  { agency, db }: Context<Row>,
  retained: Retained,
  row: Row,
  listing: Listing,
): Promise<void> {
  await recordSighting(db, {
    sha256: retained.sha256,
    sourceId: agency.sourceId,
    sourceUrl: retained.url,
    discoveredFrom: listing.url,
    discoveredFromSha256: listing.sha256,
    listingFacts: agency.factsOf(row),
    seenAt: retained.retrievedAt,
    httpStatus: retained.status,
    etag: retained.etag,
    lastModified: retained.lastModified,
  });
}

export async function collectListing<Row>(
  agency: AgencyListing<Row>,
  collector: Collector,
  options: CollectOptions,
): Promise<CollectCounts> {
  const context: Context<Row> = { agency, ...collector };
  const { db } = collector;
  const log = options.log ?? ((): void => undefined);
  const held = new Set(await heldDocumentUrls(db, agency.sourceId));
  const fetchedThisRun = new Map<string, Retained>();
  const tally: Tally = {
    pages: 0,
    listed: 0,
    fetched: 0,
    alreadyHeld: 0,
    notPermitted: 0,
    failed: 0,
  };
  const lastPage = Math.min(options.toPage, agency.lastPage);

  for (let page = options.fromPage; page <= lastPage; page += 1) {
    const { listing, rows } = await retainListing(context, page, options.dryRun);
    tally.pages += 1;
    let newOnPage = 0;

    for (const row of rows) {
      for (const document of agency.documentsOf(row)) {
        tally.listed += 1;
        const thisRun = fetchedThisRun.get(document);
        if (thisRun !== undefined) {
          // Another row of this run pointed to the same file: keep its facts too.
          await recordRowSighting(context, thisRun, row, listing);
          tally.alreadyHeld += 1;
          continue;
        }
        if (held.has(document)) {
          tally.alreadyHeld += 1;
          continue;
        }
        newOnPage += 1;
        if (options.dryRun) {
          // Counted as a real run would: a later row sharing this file is not new.
          held.add(document);
          log(`would fetch ${document}`);
          continue;
        }
        const outcome = await retainNotice(context, document, row, listing);
        if (typeof outcome === "string") {
          tally[outcome] += 1;
          log(`${outcome}: ${document}`);
        } else {
          tally.fetched += 1;
          held.add(document);
          fetchedThisRun.set(document, outcome);
        }
      }
    }

    log(`page ${String(page)}: ${String(rows.length)} rows, ${String(newOnPage)} new notices`);
    if (options.stopWhenAllHeld && newOnPage === 0) break;
  }
  return tally;
}
