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

/**
 * A figure read by text recognition from a page that is an image (ADR-072).
 *
 * Approved 6 October 2026, and not yet shown: `published_fact` withholds every
 * fact read from a scan until the page can say so with these sentences. The
 * engine's doubt is worded as legibility, never as a percentage: a number
 * beside a government figure reads as the chance the figure is right, and it
 * measures only how clearly the characters could be seen.
 */
export const scanFactCopy = {
  label:
    "Read from a scanned page by text recognition · checked by a reviewer against the page image",
  explanation: (engine: string, version: string): string =>
    `This page of the document is an image, with no text of its own. The figure was read from the image by text-recognition software (${engine} ${version}), and a reviewer then compared it with the page.`,
  legibility: (clear: boolean): string =>
    `The characters in this figure were ${clear ? "clearly" : "not clearly"} legible to the software.`,
  pagesWithoutTextSomeRead: (without: number, total: number): string =>
    `${String(without)} of ${String(total)} pages are images with no text of their own. Figures read from them by text recognition are marked as such; others may contain figures this page does not show.`,
} as const;

export const publishedFactsCopy = {
  correctedByReviewer: " · corrected by the reviewer against the page",
  notASummary:
    "This is not a summary of the document, and absence here does not mean the document is silent on a subject — it means nobody has confirmed a reading of it yet. An audit report examines selected matters; it is not a register of all of them.",
  pagesWithoutText: (without: number, total: number): string =>
    `${String(without)} of ${String(total)} pages carried no readable text and were not searched. They may contain figures this page does not show.`,
} as const;
