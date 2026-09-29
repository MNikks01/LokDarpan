import { LEVEL_LABEL, type AdminUnitLevel } from "@lokdarpan/domain";

/**
 * What the explorer says about the state of its data, in one place.
 *
 * WHY THESE SENTENCES LIVE HERE
 * Each one is a claim about what LokDarpan holds, written so it cannot be read as
 * a claim about what a government published. That distinction is easy to lose
 * one component at a time. Kept together, the sentences can be reviewed as a
 * set (`.docs/decisions/gods-eye-view-adoption.md`, import rule B).
 *
 * Changing a sentence here changes what a reader is told about a government's
 * records. Treat it as a content change, not a copy edit: the five revised
 * alongside ADR-054 were reviewed before they shipped.
 */

/** A level's name inside a sentence: lower case, except the one that is a proper noun. */
function levelNoun(level: AdminUnitLevel): string {
  const label = LEVEL_LABEL[level];
  return level === "gram_panchayat" ? label : label.toLowerCase();
}

/**
 * The office's own name from an alias evidence key,
 * `alias:Muktsar → Sri Muktsar Sahib` → `Muktsar`; null for any other key.
 */
function aliasedName(evidenceKey: string | null): string | null {
  if (evidenceKey?.startsWith("alias:") !== true) return null;
  return evidenceKey.slice("alias:".length).split(" → ")[0] ?? null;
}

/** The office's name was read as the district under a reviewed alias (ADR-068). */
const ALIASED_NOTE: Readonly<Record<"chain_unit" | "office_code", (name: string) => string>> = {
  chain_unit: (name) =>
    `The issuing office names ${name}, read as this district under a reviewed alias.`,
  office_code: (name) =>
    `Read from an office name, ${name}, taken as this district under a reviewed alias. An office may cover more than one district.`,
};

/** How a district was reached, for every method (ADR-067, ADR-068). */
const PLACEMENT_NOTE: Readonly<Record<string, (evidenceKey: string | null) => string>> = {
  chain_unit: () => "The issuing office names this district.",
  office_code: () => "Read from an office name, which may cover more than one district.",
  location_district: (key) =>
    `The tender's location${key === null ? "" : `, “${key}”,`} names this district; the issuing office's name does not.`,
  pincode: (key) =>
    `Not named by the issuing office. Inferred from its pincode${key === null ? "" : ` ${key}`}, which the Department of Posts lists only in this district.`,
  place_name: (key) =>
    `Not named by the issuing office. Inferred from its location, which matches ${key === null ? "a post office" : `the ${key} post office`} only in this district.`,
  manual: () => "Not named by the issuing office. Placed by a reviewer.",
};

export const tenderCopy = {
  /** The request failed. Nothing is implied about any portal. */
  unavailable:
    "Tender information could not be loaded just now. This is a fault here, not a statement about any portal.",

  notCollected: (stateName: string): string =>
    `Tender data is not currently collected for ${stateName}.`,

  notCollectedMeaning: (stateName: string): string =>
    `This describes what LokDarpan holds, not what has been advertised. No count is shown for ${stateName}, since none would be a measurement of the state rather than of our collection.`,

  failing:
    "The most recent collection attempt did not complete. The tenders shown are the last that were collected successfully.",

  lastSuccess: (date: string): string => ` Last successful collection ${date}.`,

  stale: (date: string): string =>
    `These tenders were last collected on ${date}, longer ago than the daily schedule expects.`,

  window: (date: string): string =>
    `Collected since ${date}. Tenders advertised before that date were published but are not held.`,

  emptyHere:
    "No open tender is held here. This describes what LokDarpan holds, not what was advertised.",

  /** A collected state with nothing to shade. Stated instead of "0 across 0", which reads as a finding. */
  noneShaded: (place: string): string =>
    `No open tender is held for offices in a district of ${place}. This describes what LokDarpan holds, not what was advertised.`,

  notHeldBefore: (date: string): string => ` Tenders from before ${date} are not held.`,

  /** Details withheld under the portals' terms (ADR-056). A count is ours to state. */
  heldHere: (count: number): string =>
    `${String(count)} open ${count === 1 ? "tender is" : "tenders are"} held for offices here.`,

  detailsWithheld:
    "Tender details are not shown. The state portals permit reproducing them only with the issuing department's permission, which LokDarpan has not sought.",

  portalLink: "Read these tenders on the state's e-procurement portal",

  unplacedWithheld: "Their details are not shown, for the same reason as other tenders.",

  /** What the shading counts: where the issuing office is, not where the work is. */
  shadingLead: "Shading counts tenders advertised by government offices",
  shadingLocatedIn: "located in",
  shadingTail:
    "each district. It does not say where the work will be done — an office often tenders for work across several districts.",

  noValue: "No value published for this tender.",
  sourceLink: "Source: the portal this was read from",

  /**
   * How a tender's district was reached (ADR-067). An inferred district always
   * says it was inferred and from what: it is never shown as the tender's own.
   */
  placement: (method: string, evidenceKey: string | null): string => {
    const aliased = aliasedName(evidenceKey);
    if (aliased !== null && (method === "chain_unit" || method === "office_code")) {
      return ALIASED_NOTE[method](aliased);
    }
    return PLACEMENT_NOTE[method]?.(evidenceKey) ?? "";
  },

  /** How much of the shading is LokDarpan's reading rather than the offices' own statement. */
  inferredShading: (count: number): string =>
    `${String(count)} of these ${count === 1 ? "is" : "are"} not named by the issuing office: placed from the tender's location, a pincode, a place name or a reviewer's reading.`,
} as const;

export const boundaryCopy = {
  notCollected: (level: AdminUnitLevel): string =>
    `${LEVEL_LABEL[level]} boundaries have not been collected.`,
  partial: (level: AdminUnitLevel): string => `Not every ${levelNoun(level)} is held.`,
} as const;

/**
 * No record of ever checking. Shown instead of silence, which a reader would take
 * for "checked, and nothing found".
 */
export function notChecked(source: string, place: string): string {
  return `LokDarpan has no record of checking ${source} for ${place}.`;
}
