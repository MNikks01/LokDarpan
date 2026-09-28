/**
 * Wording around figures and observations (ADR-059, rule B). These are the
 * sentences that stop arithmetic being read as a finding, and a missing record
 * being read as money not spent (`.docs/17-legal/legal-ethical-rules.md`).
 */

export const figureCopy = {
  missingIsNotZero:
    "This does not mean no money was spent — it means the record has not been published or collected yet.",
} as const;

export const observationCopy = {
  disclaimer:
    "ⓘ These are data-consistency observations from official records, not findings of wrongdoing.",
  moneyTrailGap: (deviationPct: string, thresholdPct: number): string =>
    `Allocated ≥ Released ≥ Utilized holds. The ${deviationPct}% gap between released and utilized exceeds the ${String(thresholdPct)}% threshold configured for this category.`,
  arithmeticOnly:
    "ⓘ This is an arithmetic observation. It does not indicate that anything is wrong.",
} as const;

export const publishedFactsCopy = {
  correctedByReviewer: " · corrected by the reviewer against the page",
  notASummary:
    "This is not a summary of the document, and absence here does not mean the document is silent on a subject — it means nobody has confirmed a reading of it yet. An audit report examines selected matters; it is not a register of all of them.",
  pagesWithoutText: (without: number, total: number): string =>
    `${String(without)} of ${String(total)} pages carried no readable text and were not searched. They may contain figures this page does not show.`,
} as const;
