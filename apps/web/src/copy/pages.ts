/**
 * Page-level prose (ADR-059, rule B), reviewed here rather than in each route.
 * The states these sentences distinguish — not published, not collected, not
 * yet checked — are the ones `.docs/17-legal/legal-ethical-rules.md` says must
 * never be confused, so their wording lives in one place.
 */

export const documentsCopy = {
  intro:
    "Documents published by government bodies and held here in full. A figure appears on this site only after a person has checked it against the page it was read from.",
  noneCollected: "No documents have been collected yet.",
  nothingPublished:
    "Nothing from this document is published yet. The document itself is linked below and can be read in full.",
} as const;

export const exploreSetupCopy = {
  heading: "The map needs its boundary geometry",
  notCommitted:
    "Boundary geometry is generated from the ledger and is not committed to this repository. The command above fetches and simplifies it into apps/web/public/geo, which is gitignored.",
} as const;

export const unitsCopy = {
  fromDirectory: (count: number): string =>
    `${String(count)} units, from the Local Government Directory.`,
  subUnitsNotCollected:
    "Sub-units for this unit have not been collected yet. The Local Government Directory publishes them; they are not part of the current dataset.",
} as const;

export const departmentCopy = {
  nameByCodeOnly:
    "The treasury system publishes this department by code only. Its name is not part of the published data.",
  varianceCaption:
    "Release variance is released minus spent. Allocation variance is allocated minus spent. They answer different questions and are not interchangeable.",
  expenditureWithheldHeading: (firstYear: string | number): string =>
    `Expenditure is not shown before FY ${String(firstYear)}.`,
  expenditureWithheld:
    "The treasury system records a zero against most schemes in those years rather than an amount, so the figures it publishes do not describe what was spent. Allocation and release are shown as published; expenditure and the two variances are withheld rather than presented as a comparison that would not be accurate.",
  conflictHeading: "† Two government reports publish different allocation figures.",
  /** `scope` is "FY 2019" or "2 of these years"; `alternates` lists the export's figures. */
  conflictBody: (scope: string, alternates: string): string =>
    `For ${scope}, the departmental actuals report and the scheme-wise budget export do not agree. The figure shown is from the actuals report; the scheme-wise export gives ${alternates}. Released and spent agree exactly between the two reports; only the allocation differs, and which definition each uses has not been established. The`,
  conflictColumn: "allocated minus spent",
  conflictTail: "column inherits this uncertainty.",
} as const;

/**
 * A government or department page (ADR-074). Every sentence here describes what
 * a mention is and is not: a reviewed report page that names the body, never a
 * claim that the page's figures are about it.
 */
export const bodiesCopy = {
  kindLabel: { government: "Government", department: "Department" },
  governs: (place: string): string => `Governs ${place}`,
  partOf: "Part of",
  whatThisIs:
    "Each entry below is a page of a published audit report that names this body. A person has checked that the page prints this name. The figures on those pages are not attributed to this body here; open the report to read them in their context.",
  notShown:
    "Only what published audit reports say is shown here. Budgets, spending, tenders and works for this body are not shown: each is either not collected or held under terms that do not yet permit publishing it.",
  departmentsHeading: "Departments named in the reports held",
  reportsHeading: "Reports that name it",
  namedIn: (count: number): string =>
    count === 1 ? "Named in 1 report" : `Named in ${String(count)} reports`,
  page: (n: number): string => `Page ${String(n)}`,
  openReport: "Open the report",
  originalDocument: "Original document",
  retrieved: (date: string): string => `Retrieved ${date}`,
  publishedOn: (date: string): string => `Published ${date}`,
  datasetVersion: (v: number): string => `Dataset version ${String(v)}`,
  unitSectionHeading: "Governments and departments",
  unitSectionNone:
    "No government or department has yet been confirmed from the audit reports held for this place. That says what has been reviewed, not that this place has none.",
} as const;
