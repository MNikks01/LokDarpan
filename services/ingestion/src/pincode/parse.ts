/**
 * Reading the Department of Posts' all-India pincode directory.
 *
 * Published on data.gov.in under the Government Open Data License – India by
 * the Ministry of Communications, Department of Posts. The current edition,
 * "All India Pincode Directory till last month", lists these fields (catalogue,
 * 2026-09-25): circlename, regionname, divisionname, officename, pincode,
 * officetype, delivery, district, statename, latitude, longitude. Only the five
 * the resolver needs are read, by name and in any case, so a reordered or
 * relabelled export fails loudly instead of loading the wrong column.
 */

export interface DirectoryEntry {
  readonly pincode: string;
  readonly officeName: string;
  readonly officeType: string | null;
  readonly districtName: string;
  readonly stateName: string;
}

export interface ParsedDirectory {
  readonly entries: readonly DirectoryEntry[];
  /** Rows refused, with why, so a partial read is never reported as a whole one. */
  readonly rejected: readonly { readonly line: number; readonly reason: string }[];
}

/** One directory row, keyed by lower-case column name, from a CSV or the API. */
export type DirectoryRecord = Readonly<Record<string, string | null | undefined>>;

/**
 * The column naming the district. The current edition calls it `district`; the
 * 2018 editions call it `districtname`.
 */
const DISTRICT_COLUMNS = ["district", "districtname"] as const;
const REQUIRED = ["officename", "pincode", "statename"] as const;

/** A quoted field from `start` (just past the opening quote) to its closing quote. */
function readQuoted(
  text: string,
  start: number,
): { readonly value: string; readonly next: number } {
  let value = "";
  let i = start;
  while (i < text.length) {
    const char = text.charAt(i);
    if (char !== '"') {
      value += char;
      i++;
    } else if (text.charAt(i + 1) === '"') {
      value += '"';
      i += 2;
    } else {
      return { value, next: i + 1 };
    }
  }
  return { value, next: i };
}

/** RFC 4180 fields: commas inside quotes, doubled quotes as a literal quote. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    if (char === '"') {
      const quoted = readQuoted(text, i + 1);
      field += quoted.value;
      i = quoted.next;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text.charAt(i + 1) === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** `NA`, blank and `NULL` are absent, never a name. */
function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" || /^(na|null|n\/a)$/iu.test(trimmed) ? null : trimmed;
}

/** Refuses a directory whose columns are not the ones this reads, naming what it found. */
function districtColumnOf(columns: readonly string[]): string {
  const have = new Set(columns);
  const district = DISTRICT_COLUMNS.find((c) => have.has(c));
  const missing: string[] = REQUIRED.filter((name) => !have.has(name));
  if (district === undefined) missing.push(DISTRICT_COLUMNS.join(" or "));
  if (missing.length > 0 || district === undefined) {
    throw new Error(
      `The directory has no ${missing.join(", ")} column. Found: ${columns.join(", ")}. ` +
        "Nothing loaded.",
    );
  }
  return district;
}

function lowerKeys(record: DirectoryRecord): DirectoryRecord {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k.trim().toLowerCase(), v]));
}

function readRecords(records: readonly DirectoryRecord[], firstLine: number): ParsedDirectory {
  const first = records[0];
  if (first === undefined) return { entries: [], rejected: [] };
  const districtColumn = districtColumnOf(Object.keys(first));
  const entries: DirectoryEntry[] = [];
  const rejected: { line: number; reason: string }[] = [];
  records.forEach((row, index) => {
    const line = index + firstLine;
    const pincode = present(row["pincode"]);
    const officeName = present(row["officename"]);
    const districtName = present(row[districtColumn]);
    const stateName = present(row["statename"]);
    if (pincode === null || !/^[1-9]\d{5}$/u.test(pincode)) {
      rejected.push({ line, reason: `not a pincode: ${pincode ?? "(blank)"}` });
    } else if (officeName === null || districtName === null || stateName === null) {
      rejected.push({ line, reason: "office, district or state is blank" });
    } else {
      entries.push({
        pincode,
        officeName,
        officeType: present(row["officetype"]),
        districtName,
        stateName,
      });
    }
  });
  return { entries, rejected };
}

/** A CSV export, header first. */
export function parseDirectory(text: string): ParsedDirectory {
  const [header, ...body] = csvRows(text.replace(/^\uFEFF/u, ""));
  if (header === undefined) throw new Error("The directory file is empty.");
  const names = header.map((name) => name.trim().toLowerCase());
  districtColumnOf(names);
  return readRecords(
    body.map((row) => Object.fromEntries(names.map((name, i) => [name, row[i]]))),
    2,
  );
}

/** Records from the data.gov.in API, keyed by the catalogue's field ids. */
export function parseApiRecords(records: readonly DirectoryRecord[]): ParsedDirectory {
  return readRecords(records.map(lowerKeys), 1);
}
