/**
 * The homepage's prose (ADR-059, rule B).
 *
 * WHAT THIS PAGE MAY CLAIM
 * Only what the ledger holds, or what is explicitly marked as planned. Every
 * number on the page is read from the ledger when the page is built
 * (`server/home-summary.ts`); none is written here. When the ledger cannot be
 * read, the page says so in place of the numbers — never a zero, and never a
 * figure remembered from an earlier build.
 *
 * On 30 September 2026 the ledger holds government boundaries for every state
 * and district, CAG audit reports with figures a person has checked against
 * the page, and open tenders from state portals, counted by district with
 * their details withheld until the issuing departments permit republication.
 * There is no register of works, no contract or contractor data, and no
 * published expenditure (`.docs/00-overview/product-audit-2026-09-29.md`).
 *
 * The page never implies that something absent here is absent from the public
 * record, and nothing on it ranks one place against another.
 */

export type Availability = "available" | "partial" | "planned";

export const availabilityLabel: Readonly<Record<Availability, string>> = {
  available: "Available",
  partial: "Partial",
  planned: "Planned",
};

const n = (value: number): string => value.toLocaleString("en-IN");
const plural = (value: number, one: string, many: string): string =>
  `${n(value)} ${value === 1 ? one : many}`;

/** A date as a reader in India writes it: 30 September 2026. */
export const longDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

export const homeCopy = {
  metaTitle: "LokDarpan — Public records of India, traced to the source",
  metaDescription:
    "Explore official public records by place: audit reports and verified figures cited to the page, government boundaries, and open tenders. Budgets, works and spending are added as sources allow.",

  nav: {
    explore: "Explore",
    reports: "Reports",
    sources: "Sources",
    github: "GitHub",
    cta: "Explore the map",
    menu: "Menu",
  },

  hero: {
    eyebrow: "Public governance intelligence",
    headline: "Public records of India, on one map, traced to the page.",
    lead: "LokDarpan brings official government records into one place you can explore by state and district. Every figure links to the page of the document it was read from.",
    primary: "Explore the map",
    secondary: "See how it works",
    micro: "Start with a place. Open a record. Check the source.",
    mapLabel:
      "A map of India's states. States for which LokDarpan holds audit reports are shaded, and districts with open tenders are marked.",
    legendReports: "Audit reports held",
    legendTenders: "Open tenders placed in a district",
    card: (reports: number, figures: number): string =>
      `${plural(reports, "audit report", "audit reports")} · ${plural(figures, "verified figure", "verified figures")}`,
    cardLink: (stateName: string): string => `Open ${stateName} in the explorer`,
    unavailable:
      "The ledger could not be read when this page was built, so the map shows boundaries only. The counts return when it can be read again.",
    boundaryCredit: (attribution: string, licence: string): string =>
      `Boundaries ${attribution}, ${licence.split(" — ")[0] ?? licence}.`,
    schematicLabel:
      "A schematic of how records connect: a place, the audit report about it, a page, and a verified figure on that page. Planned links to works and tenders are drawn dashed.",
  },

  strip: {
    heading: "What LokDarpan holds today",
    asOf: (date: string, version: number): string =>
      `Read from the ledger on ${date} · dataset version ${n(version)}`,
    unavailable:
      "The ledger could not be read when this page was built. Nothing is shown in place of the counts rather than a number that may be out of date.",
    notRead: "Not read",
    items: {
      states: "States and union territories",
      statesNote: "With boundaries and official codes",
      districts: "Districts",
      districtsNote: "Each on the map with its code",
      reports: "Audit reports",
      reportsNote: (pages: number): string => `${n(pages)} pages read`,
      figures: "Verified figures",
      figuresNote: "Each checked by a person against its page",
      tenders: "Open tenders",
      tendersNote: (portals: number): string =>
        `From ${plural(portals, "state portal", "state portals")}; details withheld`,
    },
  },

  flow: {
    eyebrow: "Connected records",
    heading: "One place. Many government records.",
    body: "Public money moves through records published by different bodies in different places. LokDarpan links each one to the place it concerns, and marks plainly which links it holds today.",
    note: "A planned step has no source LokDarpan may publish yet. That describes LokDarpan's holdings, not whether the government publishes the record.",
    steps: [
      {
        key: "place",
        label: "Place",
        status: "available" as Availability,
        body: "States and districts, with official codes and boundaries.",
      },
      {
        key: "audit",
        label: "Audit",
        status: "available" as Availability,
        body: "CAG reports, and the figures in them a person has checked.",
      },
      {
        key: "tender",
        label: "Tender",
        status: "partial" as Availability,
        body: "Open tenders counted by district; details withheld for now.",
      },
      {
        key: "work",
        label: "Work",
        status: "planned" as Availability,
        body: "Individual works and their progress.",
      },
      {
        key: "contractor",
        label: "Contractor",
        status: "planned" as Availability,
        body: "The organisations awarded public works.",
      },
      {
        key: "expenditure",
        label: "Expenditure",
        status: "planned" as Availability,
        body: "Allocations, releases and spending.",
      },
    ],
  },

  preview: {
    eyebrow: "The explorer",
    heading: "Start with a place. Follow the evidence.",
    body: "Choose a state on the map and see what is held there: the audit reports that concern it, the figures read from them, and the open tenders counted against its districts. Then descend to a district.",
    frameLabel: "lokdarpan · explore",
    caption: "Drawn from the same ledger the explorer reads. The explorer itself is interactive.",
    districts: "Districts",
    reports: "Audit reports",
    figures: "Verified figures",
    tenders: "Open tenders placed in districts",
    tendersNotCollected: "Not collected",
    tendersNotCollectedNote: (stateName: string): string =>
      `${stateName}'s tender portal is not collected, so no count is shown. That is a gap in LokDarpan's holdings, not a statement about the portal.`,
    legendDistrict: "District",
    legendTenders: "Open tenders placed here",
    cta: (stateName: string): string => `Open ${stateName} in the explorer`,
    unavailable:
      "The preview is drawn from the ledger, which could not be read when this page was built.",
  },

  trail: {
    eyebrow: "Traceability",
    heading: "Every figure has a source.",
    body: "A number on LokDarpan is never on its own. It carries the sentence it was read from, the page, the report, the file the report came from, and the date a person checked it.",
    exampleLabel: "One figure, and its trail",
    exampleNote:
      "Chosen by a fixed rule — the first whole sentence about receipts, expenditure or a budget with a single amount — not picked by hand.",
    steps: {
      figure: "Figure",
      sentence: "As printed",
      page: "Page",
      report: "Report",
      source: "Source file",
      checked: "Checked",
    },
    pageNumber: (page: number): string => `Page ${String(page)}`,
    retrieved: (date: string): string => `Retrieved ${date}`,
    checkedOn: (date: string): string => `By a person, on ${date}`,
    open: "Open this report",
    schematic: [
      "The figure",
      "The sentence it was read from",
      "The page",
      "The report and who issued it",
      "The file, and when it was retrieved",
      "Who checked it, and when",
    ],
    unavailable:
      "An example is drawn from the ledger when the page is built. It could not be read this time, so the trail is shown without one.",
  },

  matrix: {
    eyebrow: "Coverage",
    heading: "What is available, what is partial, what is planned.",
    body: "Each kind of record, what LokDarpan holds of it today, and where it comes from.",
    columns: { record: "Record", status: "Status", held: "Held today", source: "Source" },
    notHeld: "Not held yet",
    notRead: "Not read",
    rows: {
      boundaries: {
        record: "State and district boundaries",
        source: "Local Government Directory; OpenStreetMap",
        held: (states: number, districts: number): string =>
          `${plural(states, "state", "states")} · ${plural(districts, "district", "districts")}`,
      },
      local: {
        record: "Sub-districts and local bodies",
        source: "Local Government Directory",
        held: (units: number): string => `${plural(units, "unit", "units")}, not yet on the map`,
      },
      reports: {
        record: "Audit reports",
        source: "Comptroller and Auditor General of India",
        held: (reports: number, pages: number): string =>
          `${plural(reports, "report", "reports")} · ${plural(pages, "page", "pages")}`,
      },
      figures: {
        record: "Verified figures",
        source: "Read from the reports; each checked by a person",
        held: (figures: number): string => plural(figures, "figure", "figures"),
      },
      tenders: {
        record: "Open tenders",
        source: "State e-procurement portals",
        held: (open: number, portals: number): string =>
          `${n(open)} open, from ${plural(portals, "portal", "portals")}; details withheld`,
      },
      budgets: {
        record: "Budgets and spending",
        source: "State treasury systems",
        held: "Collected for Maharashtra; published once permission is granted",
      },
      works: {
        record: "Public works",
        source: "No register found that may be republished",
      },
      contractors: {
        record: "Contractors",
        source: "Award records not yet collected",
      },
    },
  },

  places: {
    eyebrow: "Explore by place",
    heading: "Explore India by place.",
    body: "Every place has one page, whatever its level. Start at a state and go down, as far as the records go.",
    levels: [
      {
        label: "State",
        status: "available" as Availability,
        body: "Every state and union territory.",
      },
      {
        label: "District",
        status: "available" as Availability,
        body: "Every district, with its boundary.",
      },
      {
        label: "Local body",
        status: "partial" as Availability,
        body: "Some held by directory code; not yet mapped.",
      },
    ],
    /** The local-body level when the ledger holds nothing below district. */
    localNone: "Not held yet; added as the directory is collected.",
    statesHeading: "Choose a state",
    legendReports: "Audit reports held",
    legendTenders: "Tender portal collected",
    stateLink: (stateName: string): string => `Explore ${stateName}`,
  },

  audience: {
    eyebrow: "Who it is for",
    heading: "Built for people who need the source.",
    groups: [
      {
        key: "citizens",
        title: "Citizens",
        body: "See what official records say about the place you live.",
        example: "Which audit reports concern my state?",
      },
      {
        key: "journalists",
        title: "Journalists",
        body: "Find a figure, and the exact page of the report that states it.",
        example: "Where does this number come from?",
      },
      {
        key: "researchers",
        title: "Researchers",
        body: "Work from records that carry their source, date and method.",
        example: "Which pages of which reports mention a budget head?",
      },
      {
        key: "developers",
        title: "Developers",
        body: "Build on the same versioned API the site itself uses.",
        example: "Open tenders per district, as JSON.",
      },
      {
        key: "civil",
        title: "Civil society",
        body: "Follow public infrastructure records across places and years.",
        example: "What is advertised in my district this month?",
      },
    ],
  },

  limits: {
    eyebrow: "Limitations",
    heading: "Honest about what it holds.",
    body: "LokDarpan works only with information published by government bodies. What is available, how complete it is and how recent depend on the sources. When something is missing here, that describes what LokDarpan holds, not what the government has done.",
    points: [
      "Budgets, works, contractors and spending are not published here yet.",
      "Tender details are withheld until the issuing departments permit republication.",
      "Boundary depiction follows the upstream dataset and is not an authoritative statement of any border.",
    ],
    notHeading: "What LokDarpan is not",
    not: "LokDarpan does not investigate, accuse or make legal findings. A difference or gap shown here means the data warrants a closer look. It is not a claim of wrongdoing by any person or organisation.",
    reportIssue: "Report a data issue",
  },

  coverage: {
    eyebrow: "Current coverage",
    heading: "Where the records are today.",
    body: "Audit reports are held for these states, listed in the order of their official codes.",
    columns: { state: "State", reports: "Audit reports", figures: "Verified figures" },
    none: "No audit reports are held yet.",
    tenders: (portals: number, states: number): string =>
      `Open tenders are collected from ${plural(portals, "state portal", "state portals")} covering ${plural(states, "state", "states")}.`,
    /** Shown only while the ledger records no collection for Maharashtra. */
    maharashtraTenders:
      "Maharashtra's portal does not permit automated collection, so no Maharashtra tenders are held.",
    next: "Next: budgets and spending for Maharashtra once permission to publish is granted, more states' audit reports, and works as sources are found.",
    unavailable:
      "The coverage list is read from the ledger, which could not be read when this page was built.",
  },

  final: {
    heading: "Start with a place.",
    body: "Open the map, choose a state or district, and follow the record to its source.",
    primary: "Explore the map",
    secondary: "Sources and methodology",
  },

  footer: {
    tagline: "Public records of India, traced to the source.",
    independence:
      "An independent public-interest project, not affiliated with or endorsed by any government body or political party.",
    copyright: "© 2026 LokDarpan",
    links: {
      explore: "Explore",
      reports: "Reports",
      methodology: "Data sources and methodology",
      github: "GitHub",
      issue: "Report a data issue",
    },
  },
} as const;
