/**
 * The About page's prose (ADR-059, rule B): what the explorer holds, what it
 * does not, and the rules it keeps. Reviewed here, beside the neutrality list,
 * rather than in the component that renders it.
 */
export const aboutCopy = {
  purpose:
    "LokDarpan presents facts, calculations and neutral comparisons drawn from official records. It is not an enforcement body and not a legal authority, and what it shows is never an accusation. Where a feature would imply fault, the feature is withheld.",

  heldHeading: "What is on this screen, and what is missing",

  boundaries:
    "— real. State and district geometry from OpenStreetMap under ODbL, identified against the Local Government Directory and simplified for display.",

  records:
    "— real. Audit reports published by the Comptroller and Auditor General, and the facts within them that a person has checked against the page they were read from. Nothing unverified is shown.",

  works:
    "— absent. No register of individual works has been located for any area, so the map draws none. The state public works portal publishes no register, the procurement portals gate search and awards behind a CAPTCHA, no government source for road geometry has been found, and PMGSY’s terms forbid republication.",

  districts:
    "— held by their Local Government Directory codes, and open tenders are counted against the district of the issuing office. Below district level little is held yet: the Local Government Directory gates its village views behind a CAPTCHA.",

  emptyVersusUnpublished:
    "An empty map and an unpublished register look identical. Which one you are looking at is stated in words beside the map, with the source that was checked and when.",

  methodologyLink: "How each source is collected, checked and shown",

  rulesHeading: "Rules the interface follows",

  rules: [
    "No red is used for any status, variance or priority. Red is for destructive actions.",
    "No score, rank or badge is attached to a firm or an officer.",
    "A missing value is named as missing, with the record that would carry it. It is never shown as zero, and an absence in our holdings is never presented as an absence in the public record.",
    "Every figure carries the document it was read from, and links to it.",
    "A scheduled date and a date that occurred are drawn differently, so a plan is never read as an accomplishment.",
  ],
} as const;
