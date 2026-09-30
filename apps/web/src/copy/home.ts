/**
 * The homepage's prose (ADR-059, rule B).
 *
 * WHAT THIS PAGE MAY CLAIM
 * Only what the ledger holds, or what is explicitly marked as planned. On 30
 * September 2026 that is: government boundaries for every state and district;
 * CAG audit reports for three states, each figure checked by a person and cited
 * to its page; and open tenders from 21 state portals, counted by district with
 * their details withheld until the issuing departments permit republication.
 * There is no register of works, no contract or contractor data, and no
 * published expenditure (`.docs/00-overview/product-audit-2026-09-29.md`).
 *
 * So the page says where LokDarpan is going, and marks every step it has not
 * reached. It never shows a number it did not read from the ledger, and never
 * implies that something absent here is absent from the public record.
 */

export type Availability = "available" | "partial" | "planned";

export const availabilityLabel: Readonly<Record<Availability, string>> = {
  available: "Available",
  partial: "Partial",
  planned: "Planned",
};

export const homeCopy = {
  metaTitle: "LokDarpan — Public Governance Intelligence",
  metaDescription:
    "Explore official public records by place: audit reports and verified figures cited to the page, government boundaries, and open tenders. Budgets, works and spending are added as sources allow.",

  nav: {
    explore: "Explore",
    reports: "Reports",
    about: "About",
    github: "GitHub",
    cta: "Explore the map",
    menu: "Menu",
  },

  hero: {
    eyebrow: "Public governance intelligence",
    headline: "Public records, on the map, traced to the page.",
    lead: "LokDarpan brings official government records into one place you can explore by state and district. Every figure it shows links to the page of the document it was read from.",
    direction:
      "The aim is to follow public money from budget to finished work. Budgets, works, contractors and spending are added as sources and permissions allow.",
    primary: "Explore the map",
    secondary: "How it works",
    micro: "Start with a place. Open a record. Check the source.",
    visualLabel:
      "A schematic of how records connect: a place, the audit report about it, a page, and a verified figure on that page. Planned links to works and tenders are drawn dashed.",
  },

  what: {
    heading: "Records published in many places, read in one.",
    body: "Government information is scattered across departments, portals and documents. LokDarpan collects it from the official sources, keeps the original, and links each piece to the place it concerns, so you can move from a map to the record and back.",
    chainHeading: "How public money moves, and what LokDarpan holds of it today",
    chainNote:
      "Each step is marked by what LokDarpan holds today. Planned steps have no source it may publish yet — which says nothing about whether the government publishes them.",
    chain: [
      { label: "State and district", status: "available" as Availability },
      { label: "Local body", status: "partial" as Availability },
      { label: "Department budget", status: "planned" as Availability },
      { label: "Scheme", status: "planned" as Availability },
      { label: "Tender", status: "partial" as Availability },
      { label: "Contractor", status: "planned" as Availability },
      { label: "Work", status: "planned" as Availability },
      { label: "Expenditure", status: "planned" as Availability },
      { label: "Audit", status: "available" as Availability },
    ],
  },

  features: {
    heading: "What you can explore",
    cards: [
      {
        title: "Places",
        status: "available" as Availability,
        body: "Every state and district, with its official code from the Local Government Directory and its boundary on the map.",
      },
      {
        title: "Audit reports",
        status: "available" as Availability,
        body: "Reports of the Comptroller and Auditor General, and the figures in them that a person has checked against the page.",
      },
      {
        title: "Tenders",
        status: "partial" as Availability,
        body: "Open tenders from 21 state portals, counted by district. Details are withheld until the issuing departments permit republication.",
      },
      {
        title: "Public works",
        status: "planned" as Availability,
        body: "Individual works and their progress. No register of works has been found that LokDarpan may republish.",
      },
      {
        title: "Contractors",
        status: "planned" as Availability,
        body: "The organisations awarded public works. Award records are not yet available to collect.",
      },
      {
        title: "Budgets and spending",
        status: "planned" as Availability,
        body: "Allocations, releases and expenditure. Collected for Maharashtra, and published once the treasury grants permission.",
      },
    ],
  },

  journey: {
    heading: "From a place to the page behind a figure.",
    body: "The map is where you start, not where it ends. Choose a place and follow what the record says about it, down to the line on the page.",
    nowLabel: "Today",
    laterLabel: "Planned",
    now: ["A state or district", "An audit report", "A page", "A verified figure"],
    later: ["Work", "Tender", "Contractor", "Expenditure"],
  },

  how: {
    heading: "How it works",
    steps: [
      {
        title: "Choose a place",
        body: "Start with a state or a district on the map, or search for one by name.",
      },
      {
        title: "Open what is held there",
        body: "See the audit reports that concern it, and the open tenders counted against its offices.",
      },
      {
        title: "Check the source",
        body: "Every figure names the document and page it came from, and who verified it and when.",
      },
    ],
    cta: "Explore the map",
  },

  audience: {
    heading: "Who it is for",
    groups: [
      {
        title: "Citizens",
        body: "See what official records say about the place you live.",
      },
      {
        title: "Journalists",
        body: "Find a figure, and the exact page of the report that states it.",
      },
      {
        title: "Researchers",
        body: "Work from records that carry their source, their date and how they were read.",
      },
      {
        title: "Developers",
        body: "Build on the same versioned API the site itself uses.",
      },
      {
        title: "Civil society",
        body: "Follow public infrastructure records across places and years.",
      },
    ],
  },

  transparency: {
    heading: "Built from public records, and honest about their limits.",
    body: "LokDarpan works only with information published by government bodies. It keeps what it was given, links every figure to its source, and shows only what a person has checked.",
    limits:
      "What is available, how complete it is and how recent depend on the sources. When something is missing here, that describes what LokDarpan holds, not what the government has done.",
    notHeading: "What LokDarpan is not",
    not: "LokDarpan does not investigate, accuse or make legal findings. A difference or gap shown here means the data warrants a closer look. It is not a claim of wrongdoing by any person or organisation.",
    reportIssue: "Report a data issue",
  },

  today: {
    heading: "What is here today",
    body: "LokDarpan is at the start. This is what it holds now, and it grows as sources are added.",
    items: [
      "Boundaries and official codes for every state and district.",
      "Audit reports of the Comptroller and Auditor General for Maharashtra, Madhya Pradesh and Tamil Nadu, with each published figure cited to its page.",
      "Open tenders from 21 state portals, counted by district. Maharashtra's portal does not permit collection, so no Maharashtra tenders are held.",
    ],
    next: "Next: budgets and spending for Maharashtra once permission to publish is granted, more states' audit reports, and works as sources are found.",
  },

  final: {
    heading: "Start with a place.",
    body: "Open the map, choose a state or district, and follow the record to its source.",
    primary: "Explore the map",
    secondary: "About LokDarpan",
  },

  footer: {
    tagline: "Public governance intelligence through connected records.",
    built: "Built to make public records easier to explore.",
    independence:
      "An independent public-interest project, not affiliated with or endorsed by any government body or political party.",
    links: {
      explore: "Explore",
      reports: "Reports",
      about: "About",
      github: "GitHub",
      issue: "Report a data issue",
    },
  },
} as const;
