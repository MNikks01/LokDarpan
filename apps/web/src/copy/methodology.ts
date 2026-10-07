/**
 * The methodology page (LD-005): how every figure on the site came to be there.
 *
 * Kept beside the neutrality list (ADR-059, rule B). Each source entry is keyed
 * by its registry id in `@lokdarpan/domain`'s licence registry, and a test
 * fails if a registered source has no entry here — a source is explained before
 * it is shown, not after.
 */

export interface SourceMethod {
  /** What we take from the source. */
  readonly collects: string;
  /** How it is collected. */
  readonly how: string;
  /** What a reader sees of it. */
  readonly shown: string;
}

export const methodologyCopy = {
  title: "Data sources and methodology",
  intro:
    "Every figure on this site is read from an official record and linked to it. This page sets out where each kind of record comes from, how it is read, what a person checks before it is shown, and what is not shown and why.",

  sourcesHeading: "Sources",
  sourcesIntro:
    "Whether a source may be collected is decided by its robots.txt. Whether it may be shown is decided by its publisher's stated terms, recorded below as they were read. A source whose terms require permission is not shown until that permission is recorded, and a source whose terms were not found is treated the same way.",
  termsLabel: "Terms",
  termsReadOn: (date: string): string => `read on ${date}`,
  republication: {
    permitted: "Reproduction permitted with attribution",
    permission_required: "Reproduction only with the publisher's permission",
    unknown: "Terms not found",
  },

  sources: {
    lgd: {
      collects:
        "The administrative hierarchy: states, districts and the units below them, with their official codes and names.",
      how: "Read from the Local Government Directory's published lists. A unit keeps its directory code as its identity.",
      shown: "Shown: place names, codes and the hierarchy.",
    },
    cag: {
      collects:
        "Audit reports of the Comptroller and Auditor General, page by page, and the figures and names read from their text.",
      how: "Each report's PDF is kept unaltered. Figures and names are read as candidates; a person checks each against its page before it is shown.",
      shown:
        "Shown: the reports, and every figure and name a person has verified, each cited to its page.",
    },
    openstreetmap: {
      collects: "Boundary outlines for states and districts.",
      how: "Read from OpenStreetMap, matched to the Local Government Directory by the directory codes OpenStreetMap carries, and simplified for display.",
      shown:
        "Shown: outlines on the map. An outline is OpenStreetMap's, not a government statement of the boundary.",
    },
    gepnic: {
      collects: "Open tenders advertised on 21 state e-procurement portals.",
      how: "Collected nightly from each portal's public pages, where its robots.txt permits. A tender advertisement is a notice of intent to buy, not an award.",
      shown:
        "Shown: counts by district and a link to each state's portal. Tender details are not shown until the issuing departments permit it.",
    },
    beams: {
      collects: "Maharashtra's departmental budget, release and expenditure figures.",
      how: "Read from the Finance Department's budget system exports.",
      shown:
        "Not shown. Collected for internal consistency checks only, until the Finance Department permits reproduction.",
    },
    pmgsy: {
      collects: "Nothing. The rural roads works register (OMMAS) records works and their progress.",
      how: "Not collected: its terms do not permit copying without written permission.",
      shown: "Not shown.",
    },
  } satisfies Readonly<Record<string, SourceMethod>>,

  reviewHeading: "How a figure from a report reaches this site",
  review: [
    "The report is fetched once and kept unaltered. Its SHA-256 hash identifies it, so the bytes a figure cites are provably the bytes that were retrieved.",
    "Its pages are read as text. A page with no text layer is read by an optical character recognition engine; a figure read that way is marked as such wherever it is shown, with the engine that read it and how clearly the engine could see the characters.",
    "A parser proposes candidates: an amount with its unit, or a name. It refuses where the sentence does not settle what a figure is. A rate is kept only with the unit it is per, as the page words it.",
    "A person checks each candidate against its page and verifies it, corrects it, or rejects it. Only verified and corrected figures are shown, and every decision is kept with its history.",
    "A figure printed in both the Marathi and the English half of a bilingual report is counted once and cited in both places.",
  ],

  derivedHeading: "Figures this site calculates",
  derived: [
    {
      term: "Release variance",
      meaning:
        "Amount released minus amount spent, for the same scheme and year in the same report. Its denominator is the amount released. Used where budget figures are shown; none are shown yet.",
    },
    {
      term: "Allocation variance",
      meaning:
        "Amount allocated minus amount spent, for the same scheme and year in the same report. Its denominator is the amount allocated. It answers a different question from release variance.",
    },
    {
      term: "Insufficient data",
      meaning:
        "Shown instead of a variance when any stage it needs is not published. A missing figure is never treated as zero.",
    },
    {
      term: "Tender counts",
      meaning:
        "The number of open tenders collected for a place, counted from the date collection began on each portal. Before that date nothing is held, which is not the same as nothing advertised.",
    },
  ],

  placementHeading: "How a tender is placed in a district",
  placementIntro:
    "A tender is filed under the district of the office that issued it, where the evidence allows. That is where the office is, not necessarily where the work is. Each placement records how it was made, and with what confidence:",
  placement: [
    { method: "Named in the issuing office's chain", confidence: "0.9" },
    { method: "Named in the tender's location", confidence: "0.7" },
    { method: "Named inside an office's name", confidence: "0.6" },
    { method: "The office's pincode, in the Department of Posts directory", confidence: "0.6" },
    { method: "A post office name matching the location", confidence: "0.4" },
    { method: "Decided by a person reading the tender", confidence: "recorded with the decision" },
  ],
  placementTail:
    "A tender none of these can place stays unplaced and is counted as such. It is never put in a district on a guess.",

  bodiesHeading: "Governments and departments",
  bodies:
    "A government or department appears only where a person has confirmed that a page of a published audit report names it. Its page lists those pages. A page naming a department is not a statement that the figures on that page are about it.",

  confidenceHeading: "Confidence",
  confidence:
    "Two confidences are kept apart. Extraction confidence is the estimate that a figure was read correctly from its page. Linkage confidence is how firmly a record is connected to a place or body. Neither is a judgement about whether the government's statement is true.",

  freshnessHeading: "Dates and versions",
  freshness:
    "Every figure carries the date its source was retrieved. Every page states the dataset version it was read from, so the figures on one page come from the same state of the ledger. A report's own publication date is shown only where the report states it.",

  limitsHeading: "What is not here",
  limits: [
    "No register of individual public works has been found that may be republished, so there are no project pages yet.",
    "Contract awards and the firms that won them are not collected: every portal tested places them behind a CAPTCHA.",
    "No score, rank or rating is calculated for any firm, officer or government body.",
  ],

  correctionsHeading: "Reporting a data issue",
  corrections:
    "If a figure, name or placement here does not match its source, report it with the link at the foot of every page. A correction is made by reviewing the source again, and the earlier reading is kept with the reason it changed.",
  aboutLink: "About this explorer",
} as const;

/** The entry for a registry id, or `undefined` for a source with none (a test forbids that). */
export function methodFor(sourceId: string): SourceMethod | undefined {
  const sources: Readonly<Record<string, SourceMethod>> = methodologyCopy.sources;
  return sources[sourceId];
}
