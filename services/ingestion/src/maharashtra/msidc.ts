import { parse as parseHtml, type HTMLElement } from "node-html-parser";

import type { AgencyListing } from "./collect";
import type { ListingFacts } from "./load";

/**
 * MSIDC's tender listing, read as MSIDC prints it.
 *
 * `https://msidc.org/tenders/` — "E-Tenders for Maharashtra PWD Projects": one
 * WordPress TablePress table of 290 notices, 26 February 2024 to 6 July 2026,
 * on a single page (`.docs/06-government-sources/maharashtra-tenders/maharashtra-tender-data.md` §12).
 *
 * TablePress cells carry only positional classes, so the header row is checked
 * word for word before any row is read: a column moved on MSIDC's side fails
 * loudly instead of putting deadlines where publication dates belong.
 *
 * MSIDC's own table has errors — row 289 is published 01-Mar-2024 with a
 * deadline of 08-Mar-2023. Nothing is corrected here. Both dates are kept as
 * printed, and the disagreement is flagged (`deadline_before_publication`) for
 * the notice PDF to settle; the PDF is the authority.
 */

export const MSIDC_SOURCE_ID = "mh-msidc-tenders";
export const MSIDC_LISTING = "https://msidc.org/tenders/";

const EXPECTED_HEADERS = [
  "sr. no",
  "publication date",
  "last date/ time of submission",
  "name of work",
  "tender notice",
];

const MONTH_NAMES = [
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

export interface MsidcListingRow {
  readonly serial: string;
  /** As printed: "6 July-2026 at 12:00 PM", "20-Jun-2024 at 3.00 PM". */
  readonly published: string;
  readonly publishedOn: string | null;
  readonly deadline: string;
  readonly deadlineOn: string | null;
  readonly nameOfWork: string;
  readonly documents: readonly string[];
  /** True when both dates were read and the deadline precedes publication. */
  readonly deadlineBeforePublication: boolean | null;
}

export class MsidcListingNotUnderstood extends Error {
  constructor(reason: string) {
    super(`MSIDC listing not understood: ${reason}. Nothing was recorded from this page.`);
    this.name = "MsidcListingNotUnderstood";
  }
}

/** A month named in full, or by its first three letters (and "Sept"). */
function monthOf(name: string): number | null {
  const lower = name.toLowerCase();
  const full = MONTH_NAMES.indexOf(lower);
  if (full >= 0) return full + 1;
  if (lower === "sept") return 9;
  if (lower.length !== 3) return null;
  const short = MONTH_NAMES.findIndex((m) => m.startsWith(lower));
  return short >= 0 ? short + 1 : null;
}

/**
 * The date at the start of an MSIDC date cell, when its month is named.
 *
 * "6 July-2026 at 12:00 PM" and "20-Jun-2024 at 3.00 PM" → ISO dates. A date
 * written in digits alone ("08-03-2023") could be day-first or month-first and
 * is left unread. The time is not read: the notice states it.
 */
export function leadingDateOf(printed: string): string | null {
  const match = /^(\d{1,2})[\s-]+([A-Za-z]+)[\s-]+(\d{4})\b/u.exec(printed.trim());
  if (match === null) return null;
  const [, day = "", monthName = "", year = ""] = match;
  const month = monthOf(monthName);
  if (month === null) return null;
  const d = Number(day);
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return date.getUTCMonth() + 1 === month && date.getUTCDate() === d ? iso : null;
}

const textOf = (cell: HTMLElement | undefined): string =>
  cell === undefined ? "" : cell.textContent.replace(/\s+/gu, " ").trim();

/** Absolute http(s) links to PDFs; a malformed href such as `<u>https://…</u>` is not a link. */
function documentsOf(cell: HTMLElement | undefined): readonly string[] {
  if (cell === undefined) return [];
  const hrefs = cell
    .querySelectorAll("a[href]")
    .map((a) => (a.getAttribute("href") ?? "").trim())
    .filter((href) => /^https?:\/\/[^\s<>"]+\.pdf(?:\?[^\s<>"]*)?$/iu.test(href));
  return [...new Set(hrefs)];
}

function rowOf(tr: HTMLElement): MsidcListingRow {
  const cells = tr.querySelectorAll("td");
  const published = textOf(cells[1]);
  const deadline = textOf(cells[2]);
  const publishedOn = leadingDateOf(published);
  const deadlineOn = leadingDateOf(deadline);
  return {
    serial: textOf(cells[0]),
    published,
    publishedOn,
    deadline,
    deadlineOn,
    nameOfWork: textOf(cells[3]),
    documents: documentsOf(cells[4]),
    deadlineBeforePublication:
      publishedOn === null || deadlineOn === null ? null : deadlineOn < publishedOn,
  };
}

/** Read the listing. Throws if it is not the table MSIDC served on 2026-09-30. */
export function parseMsidcListing(html: string): readonly MsidcListingRow[] {
  const root = parseHtml(html, { comment: false });
  const table = root.querySelector("table.tablepress");
  if (table === null) throw new MsidcListingNotUnderstood("no tablepress table");
  const headers = table.querySelectorAll("th").map((th) => textOf(th).toLowerCase());
  if (headers.slice(0, EXPECTED_HEADERS.length).join("|") !== EXPECTED_HEADERS.join("|")) {
    throw new MsidcListingNotUnderstood(`unexpected columns: ${headers.join(" | ")}`);
  }
  const rows = table
    .querySelectorAll("tr")
    .filter((tr) => tr.querySelectorAll("td").length >= EXPECTED_HEADERS.length)
    .map(rowOf);
  if (rows.length === 0) throw new MsidcListingNotUnderstood("a listing table with no rows");
  return rows;
}

export function msidcFactsOf(row: MsidcListingRow): ListingFacts {
  return {
    serial: row.serial,
    published: row.published,
    published_on: row.publishedOn,
    deadline: row.deadline,
    deadline_on: row.deadlineOn,
    name_of_work: row.nameOfWork,
    deadline_before_publication: row.deadlineBeforePublication,
  };
}

/** MSIDC's listing, as the shared collector reads it: one page. */
export const MSIDC: AgencyListing<MsidcListingRow> = {
  sourceId: MSIDC_SOURCE_ID,
  lastPage: 0,
  pageUrl: () => MSIDC_LISTING,
  parse: parseMsidcListing,
  documentsOf: (row) => row.documents,
  factsOf: msidcFactsOf,
};
