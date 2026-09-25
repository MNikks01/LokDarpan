import type pg from "pg";

import { districtKey, normalise } from "./detail";

/**
 * Which district a tender belongs to, and how that was decided.
 *
 * ORDER, AND WHY IT IS NOT A SCORE
 * explicit district → pincode → place name → unresolved. The first rule that
 * answers wins; no rule is weighed against another. A tender whose chain names
 * a district is placed there even when its pincode says otherwise, because the
 * chain is the portal's statement and the pincode is our reading of a
 * directory. Unresolved is an outcome, not a failure: it goes to review.
 *
 * EVERY INFERENCE IS SCOPED TO ONE STATE AND MUST BE UNANIMOUS
 * A pincode whose offices sit in two districts, or a place name that is an
 * office in two districts, places nothing. The directory's district must also
 * resolve to one of the ledger's districts in the portal's state; a directory
 * spelling the ledger does not hold (a renamed or newly created district)
 * places nothing either. A wrong district is a false statement about where
 * public money goes; a missing one is visibly missing.
 *
 * CONFIDENCE
 * chain_unit 0.9 and office_code 0.6 are unchanged. A pincode is the delivery
 * area of the issuing office's address, which is usually but not necessarily
 * where the work is: 0.6, level with an office code. A place name matched to a
 * post office is weaker again, since offices share names with villages
 * elsewhere in the state: 0.4.
 */

export type Method = "chain_unit" | "office_code" | "pincode" | "place_name";

export interface Resolution {
  readonly adminUnitId: number | null;
  readonly method: Method | null;
  readonly confidence: number | null;
  /** The directory artefact an inference was read from; null for the tender's own page. */
  readonly evidenceSha256: string | null;
  /** What was matched: the pincode, or the office name as the directory spells it. */
  readonly evidenceKey: string | null;
}

export const UNRESOLVED: Resolution = {
  adminUnitId: null,
  method: null,
  confidence: null,
  evidenceSha256: null,
  evidenceKey: null,
};

const CONFIDENCE: Readonly<Record<Method, number>> = {
  chain_unit: 0.9,
  office_code: 0.6,
  pincode: 0.6,
  place_name: 0.4,
};

/** What the resolver reads from a tender. Every field may be absent. */
export interface TenderClues {
  /** A district the organisation chain named, and how (see `districtFromChain`). */
  readonly districtName: string | null;
  readonly districtSource: "chain_unit" | "office_code" | null;
  readonly pincode: string | null;
  readonly location: string | null;
}

/** The directory, for one state, indexed for the two lookups. */
export interface StateDirectory {
  /** Null when no directory is loaded for this state: nothing is inferred. */
  readonly sha256: string | null;
  /** Pincode → the district keys its offices sit in. */
  readonly byPincode: ReadonlyMap<string, ReadonlySet<string>>;
  /** Place key → the district keys an office of that name sits in, and its spelling. */
  readonly byPlace: ReadonlyMap<string, { readonly districts: Set<string>; readonly name: string }>;
}

export const EMPTY_DIRECTORY: StateDirectory = {
  sha256: null,
  byPincode: new Map(),
  byPlace: new Map(),
};

/** `Manampoondi B.O` → `Manampoondi`. The office's grade is not part of the place. */
const OFFICE_GRADE = /\s+(?:[bshg]\.?\s?o\.?|gpo|head office|sub office|branch office)\s*$/iu;

/**
 * How a place name is compared.
 *
 * Stricter than `districtKey`: vowels are kept. There are a few dozen districts
 * in a state but thousands of post offices, and dropping vowels across that
 * many names collides places that are genuinely different.
 */
export function placeKey(name: string): string {
  return name
    .replace(OFFICE_GRADE, "")
    .toLowerCase()
    .replace(/[^a-z]/gu, "")
    .replace(/(.)\1+/gu, "$1");
}

/** Shortest place name tested at all; short tokens match too readily. */
const MIN_PLACE_KEY = 5;

function only<T>(values: ReadonlySet<T> | undefined): T | undefined {
  if (values?.size !== 1) return undefined;
  const [value] = values;
  return value;
}

/** 1. The tender names its district. */
function explicitly(
  clues: TenderClues,
  districts: ReadonlyMap<string, number>,
): Resolution | undefined {
  if (clues.districtName === null || clues.districtSource === null) return undefined;
  const id = districts.get(districtKey(clues.districtName));
  if (id === undefined) return undefined;
  return {
    adminUnitId: id,
    method: clues.districtSource,
    confidence: CONFIDENCE[clues.districtSource],
    evidenceSha256: null,
    evidenceKey: null,
  };
}

/** 2. Its pincode sits in exactly one district of this state. */
function byPincode(
  clues: TenderClues,
  districts: ReadonlyMap<string, number>,
  directory: StateDirectory,
): Resolution | undefined {
  const pincode = clues.pincode?.trim() ?? "";
  if (!/^[1-9]\d{5}$/u.test(pincode)) return undefined;
  const key = only(directory.byPincode.get(pincode));
  const id = key === undefined ? undefined : districts.get(key);
  if (id === undefined) return undefined;
  return {
    adminUnitId: id,
    method: "pincode",
    confidence: CONFIDENCE.pincode,
    evidenceSha256: directory.sha256,
    evidenceKey: pincode,
  };
}

/** 3. Its location is the name of post offices in exactly one district. */
function byPlace(
  clues: TenderClues,
  districts: ReadonlyMap<string, number>,
  directory: StateDirectory,
): Resolution | undefined {
  const place = clues.location === null ? "" : placeKey(clues.location);
  if (place.length < MIN_PLACE_KEY) return undefined;
  const entry = directory.byPlace.get(place);
  const key = only(entry?.districts);
  const id = key === undefined ? undefined : districts.get(key);
  if (id === undefined || entry === undefined) return undefined;
  return {
    adminUnitId: id,
    method: "place_name",
    confidence: CONFIDENCE.place_name,
    evidenceSha256: directory.sha256,
    evidenceKey: entry.name,
  };
}

export function resolveDistrict(
  clues: TenderClues,
  districts: ReadonlyMap<string, number>,
  directory: StateDirectory,
): Resolution {
  const named = explicitly(clues, districts);
  if (named !== undefined) return named;
  if (directory.sha256 === null) return UNRESOLVED;
  // 4. Unresolved: held, counted as unplaced, and listed for review.
  return (
    byPincode(clues, districts, directory) ?? byPlace(clues, districts, directory) ?? UNRESOLVED
  );
}

export interface DirectoryRow {
  readonly pincode: string;
  readonly officeName: string;
  readonly districtName: string;
}

export function indexDirectory(
  sha256: string | null,
  rows: readonly DirectoryRow[],
): StateDirectory {
  if (sha256 === null || rows.length === 0) return EMPTY_DIRECTORY;
  const pincodes = new Map<string, Set<string>>();
  const places = new Map<string, { districts: Set<string>; name: string }>();
  for (const row of rows) {
    const district = districtKey(row.districtName);
    if (district === "") continue;
    const codes = pincodes.get(row.pincode) ?? new Set<string>();
    codes.add(district);
    pincodes.set(row.pincode, codes);

    const place = placeKey(row.officeName);
    if (place.length < MIN_PLACE_KEY) continue;
    const entry = places.get(place) ?? {
      districts: new Set<string>(),
      name: row.officeName.replace(OFFICE_GRADE, "").trim(),
    };
    entry.districts.add(district);
    places.set(place, entry);
  }
  return { sha256, byPincode: pincodes, byPlace: places };
}

/**
 * The directory's rows for the state whose ledger name is given.
 *
 * The directory spells states its own way (`TAMIL NADU`, `JAMMU AND KASHMIR`),
 * so the match is on `normalise`, over the directory's short list of distinct
 * state names, rather than on the text. Only the newest load is read, so two
 * loads are never mixed.
 */
export async function directoryForState(
  db: pg.ClientBase,
  stateName: string,
): Promise<StateDirectory> {
  const wanted = normalise(stateName.replace(/&/gu, " and "));
  const states = await db.query<{ state_name: string }>(
    `SELECT DISTINCT state_name FROM pincode_office`,
  );
  const names = states.rows
    .map((r) => r.state_name)
    .filter((name) => normalise(name.replace(/&/gu, " and ")) === wanted);
  if (names.length === 0) return EMPTY_DIRECTORY;

  const rows = await db.query<{
    pincode: string;
    office_name: string;
    district_name: string;
    source_sha256: string;
  }>(
    `SELECT p.pincode, p.office_name, p.district_name, p.source_sha256
       FROM pincode_office p
      WHERE p.state_name = ANY($1)
        AND p.dataset_version_id = (SELECT max(dataset_version_id) FROM pincode_office)`,
    [names],
  );
  const sha256 = rows.rows[0]?.source_sha256 ?? null;
  return indexDirectory(
    sha256,
    rows.rows.map((r) => ({
      pincode: r.pincode,
      officeName: r.office_name,
      districtName: r.district_name,
    })),
  );
}
