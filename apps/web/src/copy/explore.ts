/**
 * The explorer's prose (ADR-059, rule B). Most of it says what an absence
 * means — not held, not located, not verified yet — and must never let an
 * empty panel read as a statement about a place or a government.
 */

export const exploreCopy = {
  notice:
    "Official records only. Every figure shown has been checked by a person against the page it was read from.",

  noBoundaryHeld: "No boundary is held for anything inside this place.",

  attributionTail: "Boundaries © OpenStreetMap contributors (ODbL) · MapLibre GL",
  mapUnavailableHeading: "The map could not be drawn",
  /**
   * Only the map canvas fails; the panels beside it keep working. There is no
   * works list — no register of works exists — so this names what does remain.
   */
  mapUnavailableFallback:
    "The records and tenders held for a place do not need the map: choose the place with the selectors beside it, or use search.",

  documentNothingVerified:
    "Nothing in this document has been verified yet, so nothing from it is shown. Its candidates are extracted and awaiting review.",
} as const;

export const recordsCopy = {
  selectState: "Select a state to see the records held for it.",
  loadFailed: "Records could not be loaded. This is a fault here, not an absence of records.",
  noneAttributed: (scope: string): string => `No records are currently attributed to ${scope}.`,
  /** The sentence that stops the one above being read as a finding. */
  noneAttributedMeaning:
    "That describes what is held here, not what has been audited or spent in this area. Reports are attributed only where the source establishes the geography they concern — the office that issued a report is not the area it audits.",

  noWorks:
    "None. No register of individual works has been located for this area, so there is nothing to draw.",
  worksRegister: "— the state PWD site publishes none; its “Projects” section is a photo gallery.",
  tendersAndAwards: "— the procurement portals gate search and bid awards behind a CAPTCHA.",
  roadGeometry: "— no government source located.",
  pmgsy: "— located, but its terms forbid republication.",
  recordedIn: "Recorded in",
  matrixLink: "the data availability matrix",
  recordedWhen: ", with the date each source was checked.",
} as const;

export const searchCopy = {
  unavailable: "Search is unavailable. The place selectors still work.",
  noMatch: (term: string): string =>
    `Nothing held matches “${term}”. Only places and records already ingested are searchable.`,
} as const;
