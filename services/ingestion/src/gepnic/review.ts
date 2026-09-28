import type pg from "pg";

import { districtKey } from "./detail";

/**
 * The review list: every held tender no rule could place and no reviewer has
 * decided, grouped so that one reading covers many.
 *
 * GROUPED BY ISSUING OFFICE
 * The deepest segment of the organisation chain is the office that issued the
 * tender. An office issues many, and they usually share an answer — a district
 * office's tenders sit in its district; a state directorate's name none — so a
 * reviewer reads the office once rather than each tender in turn.
 *
 * HINTS ARE READINGS, NEVER DECISIONS
 * Each group says what its tenders' own text names: one district of the state,
 * several, or no place at all. None of it places anything. A location that
 * names a district is the tender's text, but the resolver does not act on it
 * (ADR-067 reads the chain and the directory); a reviewer who agrees records
 * that with `tenders:place`, signed and reasoned. The CSV's `decision` column
 * is left empty for that reason, beside a separate `suggested_district`.
 */

export interface ReviewRow {
  readonly portalCode: string;
  readonly portalTenderId: string;
  readonly organisationChain: string | null;
  readonly location: string | null;
  readonly pincode: string | null;
}

export interface District {
  readonly name: string;
  readonly lgdCode: string;
}

export type Hint =
  | {
      readonly kind: "names_district";
      readonly district: District;
      /** How many of the group's tenders name it; the rest name no district. */
      readonly namedBy: number;
      readonly of: number;
    }
  | { readonly kind: "names_several"; readonly districts: readonly District[] }
  | { readonly kind: "names_no_place" }
  | { readonly kind: "town_or_office" };

export interface ReviewGroup {
  /** The issuing office, as the chain spells it; "(no chain)" when there is none. */
  readonly office: string;
  readonly chain: string | null;
  readonly hint: Hint;
  readonly tenders: readonly ReviewRow[];
  /** Distinct locations and pincodes, most common first, for the reader's eye. */
  readonly locations: readonly string[];
  readonly pincodes: readonly string[];
}

/** Locations that say nothing about where: "As Per Tender Document", "services", "NA". */
const NO_PLACE =
  /^(?:as per (?:the )?tender(?: document)?|services?|n\.?\s?a\.?|nil|-+|various|state ?wide)$/iu;

/** A name with its vowels kept: letters only, repeats collapsed, the district word dropped. */
function strictKey(name: string): string {
  return name
    .replace(/\b(?:district|distt?|zilla|zila|jilla|jila)\b\.?/giu, " ")
    .toLowerCase()
    .replace(/[^a-z]/gu, "")
    .replace(/(.)\1+/gu, "$1");
}

/**
 * Shortest word whose vowel-less match is trusted as a hint. The ledger's
 * comparison drops vowels, which is safe for a state's few dozen district names
 * and not for the towns in a location: "Singa" and "Siang" collide. A shorter
 * word must match with its vowels.
 */
const MIN_LOOSE_HINT = 6;

/**
 * The districts a piece of the tender's own text names. A match must be exact
 * with vowels kept, or a vowel-less match on a word long enough to trust.
 */
export function districtsNamedIn(
  text: string | null,
  districts: ReadonlyMap<string, District>,
): District[] {
  if (text === null) return [];
  const named = new Map<string, District>();
  const pieces = text.split(/[,|/()]+|\s-\s|\band\b/iu).map((p) => p.trim());
  for (const piece of pieces) {
    const key = districtKey(piece);
    const district = key === "" ? undefined : districts.get(key);
    if (district === undefined) continue;
    const exact = strictKey(piece) === strictKey(district.name);
    if (exact || strictKey(piece).length >= MIN_LOOSE_HINT) named.set(district.lgdCode, district);
  }
  return [...named.values()];
}

/** Whether a tender says anything about where at all: a real location or a pincode. */
function saysWhere(row: ReviewRow): boolean {
  const location = row.location?.trim() ?? "";
  if (location !== "" && !NO_PLACE.test(location)) return true;
  return (row.pincode?.trim() ?? "") !== "";
}

/** The districts one tender's own text names: its location, and its chain below the department. */
export function districtsNamedBy(
  row: ReviewRow,
  districts: ReadonlyMap<string, District>,
): District[] {
  const chain = (row.organisationChain ?? "").split("||").slice(1).join(",");
  const named = new Map<string, District>();
  for (const d of [
    ...districtsNamedIn(row.location, districts),
    ...districtsNamedIn(chain, districts),
  ]) {
    named.set(d.lgdCode, d);
  }
  return [...named.values()];
}

/** What a group's own text names, read over every tender in it. */
function hintFor(rows: readonly ReviewRow[], districts: ReadonlyMap<string, District>): Hint {
  const named = new Map<string, District>();
  let namedBy = 0;
  for (const row of rows) {
    const found = districtsNamedBy(row, districts);
    if (found.length > 0) namedBy++;
    for (const d of found) named.set(d.lgdCode, d);
  }
  const all = [...named.values()];
  const [only] = all;
  if (all.length === 1 && only !== undefined) {
    return { kind: "names_district", district: only, namedBy, of: rows.length };
  }
  if (all.length > 1) return { kind: "names_several", districts: all };
  return rows.some(saysWhere) ? { kind: "town_or_office" } : { kind: "names_no_place" };
}

function byFrequency(values: readonly (string | null)[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const t = v?.trim() ?? "";
    if (t !== "") counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

/** The office that issued a tender: the chain's deepest segment. */
export function officeOf(chain: string | null): string {
  const segments = (chain ?? "")
    .split("||")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  return segments.at(-1) ?? "(no chain)";
}

export function groupForReview(
  rows: readonly ReviewRow[],
  districts: ReadonlyMap<string, District>,
): ReviewGroup[] {
  const groups = new Map<string, ReviewRow[]>();
  for (const row of rows) {
    const key = officeOf(row.organisationChain).toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.values()]
    .map((tenders) => {
      const chain = tenders[0]?.organisationChain ?? null;
      return {
        office: officeOf(chain),
        chain,
        hint: hintFor(tenders, districts),
        tenders,
        locations: byFrequency(tenders.map((t) => t.location)),
        pincodes: byFrequency(tenders.map((t) => t.pincode)),
      };
    })
    .sort((a, b) => b.tenders.length - a.tenders.length || a.office.localeCompare(b.office));
}

export function describeHint(hint: Hint): string {
  switch (hint.kind) {
    case "names_district":
      return hint.namedBy === hint.of
        ? `names ${hint.district.name} (LGD ${hint.district.lgdCode})`
        : `names ${hint.district.name} (LGD ${hint.district.lgdCode}) in ${String(hint.namedBy)} of ${String(hint.of)}; the rest name no district`;
    case "names_several":
      return `names several districts: ${hint.districts.map((d) => `${d.name} (${d.lgdCode})`).join(", ")}`;
    case "names_no_place":
      return "names no place";
    case "town_or_office":
      return "a town or office only";
  }
}

/** The state's districts, keyed as the ledger compares names, with their LGD codes. */
export async function districtIndex(
  db: pg.ClientBase,
  stateLgdCode: string,
): Promise<ReadonlyMap<string, District>> {
  const result = await db.query<{ name_en: string; lgd_code: string }>(
    `SELECT d.name_en, d.lgd_code
       FROM admin_unit d
       JOIN admin_unit s ON s.id = d.parent_id
      WHERE d.level = 'district' AND s.level = 'state' AND s.lgd_code = $1`,
    [stateLgdCode],
  );
  return new Map(
    result.rows.map((r) => [districtKey(r.name_en), { name: r.name_en, lgdCode: r.lgd_code }]),
  );
}

/** Held tenders of one state that are unplaced and that no reviewer has decided. */
export async function unplacedForReview(
  db: pg.ClientBase,
  stateLgdCode: string,
): Promise<ReviewRow[]> {
  const result = await db.query<{
    portal_code: string;
    portal_tender_id: string;
    organisation_chain: string | null;
    location: string | null;
    pincode: string | null;
  }>(
    `SELECT t.portal_code, t.portal_tender_id, t.organisation_chain, t.location, t.pincode
       FROM tender t
       JOIN tender_collection_window w ON w.portal_code = t.portal_code
      WHERE w.state_lgd_code = $1 AND t.admin_unit_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM tender_district_decision d WHERE d.tender_id = t.id)
      ORDER BY t.id`,
    [stateLgdCode],
  );
  return result.rows.map((r) => ({
    portalCode: r.portal_code,
    portalTenderId: r.portal_tender_id,
    organisationChain: r.organisation_chain,
    location: r.location,
    pincode: r.pincode,
  }));
}

/** RFC 4180: quote every field, double any quote inside it. */
function csvField(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

/**
 * One row per tender, grouped and hinted. `suggested_district` is what that
 * tender's own text names, when it names exactly one district — never the
 * group's, which could carry one tender's district onto another. `decision`
 * and `reason` are left for the reviewer, who records each with `tenders:place`.
 */
export function reviewCsv(
  state: string,
  groups: readonly ReviewGroup[],
  districts: ReadonlyMap<string, District>,
): string {
  const header = [
    "state",
    "group",
    "office",
    "hint",
    "suggested_district",
    "portal",
    "tender",
    "organisation_chain",
    "location",
    "pincode",
    "decision",
    "reason",
  ];
  const lines = [header.join(",")];
  groups.forEach((group, index) => {
    for (const t of group.tenders) {
      const own = districtsNamedBy(t, districts);
      const suggested = own.length === 1 ? (own[0]?.lgdCode ?? "") : "";
      const fields = [
        state,
        String(index + 1),
        group.office,
        describeHint(group.hint),
        suggested,
        t.portalCode,
        t.portalTenderId,
        t.organisationChain ?? "",
        t.location ?? "",
        t.pincode ?? "",
        "",
        "",
      ];
      lines.push(fields.map(csvField).join(","));
    }
  });
  return `${lines.join("\n")}\n`;
}
