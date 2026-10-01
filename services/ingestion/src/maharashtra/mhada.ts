import { parse as parseHtml, type HTMLElement } from "node-html-parser";

import type { AgencyListing } from "./collect";

/**
 * MHADA's tender listing, read as MHADA prints it.
 *
 * `https://www.mhada.gov.in/mr/tenders` — a Drupal view, ten notices a page,
 * pages 0 to 454 on 2026-09-30, back to 25 July 2016
 * (`.docs/06-government-sources/maharashtra-tenders/maharashtra-tender-data.md` §14).
 *
 * A row is a **Tier-2** record: MHADA's own summary of a notice. Every field is
 * kept exactly as printed, and the notice PDF it links to is the evidence. The
 * only normalisation here is a date read into ISO form when — and only when —
 * it is written unambiguously as "30 September 2026"; anything else is left as
 * printed with no ISO date, never guessed.
 *
 * Cells are found by their Drupal field class, not by column position, so a
 * column added or reordered on MHADA's side fails loudly (a missing field)
 * rather than silently shifting every value into the wrong place.
 */

export const MHADA_SOURCE_ID = "mh-mhada-tenders";
export const MHADA_ORIGIN = "https://www.mhada.gov.in";
export const MHADA_LISTING = `${MHADA_ORIGIN}/mr/tenders`;

/** The last listing page on 2026-09-30; the nightly run stops long before it. */
export const LAST_PAGE_SEEN = 454;

export const listingPageUrl = (page: number): string =>
  page === 0 ? MHADA_LISTING : `${MHADA_LISTING}?page=${String(page)}`;

export interface MhadaListingRow {
  /** MHADA's running row number, as printed. */
  readonly serial: string;
  /** E-publication date as printed ("30 September 2026"). */
  readonly published: string;
  /** The same date as `YYYY-MM-DD`, or null if it is not written unambiguously. */
  readonly publishedOn: string | null;
  /** The notice's title, carrying MHADA's running notice number ("ई निविदा सूचना क्र. ३७३९"). */
  readonly title: string;
  /** Reference or tender number as printed; empty when MHADA gives none. */
  readonly reference: string;
  readonly board: string;
  /** MHADA's description of the document. */
  readonly description: string;
  readonly closing: string;
  readonly closingOn: string | null;
  /** Absolute URLs of the documents the row links to, in page order. */
  readonly documents: readonly string[];
}

export interface MhadaListingPage {
  readonly rows: readonly MhadaListingRow[];
  /** The highest page number the pager links to, or null if there is no pager. */
  readonly lastPage: number | null;
}

export class ListingNotUnderstood extends Error {
  constructor(reason: string) {
    super(`MHADA listing not understood: ${reason}. Nothing was recorded from this page.`);
    this.name = "ListingNotUnderstood";
  }
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "30 September 2026" → "2026-09-30"; anything else → null. */
export function isoDateOf(printed: string): string | null {
  const match = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/u.exec(printed.trim());
  if (match === null) return null;
  const [, day = "", monthName = "", year = ""] = match;
  const month = MONTHS.indexOf(monthName.toLowerCase()) + 1;
  const d = Number(day);
  if (month === 0) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  // Reject a day the month does not have (31 September) rather than roll it over.
  const date = new Date(`${iso}T00:00:00Z`);
  return date.getUTCMonth() + 1 === month && date.getUTCDate() === d ? iso : null;
}

/** A cell's visible text, whitespace collapsed; Drupal's theme-debug comments are not text. */
function textOf(cell: HTMLElement | null): string {
  if (cell === null) return "";
  return cell.textContent.replace(/\s+/gu, " ").trim();
}

function fieldCell(row: HTMLElement, field: string): HTMLElement | null {
  return row.querySelector(`td.views-field-${field}`);
}

const REQUIRED_COLUMNS = [
  "field-tender-date-1",
  "title-1",
  "field-tender-ref-no-1",
  "field-board-1",
  "field-tender-end-date-1",
];

function documentsOf(row: HTMLElement): readonly string[] {
  const hrefs = row
    .querySelectorAll("a[href]")
    .map((a) => a.getAttribute("href") ?? "")
    .filter((href) => /\.pdf(?:$|\?)/iu.test(href))
    .map((href) => new URL(href, MHADA_ORIGIN).href);
  return [...new Set(hrefs)];
}

function rowOf(tr: HTMLElement): MhadaListingRow {
  const published = textOf(fieldCell(tr, "field-tender-date-1"));
  const closing = textOf(fieldCell(tr, "field-tender-end-date-1"));
  return {
    serial: textOf(fieldCell(tr, "counter-1")),
    published,
    publishedOn: isoDateOf(published),
    title: textOf(fieldCell(tr, "title-1")),
    reference: textOf(fieldCell(tr, "field-tender-ref-no-1")),
    board: textOf(fieldCell(tr, "field-board-1")),
    description: textOf(fieldCell(tr, "field-tender-document-2")),
    closing,
    closingOn: isoDateOf(closing),
    documents: documentsOf(tr),
  };
}

/** Read one listing page. Throws if the page is not the listing MHADA served on 2026-09-30. */
export function parseMhadaListing(html: string): MhadaListingPage {
  const root = parseHtml(html, { comment: false });
  const table = root.querySelector("table.views-table");
  if (table === null) throw new ListingNotUnderstood("no views-table");
  for (const field of REQUIRED_COLUMNS) {
    if (table.querySelector(`th.views-field-${field}`) === null) {
      throw new ListingNotUnderstood(`no ${field} column`);
    }
  }

  const rows = table.querySelectorAll("tbody tr").map(rowOf);
  if (rows.length === 0) throw new ListingNotUnderstood("a listing table with no rows");

  const pages = root
    .querySelectorAll("a[href]")
    .map((a) => /[?&]page=(\d+)/u.exec(a.getAttribute("href") ?? "")?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  return { rows, lastPage: pages.length === 0 ? null : Math.max(...pages) };
}

/**
 * What a listing row says, for `artifact_sighting.listing_facts`.
 *
 * As printed, plus the ISO dates where they could be read. The notice PDF is
 * still the authority; this is what pointed us to it.
 */
export function listingFactsOf(row: MhadaListingRow): Record<string, string | null> {
  return {
    serial: row.serial,
    published: row.published,
    published_on: row.publishedOn,
    title: row.title,
    reference: row.reference === "" ? null : row.reference,
    board: row.board,
    description: row.description,
    closing: row.closing,
    closing_on: row.closingOn,
  };
}

/** MHADA's listing, as the shared collector reads it. */
export const MHADA: AgencyListing<MhadaListingRow> = {
  sourceId: MHADA_SOURCE_ID,
  lastPage: LAST_PAGE_SEEN,
  pageUrl: listingPageUrl,
  parse: (html) => parseMhadaListing(html).rows,
  documentsOf: (row) => row.documents,
  factsOf: listingFactsOf,
};
