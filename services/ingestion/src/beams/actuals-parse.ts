import { Money } from "@lokdarpan/money";

import { croresToPaise } from "./amount";

/** One department's actuals for a month range in one financial year. */
export interface DepartmentActualsRow {
  readonly deptCode: string;
  /** Published by this report, unlike the scheme-wise export. */
  readonly deptNameEn: string;
  /** Rupees as decimal strings. `null` = not published, never zero. */
  readonly budgetedInr: string | null;
  readonly releasedInr: string | null;
  readonly receivedInr: string | null;
  readonly beamsExpenditureInr: string | null;
  readonly treasuryExpenditureInr: string | null;
}

export interface DepartmentActuals {
  readonly fiscalYear: number;
  readonly fromMonth: number;
  readonly toMonth: number;
  readonly rows: readonly DepartmentActualsRow[];
}

/**
 * `H -Public Works` — code, separator, name. The separator drifts between a
 * hyphen and a dash across rows, so both are accepted.
 */
const DEPARTMENT = /^([A-Z]{1,3})\s*[-–—]\s*(.+)$/u;

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
] as const;

const clean = (raw: string): string => raw.replace(/\s+/gu, " ").trim();

function decodeEntities(html: string): string {
  return html
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"');
}

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
          return clean(afterAttributes.replace(/<[^>]*>/gu, " ")).normalize("NFC");
        }),
    );
}

/** Rupees decimal string from a figure in crores, or `null` if unpublished. */
function toInr(raw: string | undefined): string | null {
  const value = clean(raw ?? "");
  if (value === "" || value === "-" || value === "--") return null;
  const paise = croresToPaise(value);
  return paise === null ? null : Money.fromPaise(paise).toDecimalString();
}

/**
 * The unit is asserted, never assumed.
 *
 * This report declares "Amount in Crores" while the scheme-wise export declares
 * "Amounts In Thousands" — the same system, four orders of magnitude apart. If
 * the declaration changes or disappears, every figure below it changes meaning,
 * so its absence is a hard stop.
 */
function assertCrores(text: string): void {
  if (!/Amount\s+in\s+Crores/iu.test(text)) {
    throw new Error(
      'BEAMS actuals report does not declare "Amount in Crores". ' +
        "The unit determines every figure; it must not be assumed.",
    );
  }
}

function monthNumber(name: string, fallback: number): number {
  const i = MONTHS.indexOf(clean(name).toLowerCase() as (typeof MONTHS)[number]);
  return i === -1 ? fallback : i + 1;
}

interface Columns {
  readonly budgeted: number;
  readonly released: number;
  readonly received: number;
  readonly beams: number;
  readonly treasury: number;
}

/** Resolved by name; a renamed column fails loudly rather than shifting values. */
function resolveColumns(header: readonly string[]): Columns {
  const index = (name: RegExp): number => header.findIndex((h) => name.test(h));
  const cols: Columns = {
    budgeted: index(/^Budgeted$/iu),
    released: index(/^Released$/iu),
    received: index(/^Received$/iu),
    beams: index(/BEAMS Expenditure/iu),
    treasury: index(/Actual Expenditure in Trea/iu),
  };
  if (cols.budgeted === -1 || cols.released === -1 || cols.beams === -1) {
    throw new Error(
      `BEAMS actuals report is missing an expected column. Found: ${header.join(" | ")}.`,
    );
  }
  return cols;
}

function toRow(r: readonly string[], cols: Columns): DepartmentActualsRow | null {
  const match = DEPARTMENT.exec(r[0] ?? "");
  if (match === null) return null;
  const [, code, name] = match;
  if (code === undefined || name === undefined) return null;

  const at = (i: number): string | undefined => (i === -1 ? undefined : r[i]);
  return {
    deptCode: code,
    deptNameEn: clean(name),
    budgetedInr: toInr(at(cols.budgeted)),
    releasedInr: toInr(at(cols.released)),
    receivedInr: toInr(at(cols.received)),
    beamsExpenditureInr: toInr(at(cols.beams)),
    treasuryExpenditureInr: toInr(at(cols.treasury)),
  };
}

function assertNoDuplicates(rows: readonly DepartmentActualsRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.deptCode)) {
      throw new Error(`Department ${row.deptCode} appears twice in one report.`);
    }
    seen.add(row.deptCode);
  }
}

export function parseDepartmentActuals(body: string, fiscalYear: number): DepartmentActuals {
  const rows = rowsOf(decodeEntities(body));
  const flat = rows.map((r) => r.join(" ")).join(" ");

  assertCrores(flat);

  const range = /Yearly Budget\s+([A-Za-z]+)\s*-\s*([A-Za-z]+)/u.exec(flat);
  const fromMonth = monthNumber(range?.[1] ?? "", 4);
  const toMonth = monthNumber(range?.[2] ?? "", 3);

  const header = rows.find((r) => r.some((c) => /^Department$/iu.test(c)));
  if (header === undefined) {
    throw new Error("BEAMS actuals report has no Department column.");
  }
  const cols = resolveColumns(header);

  // The page renders the department table twice. The two agree on budget,
  // release and BEAMS expenditure, and differ in "Actual Expenditure in
  // Treasury" — for FY2024-25 Public Works, 2955.885 in the first and 0.000 in
  // the second. Which is authoritative is not established, so the first is read
  // and the second left alone rather than merged, averaged or preferred.
  const endOfFirstTable = rows.findIndex((r) => /^Total$/iu.test(r[0] ?? ""));
  const scope = endOfFirstTable === -1 ? rows : rows.slice(0, endOfFirstTable);

  const parsed = scope
    .map((r) => toRow(r, cols))
    .filter((r): r is DepartmentActualsRow => r !== null);

  if (parsed.length === 0) {
    throw new Error(
      "BEAMS actuals report contained no department rows — refusing to report an empty ingest. " +
        "An empty response from this host usually means the session was rejected, not that there is no data.",
    );
  }

  assertNoDuplicates(parsed);
  return { fiscalYear, fromMonth, toMonth, rows: parsed };
}
