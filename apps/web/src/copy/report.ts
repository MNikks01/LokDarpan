import type { CorrectionCategory, CorrectionProblem } from "@lokdarpan/domain";

/**
 * The correction form (ADR-075). Reviewed beside the neutrality list (ADR-059,
 * rule B). The wording says what a report does — asks a person to re-read the
 * source — and never that a report will change a figure.
 */
export const reportCopy = {
  title: "Report a data issue",
  intro:
    "If a figure, name, place or document here does not match its official source, tell us. A person will re-read the source. If the site has it wrong, the record is corrected and the earlier reading is kept with the reason it changed.",
  noAccount:
    "No account is needed, and no name, email address or other detail about you is stored.",
  aboutLabel: "What this is about",
  aboutRecord: (subject: string): string => `The record you came from (${subject})`,
  aboutPage: "The page you came from",
  categoryLabel: "What looks wrong",
  categories: {
    amount_wrong: "An amount does not match the source",
    name_wrong: "A name does not match the source",
    place_wrong: "A place is wrong",
    document_wrong: "The source document is wrong or missing",
    duplicate: "Something appears twice",
    outdated: "The source has been revised",
    missing: "Something published is missing here",
    other: "Something else",
  } satisfies Record<CorrectionCategory, string>,
  descriptionLabel: "What does the source say?",
  descriptionHint:
    "Quote the source if you can, and name the page. Please do not include personal details about yourself or anyone else.",
  evidenceLabel: "Link to the source (optional)",
  evidenceHint: "Where the correct value is published, if you know.",
  submit: "Send report",
  problems: {
    subject: "This report could not be linked to a record. Open the form from the record's page.",
    category: "Choose what looks wrong.",
    description_short: "Describe the issue in at least ten characters.",
    description_long: "Keep the description under 4,000 characters.",
    evidence_url: "The link must be a web address starting with http:// or https://.",
    automated: "This report could not be sent.",
  } satisfies Record<CorrectionProblem, string>,
  failures: {
    RATE_LIMITED: "Too many reports from this connection. Please try again in a minute.",
    PAUSED:
      "Reports are paused for the moment because many have arrived this hour. Please try again later.",
    UNAVAILABLE: "Reports cannot be received at the moment. Please try again later.",
    TOO_LARGE: "This report is too long to send.",
    BAD_REQUEST: "This report could not be read. Please try again.",
  } as Readonly<Record<string, string>>,
  receivedTitle: "Report received",
  receivedReference: (ref: string): string => `Your reference is ${ref}.`,
  receivedNext:
    "A person will re-read the source. Nothing on the site changes until they have, and any change keeps the earlier reading with the reason it changed.",
  receivedNoReference: "Thank you. Your report has been received.",
  backToSite: "Back to the site",
  reportThisFigure: "Report an issue with this figure",
} as const;
