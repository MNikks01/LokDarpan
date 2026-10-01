import type pg from "pg";

import { AGENCY_DOCUMENT, AGENCY_PAGE } from "../net/limits";
import { putArtifact, type RawStore } from "../raw-store";
import { PathNotPermitted, type PoliteClient } from "./http";
import { heldDocumentUrls, recordArtifact, recordSighting } from "./load";
import {
  MHADA_SOURCE_ID,
  listingFactsOf,
  listingPageUrl,
  parseMhadaListing,
  type MhadaListingRow,
} from "./mhada";

/**
 * One MHADA collection: listing pages, then the notices they point to.
 *
 * Every listing page read is itself retained — it is the evidence for the
 * listing facts recorded against each notice. A notice already held is not
 * fetched again. On the nightly run (`stopWhenAllHeld`) collection stops at the
 * first page whose every notice is already held: MHADA lists newest first, so
 * everything after it is older and was collected before. A backfill passes an
 * explicit page range and reads it all.
 */

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

type Outcome = "fetched" | "notPermitted" | "failed";

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

interface Context {
  readonly client: PoliteClient;
  readonly db: pg.ClientBase;
  readonly store: RawStore;
}

async function retainListing(
  { client, db, store }: Context,
  page: number,
  dryRun: boolean,
): Promise<{ readonly listing: Listing; readonly rows: readonly MhadaListingRow[] }> {
  const fetched = await client.get(listingPageUrl(page), AGENCY_PAGE);
  if (fetched.status !== 200) {
    throw new Error(`MHADA listing page ${String(page)} answered HTTP ${String(fetched.status)}`);
  }
  // Parsed before anything is written: a page not understood records nothing.
  const { rows } = parseMhadaListing(fetched.body.toString("utf8"));
  if (dryRun) return { listing: { url: fetched.url, sha256: null }, rows };

  const artifact = await putArtifact(store, fetched.body, {
    sourceId: MHADA_SOURCE_ID,
    sourceUrl: fetched.url,
    retrievedAt: fetched.retrievedAt,
    httpStatus: fetched.status,
    contentType: fetched.contentType ?? "text/html",
  });
  await recordArtifact(db, artifact);
  return { listing: { url: fetched.url, sha256: artifact.sha256 }, rows };
}

async function retainNotice(
  { client, db, store }: Context,
  document: string,
  row: MhadaListingRow,
  listing: Listing,
): Promise<Outcome> {
  let fetched;
  try {
    fetched = await client.get(document, AGENCY_DOCUMENT);
  } catch (error: unknown) {
    return error instanceof PathNotPermitted ? "notPermitted" : "failed";
  }
  if (fetched.status !== 200) return "failed";

  const artifact = await putArtifact(store, fetched.body, {
    sourceId: MHADA_SOURCE_ID,
    sourceUrl: fetched.url,
    retrievedAt: fetched.retrievedAt,
    httpStatus: fetched.status,
    contentType: fetched.contentType,
  });
  await recordArtifact(db, artifact);
  await recordSighting(db, {
    sha256: artifact.sha256,
    sourceId: MHADA_SOURCE_ID,
    sourceUrl: document,
    discoveredFrom: listing.url,
    discoveredFromSha256: listing.sha256,
    listingFacts: listingFactsOf(row),
    seenAt: fetched.retrievedAt,
    httpStatus: fetched.status,
    etag: fetched.etag,
    lastModified: fetched.lastModified,
  });
  return "fetched";
}

export async function collectMhada(
  client: PoliteClient,
  db: pg.ClientBase,
  store: RawStore,
  options: CollectOptions,
): Promise<CollectCounts> {
  const context: Context = { client, db, store };
  const log = options.log ?? ((): void => undefined);
  const held = new Set(await heldDocumentUrls(db, MHADA_SOURCE_ID));
  const tally: Tally = {
    pages: 0,
    listed: 0,
    fetched: 0,
    alreadyHeld: 0,
    notPermitted: 0,
    failed: 0,
  };

  for (let page = options.fromPage; page <= options.toPage; page += 1) {
    const { listing, rows } = await retainListing(context, page, options.dryRun);
    tally.pages += 1;
    let newOnPage = 0;

    for (const row of rows) {
      for (const document of row.documents) {
        tally.listed += 1;
        if (held.has(document)) {
          tally.alreadyHeld += 1;
          continue;
        }
        newOnPage += 1;
        if (options.dryRun) {
          log(`would fetch ${document}`);
          continue;
        }
        const outcome = await retainNotice(context, document, row, listing);
        tally[outcome] += 1;
        if (outcome === "fetched") held.add(document);
        else log(`${outcome}: ${document}`);
      }
    }

    log(`page ${String(page)}: ${String(rows.length)} rows, ${String(newOnPage)} new notices`);
    if (options.stopWhenAllHeld && newOnPage === 0) break;
  }
  return tally;
}
