import { LEVEL_LABEL, type Holding, type HoldingHeadline } from "@lokdarpan/domain";

import { longDate } from "./home";

/**
 * What a page says LokDarpan holds for a place (LD-009, ADR-076).
 *
 * Every sentence here is a claim about LokDarpan's collection, written so it
 * cannot be read as a claim about what a government published. "Not collected"
 * means nobody here has collected it; it never means the record does not exist.
 * Kept together so the set can be reviewed as one (rule B, ADR-059), and
 * checked by the neutrality gate.
 */

/** The word each row leads with. Words, not colours: no state here is a warning. */
const HEADLINE: Readonly<Record<HoldingHeadline, string>> = {
  held: "Held",
  current: "Held, collected daily",
  partial: "Partly held",
  stale: "Held, not recently collected",
  failing: "Held, last collection did not complete",
  withheld: "Held, not shown",
  not_collected: "Not collected",
  unknown: "Not known",
  loading: "Loading",
  unavailable: "Could not be loaded",
};

const n = (value: number): string => value.toLocaleString("en-IN");

function layerName(h: Holding): string {
  switch (h.layer) {
    case "boundaries":
      return h.level === null ? "Boundaries" : `${LEVEL_LABEL[h.level]} boundaries`;
    case "audit_reports":
      return "Audit reports";
    case "tenders":
      return "Open tenders";
    case "budget":
      return "Budget, release and expenditure";
    case "works":
      return "Progress of individual works";
  }
}

/** The state a record is filed under, or the page's own place where that is the state. */
function forPlace(h: Holding, place: string): string {
  return `for ${h.filedUnder?.name ?? place}`;
}

/** Said on a page below the state, after a row whose records are kept by state. */
function byState(h: Holding, sentence: string): string {
  return h.filedUnder === null ? "" : ` ${sentence}`;
}

const REPORTS_BY_STATE = "Reports are filed by state, not by district or taluka.";
const TENDERS_BY_STATE = "Tenders are collected from each state's portal, not by district.";
const BUDGETS_BY_STATE = "Budgets are held by state, not by district or taluka.";

function boundaries(h: Holding, headline: HoldingHeadline): string {
  const level = h.level === null ? "unit" : LEVEL_LABEL[h.level].toLowerCase();
  if (headline === "not_collected") {
    return `No ${level} boundary is held here. They have not been collected for this place.`;
  }
  const held = h.count === null ? "" : `${n(h.count)} held. `;
  return headline === "partial" && h.state.note !== null ? `${held}${h.state.note}` : held.trim();
}

function auditReports(h: Holding, headline: HoldingHeadline, place: string): string {
  if (headline === "not_collected") {
    return `No audit report has been collected ${forPlace(h, place)}.`;
  }
  const count =
    h.count === null
      ? "Reports are held"
      : `${n(h.count)} ${h.count === 1 ? "report" : "reports"} of the Comptroller and Auditor General ${h.count === 1 ? "is" : "are"} held`;
  const filed = byState(h, REPORTS_BY_STATE);
  const last =
    h.state.lastSuccessAt === null
      ? ""
      : ` Most recently retrieved ${longDate(h.state.lastSuccessAt)}.`;
  return `${count} ${forPlace(h, place)}.${filed}${last}`;
}

function tenders(h: Holding, headline: HoldingHeadline, place: string): string {
  const s = h.state;
  if (headline === "not_collected") {
    return `Tenders are not collected ${forPlace(h, place)}.${byState(h, TENDERS_BY_STATE)} This describes what LokDarpan holds, not what has been advertised.`;
  }
  if (headline === "failing") {
    return `The most recent collection did not complete.${s.lastSuccessAt === null ? "" : ` Last successful collection ${longDate(s.lastSuccessAt)}.`}`;
  }
  if (headline === "stale") {
    return `Last collected ${s.lastSuccessAt === null ? "on an unrecorded date" : longDate(s.lastSuccessAt)}, longer ago than the daily schedule expects.`;
  }
  const since =
    s.collectingSince === null
      ? ""
      : ` Collected since ${longDate(s.collectingSince)}; tenders advertised before then are not held.`;
  const details =
    h.showing === "counts_only"
      ? " Counts are shown; the tenders' details are not, because the portals permit reproducing them only with the issuing department's permission."
      : "";
  return `Collected from the e-procurement portal of ${h.filedUnder?.name ?? place}.${since}${details}`;
}

function budget(h: Holding, headline: HoldingHeadline, place: string): string {
  if (headline === "not_collected") {
    return `Budget figures have not been collected ${forPlace(h, place)}.`;
  }
  const loaded =
    h.state.lastSuccessAt === null ? "" : ` Last loaded ${longDate(h.state.lastSuccessAt)}.`;
  if (headline === "withheld") {
    return `Figures from the Finance Department's budget system are held ${forPlace(h, place)}, and are not shown: its terms permit reproducing them only with the department's permission, which is not yet recorded.${byState(h, BUDGETS_BY_STATE)}${loaded}`;
  }
  const count = h.count === null ? "" : ` for ${n(h.count)} departments`;
  return `Figures from the Finance Department's budget system are held${count} ${forPlace(h, place)}.${byState(h, BUDGETS_BY_STATE)}${loaded}`;
}

const WORKS =
  "No register of individual public works that may be republished has been identified in the sources reviewed. The one found, the rural roads register (PMGSY's OMMAS), may not be copied without written permission. This describes what LokDarpan holds, not whether work is under way.";

export const holdingsCopy = {
  heading: "What LokDarpan holds here",
  intro:
    "Each kind of record LokDarpan deals in, and whether it is held and shown, held and not shown, or not collected for this place. None of these is a statement about what a government has published.",
  headline: (h: HoldingHeadline): string => HEADLINE[h],
  layer: layerName,
  /** The sentence under a row's headline, with its dates. */
  detail: (h: Holding, headline: HoldingHeadline, place: string): string => {
    switch (h.layer) {
      case "boundaries":
        return boundaries(h, headline);
      case "audit_reports":
        return auditReports(h, headline, place);
      case "tenders":
        return tenders(h, headline, place);
      case "budget":
        return budget(h, headline, place);
      case "works":
        return WORKS;
    }
  },
  unavailable:
    "What is held for this place could not be loaded just now. This is a fault here, not a statement about any record.",
} as const;
