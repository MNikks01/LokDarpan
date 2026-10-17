/**
 * What the site says about places named in audit reports (ADR-077).
 *
 * The one claim these sentences make is that a published audit page names a
 * place. They never say the page's figures were spent there, or that the
 * report found anything about the place: the report's own words, cited, say
 * what it says. Kept together for the neutrality gate (rule B, ADR-059).
 */

const pages = (n: number): string => `${n.toLocaleString("en-IN")} ${n === 1 ? "page" : "pages"}`;
const reports = (n: number): string =>
  `${n.toLocaleString("en-IN")} ${n === 1 ? "report" : "reports"}`;

export const placesCopy = {
  heading: (place: string): string => `Where published audit reports name ${place}`,
  intro:
    "Each entry is a page of a report by the Comptroller and Auditor General that a person has confirmed names this place. Open a page to read what the report says in its own words.",
  disclaimer:
    "These are pages of official audit reports, cited as published. Naming a place is not a statement that a page's figures were spent there, and nothing here is a finding by LokDarpan about any person or body.",
  none: "No reviewed audit page names this place yet. That says what has been reviewed, not that no report concerns it.",
  unavailable:
    "The audit pages naming this place could not be loaded just now. This is a fault here, not a statement about any report.",
  namedOn: (n: number): string => `Named on ${pages(n)}`,
  page: (n: number): string => `Page ${n.toLocaleString("en-IN")}`,
  openPage: "Open this page of the report",
  openRecord: "The report in LokDarpan",

  /** The map pin's tooltip. A count of pages, never a ranking of places. */
  pinSubtitle: (p: number, r: number): string => `Named on ${pages(p)} of ${reports(r)}`,
  layerLabel: "Places named in audit reports",
  layerNote:
    "A pin where a reviewed audit page names the district or taluka. It marks a mention, not where money was spent.",
} as const;
