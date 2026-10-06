import type pg from "pg";

import type { FactCandidate, FactKind, PageInput } from "../cag/facts";
import { loadFactCandidates, type FactParser } from "../cag/facts-load";
import type { Verdict } from "../cag/validation";

/**
 * Facts read out of tender notices, each kept with the page it came from
 * (MHA-TENDER-008).
 *
 * Two layouts are read, and nothing else:
 *
 * - **The GePNIC printout.** A department that publishes on MahaTenders often
 *   attaches the portal's own "Tender Details" page, printed to PDF. It is a
 *   form: every value sits beside a fixed label, so a value is read only where
 *   its label is, and the reading is exact. This is also the only place the
 *   MahaTenders tender ID reaches us — `mahatenders.gov.in` refuses crawling.
 *   `gepnic/detail.ts` reads the same form as HTML, cell by cell; printing it
 *   loses the cells, so here labels are matched in running text instead.
 * - **The issuer's own letter.** MSIDC's notices state the notice number, the
 *   EMD, the document fee and a list of dates in prose that varies from year to
 *   year. Only labelled lines seen across the whole corpus are read; a table of
 *   per-package EMDs is not, because a row read into the wrong column is a wrong
 *   figure with a correct citation.
 *
 * Every reading is a candidate in `document_fact`, unpublished until a person
 * verifies it, and names the `field` it fills — a notice states four amounts,
 * and `monetary_amount` alone cannot say which is the EMD.
 *
 * - **MHADA's Marathi notice.** Every MHADA notice in the corpus is a scan, so
 *   it is read from an OCR reading (ADR-072). Only the dated lines of its
 *   schedule are read — publication, the last date for bids, the openings, the
 *   pre-bid meeting — and its reference number. Its amounts sit in a per-work
 *   table and are not read, for the reason MSIDC's per-package EMDs are not.
 *
 * A fact read from a scan is always marked for review, with its confidence
 * scaled by the least confident word it was read from, and keeps the reading
 * it came from. Whatever a person decides, it is withheld from `published_fact`
 * until a surface can say to a reader that the figure was read from a scan.
 *
 * Dates in letters are written 17/07/2026. Indian government practice is
 * day-first, and every MSIDC letter in the corpus is, but where both orders form
 * a date the reading is marked for review rather than asserted.
 */

export const NOTICE_PARSER: FactParser = {
  version: "mh-notice-facts/2",
  method: "labelled fields over pdf text layer",
};

/**
 * The method recorded on a fact read from an OCR reading, naming the engine that
 * read the page. A scan has no text of its own; what was matched is an engine's
 * guess at the ink (ADR-072).
 */
export function ocrMethod(engine: string, version: string): string {
  return `labelled fields over OCR reading (${engine} ${version})`;
}

/** Printed on every page of a GePNIC "Tender Details" printout. */
const GEPNIC_PAGE = "eProcurement System Government of Maharashtra";

const IST = "+05:30";
const GEPNIC_CONFIDENCE = 0.95;
const LETTER_CONFIDENCE = 0.85;
/** Lower: the day-first reading is a convention, not something the page states. */
const AMBIGUOUS_DATE_CONFIDENCE = 0.7;
const LAST_UNAMBIGUOUS_DAY = 12;
const NOON = 12;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** A label, spelt with any run of whitespace between its words: the text layer wraps labels. */
function label(words: string): string {
  return words.trim().split(/\s+/u).join("\\s+");
}

const two = (n: number): string => String(n).padStart(2, "0");

/** A calendar date in ISO form, or null if the parts do not make one. */
function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? `${String(year)}-${two(month)}-${two(day)}` : null;
}

/**
 * Rupees as a PDF prints them — `1,50,79,073`, `23,600`, `500.00` — in paise,
 * as a decimal string, or null.
 *
 * Stricter than `gepnic/detail.ts`'s reader of the portal's HTML cells: a PDF
 * text layer injects spaces into digit groups, so commas must fall exactly
 * where Indian or Western grouping puts them. Anything else is a damaged figure,
 * left unread rather than repaired.
 */
export function printedRupeesToPaise(printed: string): string | null {
  const match = /^(\d{1,3}(?:,\d{2})*,\d{3}|\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/u.exec(
    printed,
  );
  if (match === null) return null;
  const rupees = BigInt((match[1] ?? "").replaceAll(",", ""));
  const paise = BigInt((match[2] ?? "").padEnd(2, "0"));
  return String(rupees * 100n + paise);
}

/** `05:00 PM` → `17:00`, or null for a time no clock shows. */
function twentyFourHour(hour: number, minute: string, half: string): string | null {
  if (hour < 1 || hour > NOON || Number(minute) >= MINUTES_IN_HOUR) return null;
  return `${two((hour % NOON) + (half === "PM" ? NOON : 0))}:${minute}`;
}

/** `16-Mar-2026 05:00 PM` → `2026-03-16T17:00+05:30`. */
export function gepnicDateTime(printed: string): string | null {
  const match = /^(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2})\s+([AP]M)$/u.exec(printed.trim());
  if (match === null) return null;
  const [, day = "", monthName = "", year = "", hour = "", minute = "", half = ""] = match;
  const month = MONTHS[monthName.toLowerCase()];
  if (month === undefined) return null;
  const date = isoDate(Number(year), month, Number(day));
  const time = twentyFourHour(Number(hour), minute, half);
  return date === null || time === null ? null : `${date}T${time}${IST}`;
}

interface Reading {
  readonly field: string;
  readonly kind: FactKind;
  /**
   * Where the value sits in the page's text — the captured figures, not the
   * label before them — so a scan's words can be found under it.
   */
  readonly start: number;
  readonly end: number;
  readonly rawText: string;
  readonly value: string | null;
  readonly confidence: number;
  readonly verdict: Verdict;
}

const collapse = (text: string): string => text.replace(/\s+/gu, " ").trim();

/**
 * Where a match's value sits in the text it was matched in: from its first
 * captured group to its last. The label is excluded on purpose. A label the
 * pattern matched was read as written, or it would not have matched; the
 * figures after it are what an OCR engine can have got wrong. Every pattern
 * here is compiled with the `d` flag so that the groups' positions are known.
 */
function span(m: RegExpMatchArray): { start: number; end: number } {
  // A group that took no part in the match has no position. The DOM typings
  // say otherwise; the runtime does not.
  const positions = (m.indices ?? []).slice(1) as ([number, number] | undefined)[];
  const groups = positions.filter((g): g is [number, number] => g !== undefined);
  if (groups.length === 0) {
    const start = m.index ?? 0;
    return { start, end: start + m[0].length };
  }
  return {
    start: Math.min(...groups.map(([start]) => start)),
    end: Math.max(...groups.map(([, end]) => end)),
  };
}

function candidateOf(pageNumber: number, r: Reading): FactCandidate {
  return {
    kind: r.kind,
    pageNumber,
    rawText: r.rawText,
    normalisedValue: r.value,
    extractionConfidence: r.confidence,
    validation: r.verdict,
    perUnit: null,
    field: r.field,
  };
}

// ── The GePNIC printout ─────────────────────────────────────────────────────

const ON_THE_FORM: Verdict = {
  state: "accepted",
  reason: "a labelled field of the GePNIC tender printout",
};

const AMOUNT = String.raw`(\d[\d,]*(?:\.\d{1,2})?)`;
const GEPNIC_WHEN = String.raw`(\d{2}-[A-Za-z]{3}-\d{4}\s+\d{2}:\d{2}\s+[AP]M)`;

/** The printout's labelled amounts. `Total Fee` is printed `[Total Fee in ₹ * - 12,300]`. */
const GEPNIC_AMOUNTS: readonly { field: string; pattern: RegExp }[] = [
  {
    field: "tender_value",
    pattern: new RegExp(`${label("Tender Value in ₹")}\\s+${AMOUNT}`, "dgu"),
  },
  { field: "emd", pattern: new RegExp(`${label("EMD Amount in ₹")}\\s+${AMOUNT}`, "dgu") },
  { field: "tender_fee", pattern: new RegExp(`${label("Tender Fee in ₹")}\\s+${AMOUNT}`, "dgu") },
  {
    field: "processing_fee",
    pattern: new RegExp(`${label("Processing Fee in ₹")}\\s+${AMOUNT}`, "dgu"),
  },
  {
    field: "total_fee",
    pattern: new RegExp(`${label("Total Fee in ₹")}\\s*\\*?\\s*-\\s*${AMOUNT}`, "dgu"),
  },
];

/**
 * The printout's dates. "Bid Opening Date" is also the tail of "Financial Bid
 * Opening Date", which is a different date, so the shorter label refuses to be
 * read inside the longer.
 */
const GEPNIC_DATES: readonly { field: string; label: string }[] = [
  { field: "publish", label: label("Publish Date") },
  {
    field: "document_download_start",
    label: label("Document Download / Sale Start Date"),
  },
  { field: "document_download_end", label: label("Document Download / Sale End Date") },
  { field: "clarification_start", label: label("Clarification Start Date") },
  { field: "clarification_end", label: label("Clarification End Date") },
  { field: "bid_submission_start", label: label("Bid Submission Start Date") },
  { field: "bid_submission_end", label: label("Bid Submission End Date") },
  { field: "pre_bid_meeting", label: label("Pre Bid Meeting Date") },
  { field: "bid_opening", label: `(?<!Financial\\s)${label("Bid Opening Date")}` },
  { field: "financial_bid_opening", label: label("Financial Bid Opening Date") },
];

/** `2026_MSIDC_1285274_1`: year, organisation, serial, revision. */
const GEPNIC_TENDER_ID = new RegExp(
  `${label("Tender ID")}\\s+(\\d{4}_[A-Z0-9]+_\\d+_\\d+)\\b`,
  "gu",
);
/** The department's own reference, which runs to the end of its line. */
const GEPNIC_REFERENCE = new RegExp(`${label("Tender Reference Number")}\\s+(\\S[^\\n]*)`, "dgu");

function gepnicReadings(page: string): Reading[] {
  const out: Reading[] = [];
  const read = (field: string, kind: FactKind, m: RegExpMatchArray, value: string | null): void => {
    out.push({
      field,
      kind,
      ...span(m),
      rawText: collapse(m[0]),
      value,
      confidence: GEPNIC_CONFIDENCE,
      verdict: ON_THE_FORM,
    });
  };
  for (const m of page.matchAll(GEPNIC_TENDER_ID)) {
    read("gepnic_tender_id", "tender_identifier", m, m[1] ?? null);
  }
  for (const m of page.matchAll(GEPNIC_REFERENCE)) {
    read("tender_reference_number", "tender_identifier", m, collapse(m[1] ?? ""));
  }
  for (const { field, pattern } of GEPNIC_AMOUNTS) {
    for (const m of page.matchAll(pattern)) {
      read(field, "monetary_amount", m, printedRupeesToPaise(m[1] ?? ""));
    }
  }
  for (const date of GEPNIC_DATES) {
    for (const m of page.matchAll(new RegExp(`${date.label}\\s+${GEPNIC_WHEN}`, "dgu"))) {
      read(date.field, "tender_date", m, gepnicDateTime(m[1] ?? ""));
    }
  }
  return out;
}

// ── The issuer's letter ─────────────────────────────────────────────────────

/** `17/07/2026`, then optionally `at 12.00 Hrs` or `; Time - 17.00 Hrs`. */
const LETTER_WHEN = String.raw`(\d{1,2})/(\d{1,2})/(\d{4})(?:\s*;?\s*(?:at|Time\s*-?)\s*(\d{1,2})[.:](\d{2})\s*Hrs)?`;

/** Labels that precede a date in MSIDC's letters, as the corpus prints them. */
const LETTER_DATES: readonly { field: string; label: string }[] = [
  {
    field: "publish",
    label: String.raw`Date\s+of\s+Issue\s+(?:of\s+)?(?:E-?\s*)?(?:Tender|Empanelment)\s+Notice\s*:?\s*(?:\(Online\)\s*)?`,
  },
  { field: "publish", label: String.raw`Start\s+Date\s+of\s+Publication\s*:?\s*` },
  {
    field: "bid_submission_start",
    label: String.raw`Start\s+Date\s+for\s+submission\s+of\s+Bids\s*:?\s*`,
  },
  {
    field: "bid_submission_end",
    label: String.raw`Last\s+date\s+(?:for|of)\s+(?:submitting|submission)\b[^\n\d]{0,60}?`,
  },
  { field: "pre_bid_meeting", label: String.raw`Pre-?\s*Bid\s+Meeting\s*:?\s*` },
  {
    field: "bid_opening",
    label: String.raw`(?:Date\s+of\s+Opening\s+of\s+technical\s+bids|Tender\s+opening\s*\(If\s+possible\))[^\n\d]{0,4}`,
  },
];

const AMBIGUOUS_ORDER: Verdict = {
  state: "needs_review",
  reason: "read day-first; the figures also form a date month-first",
};
const DAY_FIRST: Verdict = {
  state: "accepted",
  reason: "the day or a repeated figure fixes the order: day-first",
};
const LETTER_LINE: Verdict = { state: "needs_review", reason: "" };

function letterDate(m: RegExpMatchArray): { value: string | null; ambiguous: boolean } {
  const [, day = "", month = "", year = "", hour, minute] = m;
  const date = isoDate(Number(year), Number(month), Number(day));
  const ambiguous = Number(day) <= LAST_UNAMBIGUOUS_DAY && Number(day) !== Number(month);
  if (date === null) return { value: null, ambiguous };
  if (hour === undefined || minute === undefined) return { value: date, ambiguous };
  const valid = Number(hour) < HOURS_IN_DAY && Number(minute) < MINUTES_IN_HOUR;
  return { value: valid ? `${date}T${two(Number(hour))}:${minute}${IST}` : date, ambiguous };
}

const LETTER_AMOUNT = String.raw`(?:INR|Rs\.?|₹)\s*(\d[\d,]*(?:\.\d{1,2})?)`;
/** `Earnest Money Deposit: INR 6,00,000/-`, `Earnest Money Deposit (EMD) for Empanelment: Rs. 20,000/-`. */
const LETTER_EMD = new RegExp(
  String.raw`Earnest\s+Money\s+Deposit[^:\n]{0,30}:\s*${LETTER_AMOUNT}`,
  "giu",
);
/**
 * `Tender Document Fees INR 23,600/- (20,000/- + GST)` states the fee payable;
 * `Tender Document Fee: Rs. 5,000/- + GST` states it before tax, and is
 * recorded as that rather than as the fee.
 */
const LETTER_FEE = new RegExp(
  String.raw`Tender\s+Document\s+Fees?\s*:?\s*${LETTER_AMOUNT}(\s*/-)?(\s*\+\s*GST)?`,
  "giu",
);
/** `E-Tender Notice No. 09 (2026-2027)`, `E-TENDER NOTICE NO.06 OF 2023-2024`, `notice No.09 Year 2024-25`. */
const LETTER_NOTICE_NUMBER =
  /(?:E-?\s*Tender\s+Notice|notice)\s+No\.?\s*(\d{1,3})\s*(?:\(\s*(\d{4}\s*-\s*\d{2,4})\s*\)|OF\s+(\d{4}\s*-\s*\d{2,4})|Year\s+(\d{4}\s*-\s*\d{2,4}))/dgiu;
/** `No. MSIDC/Mumbai/Tender/ 09 /2026` on a line of its own, or `Tender Ref. No: MSIDC/EOI/EMP-ADV/2026`. */
const LETTER_REFERENCE =
  /(?:^No\.|Tender\s+Ref\.?\s*No\.?\s*:?)\s*(MSIDC\/[^\n]*?)(?=\s+Date\b|\s*$)/dgimu;

function letterIdentifiers(page: string): Reading[] {
  const out: Reading[] = [];
  for (const m of page.matchAll(LETTER_NOTICE_NUMBER)) {
    const year = (m[2] ?? m[3] ?? m[4] ?? "").replace(/\s+/gu, "");
    out.push({
      field: "notice_number",
      kind: "tender_identifier",
      ...span(m),
      rawText: collapse(m[0]),
      value: `${m[1] ?? ""} (${year})`,
      confidence: LETTER_CONFIDENCE,
      verdict: LETTER_LINE,
    });
  }
  for (const m of page.matchAll(LETTER_REFERENCE)) {
    out.push({
      field: "issuer_reference",
      kind: "tender_identifier",
      ...span(m),
      rawText: collapse(m[0]),
      value: (m[1] ?? "").replace(/\s+/gu, ""),
      confidence: LETTER_CONFIDENCE,
      verdict: LETTER_LINE,
    });
  }
  return out;
}

function letterAmounts(page: string): Reading[] {
  const amount = (field: string, m: RegExpMatchArray): Reading => ({
    field,
    kind: "monetary_amount",
    ...span(m),
    rawText: collapse(m[0]),
    value: printedRupeesToPaise(m[1] ?? ""),
    confidence: LETTER_CONFIDENCE,
    verdict: LETTER_LINE,
  });
  return [
    ...[...page.matchAll(LETTER_EMD)].map((m) => amount("emd", m)),
    ...[...page.matchAll(LETTER_FEE)].map((m) =>
      amount(m[3] === undefined ? "tender_fee" : "tender_fee_before_gst", m),
    ),
  ];
}

function letterDates(page: string): Reading[] {
  return LETTER_DATES.flatMap((date) =>
    [...page.matchAll(new RegExp(`${date.label}${LETTER_WHEN}`, "dgiu"))].map((m) => {
      const { value, ambiguous } = letterDate(m);
      return {
        field: date.field,
        kind: "tender_date" as const,
        ...span(m),
        rawText: collapse(m[0]),
        value,
        confidence: ambiguous ? AMBIGUOUS_DATE_CONFIDENCE : LETTER_CONFIDENCE,
        verdict: ambiguous ? AMBIGUOUS_ORDER : DAY_FIRST,
      };
    }),
  );
}

// ── MHADA's Marathi notice ──────────────────────────────────────────────────

/** Devanagari digits as the ASCII digits they are, for reading a value; the raw text keeps them. */
export function asciiDigits(text: string): string {
  return text.replace(/[०-९]/gu, (d) => String(d.charCodeAt(0) - "०".charCodeAt(0)));
}

const DIGIT = "[0-9०-९]";
/**
 * `०६.१०.२०२६`, then optionally `, सायंकाळी ६.१५`. Dots only, as every MHADA
 * notice prints them: an OCR reading that turned a dot into a comma or doubled
 * a digit (`०८.१९०.२०२६`) is a damaged date, left unread rather than repaired.
 */
const MARATHI_WHEN = `(${DIGIT}{1,2})\\.(${DIGIT}{1,2})\\.(${DIGIT}{4})(?:\\s*,?\\s*(सकाळी|दुपारी|सायंकाळी|संध्याकाळी|रात्री)\\s*(${DIGIT}{1,2})[.:](${DIGIT}{2}))?`;

/** The schedule's labels, as the corpus prints them. */
const MARATHI_DATES: readonly { field: string; label: string }[] = [
  { field: "publish", label: String.raw`जाहिरात\s+(?:प्रसिद्धी\s+)?दिनांक\s*:?\s*(?:दि\.\s*)?` },
  { field: "bid_submission_end", label: String.raw`निविदा\s+स्विकृती\s+अंतिम\s+दिनांक\s*:?\s*` },
  { field: "bid_opening", label: String.raw`तांत्रिक\s+बोली\s+उघडण्याचा\s+दिनांक\s*:?\s*` },
  {
    field: "financial_bid_opening",
    label: String.raw`आर्थिक\s+बोली\s+उघडण्याचा\s+दिनांक\s*:?\s*`,
  },
  { field: "pre_bid_meeting", label: String.raw`निविदापूर्व\s+बैठक\s+दिनांक\s*:?\s*` },
];

/**
 * The hour on a twenty-four-hour clock, from the part of the day the notice
 * names. A pairing no clock shows — `दुपारी ९`, `रात्री २` — is no time at all,
 * and the date is read without one.
 */
/**
 * Which hours each part of the day can name, and what each is on a
 * twenty-four-hour clock. Afternoon runs to six, evening to eleven, night from
 * seven; a pairing outside those — `दुपारी ९`, `रात्री २` — is no time at all,
 * and the date is read without one.
 */
const PARTS_OF_DAY: Readonly<Record<string, (hour: number) => number | null>> = {
  सकाळी: (h) => (h === NOON ? 0 : h),
  दुपारी: (h) => (h === NOON ? NOON : h <= 6 ? h + NOON : null),
  सायंकाळी: (h) => (h < NOON ? h + NOON : null),
  संध्याकाळी: (h) => (h < NOON ? h + NOON : null),
  रात्री: (h) => (h >= 7 && h < NOON ? h + NOON : null),
};

function marathiHour(period: string, hour: number): number | null {
  if (hour < 1 || hour > NOON) return null;
  return PARTS_OF_DAY[period]?.(hour) ?? null;
}

function marathiDate(m: RegExpMatchArray): { value: string | null; ambiguous: boolean } {
  const [, rawDay = "", rawMonth = "", rawYear = "", period, rawHour, rawMinute] = m;
  const day = Number(asciiDigits(rawDay));
  const month = Number(asciiDigits(rawMonth));
  const date = isoDate(Number(asciiDigits(rawYear)), month, day);
  const ambiguous = day <= LAST_UNAMBIGUOUS_DAY && day !== month;
  if (date === null) return { value: null, ambiguous };
  if (period === undefined || rawHour === undefined || rawMinute === undefined) {
    return { value: date, ambiguous };
  }
  const hour = marathiHour(period, Number(asciiDigits(rawHour)));
  const minute = asciiDigits(rawMinute);
  const valid = hour !== null && Number(minute) < MINUTES_IN_HOUR;
  return { value: valid ? `${date}T${two(hour)}:${minute}${IST}` : date, ambiguous };
}

/** `ई-निविदा सुचना क्र.:- का. अ. (पूर्व) / मु.झो.सु.मंडळ/ ई-निविदा/ ३९ /२०२६-२७`, to the end of its line. */
const MARATHI_REFERENCE = /ई-?\s*निविदा\s+सुचना\s+क्र\.?\s*:?\s*-?\s*(\S[^\n]*)/dgu;

function marathiReadings(page: string): Reading[] {
  const out: Reading[] = [];
  for (const m of page.matchAll(MARATHI_REFERENCE)) {
    out.push({
      field: "issuer_reference",
      kind: "tender_identifier",
      ...span(m),
      rawText: collapse(m[0]),
      value: collapse(m[1] ?? ""),
      confidence: LETTER_CONFIDENCE,
      verdict: LETTER_LINE,
    });
  }
  for (const date of MARATHI_DATES) {
    for (const m of page.matchAll(new RegExp(`${date.label}${MARATHI_WHEN}`, "dgu"))) {
      const { value, ambiguous } = marathiDate(m);
      out.push({
        field: date.field,
        kind: "tender_date",
        ...span(m),
        rawText: collapse(m[0]),
        value,
        confidence: ambiguous ? AMBIGUOUS_DATE_CONFIDENCE : LETTER_CONFIDENCE,
        verdict: ambiguous ? AMBIGUOUS_ORDER : DAY_FIRST,
      });
    }
  }
  return out;
}

// ── Pages, and scans read by OCR ────────────────────────────────────────────

/** A word of an OCR reading: its span in the reading's text, its box, the engine's confidence. */
export interface ReadingWord {
  readonly charStart: number;
  readonly charEnd: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly confidence: number;
}

/** An OCR engine's reading of a page with no text layer (ADR-071). */
export interface PageReadingInput {
  readonly id: number;
  readonly engine: string;
  readonly engineVersion: string;
  readonly words: readonly ReadingWord[];
}

/**
 * A page to read facts from. Either its own text, or — for a scan — one
 * engine's reading of it, whose `content` is the reading's text.
 */
export interface NoticePage extends PageInput {
  readonly reading?: PageReadingInput;
}

function readingsOf(content: string): Reading[] {
  return content.includes(GEPNIC_PAGE)
    ? gepnicReadings(content)
    : [
        ...letterIdentifiers(content),
        ...letterAmounts(content),
        ...letterDates(content),
        ...marathiReadings(content),
      ];
}

/**
 * A fact read from a scan, as a candidate a person must check.
 *
 * The confidence is the parser's, scaled by the least confident word of the
 * value: a labelled line read exactly is still only as good as the engine's
 * worst guess at its figures. The box is those words' union, in the reading's
 * PDF points — the figure, as on a text-layer page, not its label. A match that covers no word — which a reading assembled from those
 * very words should never produce — is offered with no box rather than an
 * invented one.
 */
function fromReading(pageNumber: number, r: Reading, reading: PageReadingInput): FactCandidate {
  const words = reading.words.filter((w) => w.charStart < r.end && w.charEnd > r.start);
  const weakest = words.reduce((least, w) => Math.min(least, w.confidence), 1);
  const scaled = Math.round(r.confidence * weakest * 1000) / 1000;
  const box =
    words.length === 0
      ? undefined
      : {
          x0: Math.min(...words.map((w) => w.x0)),
          y0: Math.min(...words.map((w) => w.y0)),
          x1: Math.max(...words.map((w) => w.x1)),
          y1: Math.max(...words.map((w) => w.y1)),
        };
  const reason = [
    `read from an OCR reading (${reading.engine} ${reading.engineVersion}); check it against the page image`,
    r.verdict.reason,
  ]
    .filter((part) => part !== "")
    .join("; ");
  return {
    ...candidateOf(pageNumber, { ...r, confidence: scaled }),
    validation: { state: "needs_review", reason },
    pageReadingId: reading.id,
    extractionMethod: ocrMethod(reading.engine, reading.engineVersion),
    ...(box === undefined ? {} : { box }),
  };
}

/**
 * Every fact the layouts yield, page by page. A page with no text and no
 * reading yields none; a page read by two engines yields each engine's facts.
 */
export function noticeFacts(pages: readonly NoticePage[]): FactCandidate[] {
  return pages.flatMap((page) => {
    const content = page.content;
    if (content === null) return [];
    const reading = page.reading;
    return readingsOf(content).map((r) =>
      reading === undefined
        ? candidateOf(page.pageNumber, r)
        : fromReading(page.pageNumber, r, reading),
    );
  });
}

export interface NoticeFactCounts {
  documents: number;
  /** Documents that yielded at least one fact. */
  withFacts: number;
  inserted: number;
  retired: number;
  /** Decided facts this parser no longer produces; kept, and reported. */
  strandedDecisions: number;
}

/**
 * Every OCR reading of a source's scanned notice pages, with its words. Only
 * pages with no text layer: a page with text is read from its text, and an
 * engine's reading of it would be a second opinion on what the publisher typed.
 */
async function readingsOfScans(
  db: pg.ClientBase,
  sourceId: string,
): Promise<{ documentId: number; page: NoticePage }[]> {
  const readings = await db.query<{
    id: string;
    document_id: string;
    page_number: number;
    engine: string;
    engine_version: string;
    content: string;
  }>(
    `SELECT r.id, r.document_id, r.page_number, r.engine, r.engine_version, r.content
       FROM page_reading r
       JOIN document_page p ON p.document_id = r.document_id AND p.page_number = r.page_number
       JOIN document d ON d.id = r.document_id
       JOIN source_artifact a ON a.sha256 = d.source_sha256
      WHERE a.source_id = $1 AND d.doc_type = 'tender_notice'
        AND p.content IS NULL AND r.refusal IS NULL
      ORDER BY r.id`,
    [sourceId],
  );
  if (readings.rows.length === 0) return [];
  const words = await db.query<{
    reading_id: string;
    char_start: number;
    char_end: number;
    x0: string;
    y0: string;
    x1: string;
    y1: string;
    confidence: string;
  }>(
    `SELECT reading_id, char_start, char_end, x0, y0, x1, y1, confidence
       FROM page_reading_item WHERE reading_id = ANY($1::bigint[]) ORDER BY reading_id, seq`,
    [readings.rows.map((r) => r.id)],
  );
  const wordsOf = new Map<string, ReadingWord[]>();
  for (const w of words.rows) {
    const list = wordsOf.get(w.reading_id) ?? [];
    list.push({
      charStart: w.char_start,
      charEnd: w.char_end,
      x0: Number(w.x0),
      y0: Number(w.y0),
      x1: Number(w.x1),
      y1: Number(w.y1),
      confidence: Number(w.confidence),
    });
    wordsOf.set(w.reading_id, list);
  }
  return readings.rows.map((r) => ({
    documentId: Number(r.document_id),
    page: {
      pageNumber: r.page_number,
      content: r.content,
      reading: {
        id: Number(r.id),
        engine: r.engine,
        engineVersion: r.engine_version,
        words: wordsOf.get(r.id) ?? [],
      },
    },
  }));
}

/**
 * Read every tender notice of a source, from its text or from its scans'
 * readings, and reconcile its facts.
 *
 * Re-run over every notice each time: the loader is idempotent, leaves decided
 * facts alone and retires undecided ones a new version no longer produces, so a
 * better parser is applied by running it again.
 */
export async function readNoticeFacts(
  db: pg.ClientBase,
  sourceId: string,
): Promise<NoticeFactCounts> {
  const pages = await db.query<{
    document_id: string;
    page_number: number;
    content: string | null;
  }>(
    `SELECT p.document_id, p.page_number, p.content
       FROM document_page p
       JOIN document d ON d.id = p.document_id
       JOIN source_artifact a ON a.sha256 = d.source_sha256
      WHERE a.source_id = $1 AND d.doc_type = 'tender_notice'
      ORDER BY p.document_id, p.page_number`,
    [sourceId],
  );
  const byDocument = new Map<number, NoticePage[]>();
  const add = (documentId: number, page: NoticePage): void => {
    const list = byDocument.get(documentId) ?? [];
    list.push(page);
    byDocument.set(documentId, list);
  };
  for (const row of pages.rows) {
    // A scan's own page is kept, with no text, so its document is still read
    // and a fact a later run no longer finds is still retired.
    add(Number(row.document_id), { pageNumber: row.page_number, content: row.content });
  }
  for (const reading of await readingsOfScans(db, sourceId)) {
    add(reading.documentId, reading.page);
  }
  const counts: NoticeFactCounts = {
    documents: 0,
    withFacts: 0,
    inserted: 0,
    retired: 0,
    strandedDecisions: 0,
  };
  for (const [documentId, documentPages] of byDocument) {
    const candidates = noticeFacts(documentPages);
    const result = await loadFactCandidates(db, documentId, candidates, NOTICE_PARSER);
    counts.documents += 1;
    counts.withFacts += candidates.length > 0 ? 1 : 0;
    counts.inserted += result.inserted;
    counts.retired += result.retired;
    counts.strandedDecisions += result.strandedDecisions;
  }
  return counts;
}
