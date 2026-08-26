import { Money } from "@lokdarpan/money";

import { thousandsToPaise } from "./amount";

/** One published row: a scheme's money for one object head in one year. */
export interface BeamsRow {
  readonly deptCode: string;
  readonly demandNo: string;
  readonly schemeCode: string;
  readonly schemeNameEn: string | null;
  readonly schemeNameLocal: string | null;
  readonly chargedVoted: string | null;
  readonly schemeCommitted: string | null;
  readonly sourceOfFund: string | null;
  readonly planType: string | null;
  readonly objectCode: string;
  /** Rupees as a decimal string, ready for NUMERIC(20,2). `null` = not published. */
  readonly allocatedInr: string | null;
  /** Finance Department release to the department. */
  readonly releasedFdInr: string | null;
  /** Departmental release — the denominator for release variance. */
  readonly releasedInr: string | null;
  readonly utilizedInr: string | null;
  readonly reappropriatedInr: string | null;
}

export interface BeamsExport {
  readonly fiscalYear: number;
  readonly rows: readonly BeamsRow[];
}

/**
 * Column names as BEAMS spells them, including the trailing space in `" REAPP"`
 * and the American spelling of `SCHEME_COMITTED`. Matched by name rather than
 * position: a silently reordered column would otherwise load released amounts
 * into the budget field and look entirely successful.
 */
const REQUIRED = [
  "DEPT",
  "DEMAND_NO",
  "SCHEME_CODE",
  "OBJECT_CODE",
  "BUDGET",
  "EXPENDITURE",
] as const;

const clean = (raw: string): string => raw.replace(/\s+/gu, " ").trim();

const normaliseName = (name: string): string => name.replace(/[.\s]+/gu, "").toLowerCase();

/**
 * `null` for an empty cell — the source published nothing, not an empty string.
 *
 * Older exports write the literal four characters `null` where a name is
 * absent. Storing that would put the word "null" on screen as a scheme name.
 */
const ABSENT_TEXT = new Set(["", "-", "--", "---", "null", "NULL", "NA", "N/A"]);

const optional = (raw: string | undefined): string | null => {
  const value = clean(raw ?? "");
  if (ABSENT_TEXT.has(value)) return null;
  return value.normalize("NFC");
};

/**
 * The export advertises `application/vnd.ms-excel` but the body is HTML, and
 * the markup is loose enough that matching `<tr>…</tr>` finds four rows where
 * there are twenty-one thousand. Splitting on the opening tag is what works.
 */
function rowsOf(html: string): string[][] {
  return html
    .split(/<tr\b/iu)
    .slice(1)
    .map((chunk) =>
      chunk
        .split(/<t[dh]\b/iu)
        .slice(1)
        .map((cell) => {
          const afterAttributes = cell.includes(">") ? cell.slice(cell.indexOf(">") + 1) : cell;
          return clean(afterAttributes.replace(/<[^>]*>/gu, " "));
        }),
    );
}

function decodeEntities(html: string): string {
  return html
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"');
}

/** Rupees decimal string from a thousands figure, or `null` if unpublished. */
function toInr(raw: string | undefined): string | null {
  const paise = thousandsToPaise(raw ?? "");
  return paise === null ? null : Money.fromPaise(paise).toDecimalString();
}

type CellReader = (row: readonly string[], column: string) => string | undefined;

/**
 * Reads a cell by column name.
 *
 * Header spelling drifts between years — a trailing period on "RELEASED Dept.",
 * a leading space on " REAPP" — so names are normalised before matching. That
 * keeps one parser working across FY2017 (16 columns) and FY2024 (19), where
 * matching by position would load released amounts into the budget field and
 * look entirely successful.
 */
function cellReader(header: readonly string[]): CellReader {
  const normalised = header.map(normaliseName);
  return (row, column) => {
    const i = normalised.indexOf(normaliseName(column));
    return i === -1 ? undefined : row[i];
  };
}

/**
 * The narrowest row that can still be read: every required column must have a
 * cell. Older exports omit trailing columns entirely — FY2017 rows carry 14
 * cells against a 16-column header — while the leading columns stay aligned.
 * Requiring full width would discard every row in those years.
 */
function lastRequiredIndex(header: readonly string[]): number {
  const normalised = header.map(normaliseName);
  return Math.max(...REQUIRED.map((c) => normalised.indexOf(normaliseName(c))));
}

/**
 * `null` for a row that carries no chart-of-accounts coordinates — subtotals
 * and spacers. A row missing a coordinate is skipped rather than guessed at.
 */
function toRow(r: readonly string[], at: CellReader): BeamsRow | null {
  const deptCode = optional(at(r, "DEPT"));
  const schemeCode = optional(at(r, "SCHEME_CODE"));
  const objectCode = optional(at(r, "OBJECT_CODE"));
  const demandNo = optional(at(r, "DEMAND_NO"));
  if (deptCode === null || schemeCode === null || objectCode === null || demandNo === null) {
    return null;
  }

  return {
    deptCode,
    demandNo,
    schemeCode,
    schemeNameEn: optional(at(r, "BUDBOOK_SCHEMENM_ENGLISH")) ?? optional(at(r, "SCHEME_NM")),
    schemeNameLocal: optional(at(r, "BUDBOOK_SCHEMENM_MARATHI")),
    chargedVoted: optional(at(r, "CHARGED_VOTED")),
    schemeCommitted: optional(at(r, "SCHEME_COMITTED")),
    sourceOfFund: optional(at(r, "Source of fund")),
    planType: optional(at(r, "Plan Type")),
    objectCode,
    allocatedInr: toInr(at(r, "BUDGET")),
    releasedFdInr: toInr(at(r, "RELEASED FD")),
    releasedInr: toInr(at(r, "RELEASED Dept")),
    utilizedInr: toInr(at(r, "EXPENDITURE")),
    reappropriatedInr: toInr(at(r, "REAPP")),
  };
}

/** The export states its own year; assuming one would mis-file every figure. */
function fiscalYearOf(rows: readonly (readonly string[])[]): number {
  const row = rows.find((r) => r.some((c) => /Financial year/iu.test(c)));
  const match = /(\d{4})/u.exec(row?.join(" ") ?? "");
  if (match?.[1] === undefined) {
    throw new Error("BEAMS export does not state its financial year; refusing to assume one.");
  }
  return Number(match[1]);
}

/**
 * The unit is not decoration. If this line ever changes, every amount below it
 * changes meaning by a factor of a thousand, so its absence is a hard stop.
 */
function assertThousands(rows: readonly (readonly string[])[]): void {
  const row = rows.find((r) => r.some((c) => /Amounts In/iu.test(c)));
  const text = row?.join(" ") ?? "";
  if (!/Amounts In Thousands/iu.test(text)) {
    throw new Error(
      `BEAMS export does not declare "Amounts In Thousands" (found: "${clean(text)}"). ` +
        `The unit determines every figure; it must not be assumed.`,
    );
  }
}

function assertRequiredColumns(header: readonly string[]): void {
  const missing = REQUIRED.filter(
    (c) => !header.some((h) => normaliseName(h) === normaliseName(c)),
  );
  if (missing.length > 0) {
    throw new Error(
      `BEAMS export is missing column(s): ${missing.join(", ")}. Found: ${header.join(" | ")}.`,
    );
  }
}

export function parseBeamsExport(body: string): BeamsExport {
  const rows = rowsOf(decodeEntities(body));
  const fiscalYear = fiscalYearOf(rows);
  assertThousands(rows);

  const headerIndex = rows.findIndex((r) => r.includes("DEPT"));
  const header = rows[headerIndex];
  if (header === undefined) {
    throw new Error("BEAMS export has no header row.");
  }
  assertRequiredColumns(header);

  const at = cellReader(header);
  const lastRequired = lastRequiredIndex(header);

  const parsed: BeamsRow[] = [];
  for (const r of rows.slice(headerIndex + 1)) {
    if (r.length > lastRequired) {
      const row = toRow(r, at);
      if (row !== null) parsed.push(row);
    }
  }

  if (parsed.length === 0) {
    throw new Error("BEAMS export contained no data rows — refusing to report an empty ingest.");
  }
  return { fiscalYear, rows: parsed };
}
