/**
 * The GePNIC landing page, as this ledger will accept it.
 *
 * Pure: no network, no database. Everything here is parsing and validation of
 * markup we did not write, which `.docs/12-security` requires be treated as
 * untrusted.
 *
 * WHAT THIS PAGE IS
 * `/nicgep/app` is the only surface on a GePNIC deployment that serves tender
 * rows without an interactive check. It publishes four fields — title,
 * reference, closing date, bid opening date — for roughly twenty currently
 * advertised tenders. No value, no organisation, no award. It cannot be paged
 * backwards, so collection is forward-only and can never backfill.
 *
 * A ROW COUNT IS NOT EVIDENCE OF DATA
 * `.docs/06-government-sources/gepnic-access-findings.md` records a misreading
 * worth not repeating: the gated pages return 116-125 `<tr>` rows that look
 * like a populated result set and are in fact the search form's own dropdown
 * scaffolding, every one containing `-Select-`. Cell contents are inspected
 * here before a row is accepted.
 */

/** A tender as the landing page states it. Nothing is inferred. */
export interface ParsedTender {
  /**
   * The portal's own opaque id, from the detail link's `sp` parameter.
   *
   * This is the identity. The reference number is not: on Tamil Nadu one
   * reference was shared by six distinct tenders, and five rows were
   * indistinguishable by title, reference and closing date together. Keying on
   * either silently collapses real tenders.
   */
  readonly portalTenderId: string;
  readonly tenderReference: string;
  readonly title: string;
  /** ISO 8601 UTC, or null where the page states no readable date. */
  readonly closingAt: string | null;
  readonly bidOpeningAt: string | null;
}

export interface ParseOutcome {
  readonly tenders: readonly ParsedTender[];
  readonly rejected: readonly { readonly row: string; readonly reason: string }[];
}

/** Indian Standard Time. GePNIC prints local time with no offset. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

const MONTHS: Readonly<Record<string, number>> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/**
 * `14-Sep-2026 02:00 PM` as an ISO instant.
 *
 * The page states a wall-clock time with no zone. Reading it as UTC would move
 * every closing date five and a half hours earlier — enough to report a tender
 * as closing on the wrong day. Returns null rather than guessing when the shape
 * does not match: a date we cannot read is absent, not approximated.
 */
/**
 * A 12-hour clock reading as hours past midnight, or null if it is not one.
 *
 * 12 AM is midnight and 12 PM is noon: both are special cases of the same
 * off-by-twelve, and getting either wrong moves a deadline by half a day.
 */
function hourOfDay(hourRaw: string, minute: number, meridiem: string): number | null {
  const hour = Number(hourRaw);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const isPm = meridiem.toUpperCase() === "PM";
  if (hour === 12) return isPm ? 12 : 0;
  return isPm ? hour + 12 : hour;
}

export function parseIstDateTime(text: string): string | null {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(
    text.trim(),
  );
  if (match === null) return null;

  const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, meridiem] = match;
  const month = MONTHS[(monthRaw ?? "").toLowerCase()];
  if (month === undefined) return null;

  const day = Number(dayRaw);
  const year = Number(yearRaw);
  const minute = Number(minuteRaw);
  const hour = hourOfDay(hourRaw ?? "", minute, meridiem ?? "");
  if (hour === null) return null;

  // Round-trip guard: Date.UTC rolls 31 February into March rather than
  // failing, so a date that does not survive the trip was never a date.
  const asUtcNoon = new Date(Date.UTC(year, month, day, 12));
  if (asUtcNoon.getUTCDate() !== day || asUtcNoon.getUTCMonth() !== month) return null;

  return new Date(
    Date.UTC(year, month, day, hour, minute) - IST_OFFSET_MINUTES * 60_000,
  ).toISOString();
}

function decodeEntities(text: string): string {
  return (
    text
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
      // Ampersand last: decoding it first would let `&amp;lt;` become `<`.
      .replace(/&amp;/gi, "&")
  );
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** The `sp` parameter of a detail link, which is the tender's identity. */
export function tenderIdFrom(cellHtml: string): string | null {
  const href = /href\s*=\s*"([^"]+)"/i.exec(cellHtml);
  if (href === null) return null;
  const sp = /[?&]sp=([^&"]+)/.exec(decodeEntities(href[1] ?? ""));
  const value = sp?.[1]?.trim();
  return value === undefined || value === "" ? null : value;
}

/** The leading `12. ` a GePNIC list prints before each title. */
function withoutRowNumber(title: string): string {
  return title.replace(/^\d+\.\s*/, "").trim();
}

const SCAFFOLDING = "-Select-";

/**
 * Parse a landing page into the tenders it states.
 *
 * A row carrying no identity is refused with a reason rather than dropped, so a
 * run reports what it declined instead of quietly holding fewer tenders than
 * the operator believes.
 */
interface TenderRowText {
  readonly title: string;
  readonly reference: string;
  readonly closingAt: string | null;
  readonly bidOpeningAt: string | null;
}

/**
 * Is this row a tender at all?
 *
 * Separate from reading one, because the page mixes tenders with a navigation
 * strip, a corrigendum table and the search form's scaffolding — all of which
 * match the four-cell shape. `null` means "never a candidate", which is not the
 * same as "a tender we could not read".
 */
function tenderRowText(text: readonly string[]): TenderRowText | null {
  if (text.some((c) => c.includes(SCAFFOLDING)) || text[0] === "Tender Title") return null;

  const title = withoutRowNumber(text[0] ?? "");
  const reference = (text[1] ?? "").trim();
  if (title === "" || reference === "") return null;

  const closingAt = parseIstDateTime(text[2] ?? "");
  const bidOpeningAt = parseIstDateTime(text[3] ?? "");
  // A tender states at least one date. Without this test the navigation strip
  // and the corrigendum header get reported as rejected tenders — telling an
  // operator that data was lost when none ever existed. A false alarm about
  // missing records is its own kind of dishonesty.
  if (closingAt === null && bidOpeningAt === null) return null;

  return { title, reference, closingAt, bidOpeningAt };
}

/** `null` where the row is not a tender at all — a header, nav, scaffolding. */
function readRow(rowHtml: string): ParsedTender | { readonly unidentified: string } | null {
  const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => m[1] ?? "");
  if (cells.length < 4) return null;

  const row = tenderRowText(cells.map(stripTags));
  if (row === null) return null;

  const identity = tenderIdFrom(cells[0] ?? "");
  // A tender we cannot identify cannot be deduplicated on the next run, and
  // would accumulate a fresh row every day. Refusing is the smaller loss.
  if (identity === null) {
    return { unidentified: `${row.reference} — ${row.title}`.slice(0, 120) };
  }

  return {
    portalTenderId: identity,
    tenderReference: row.reference,
    title: row.title,
    closingAt: row.closingAt,
    bidOpeningAt: row.bidOpeningAt,
  };
}

export function parseLanding(html: string): ParseOutcome {
  const tenders: ParsedTender[] = [];
  const rejected: { row: string; reason: string }[] = [];

  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const parsed = readRow(rowMatch[1] ?? "");
    if (parsed === null) continue;
    if ("unidentified" in parsed)
      rejected.push({ row: parsed.unidentified, reason: "no sp= identity" });
    else tenders.push(parsed);
  }

  return { tenders, rejected };
}
