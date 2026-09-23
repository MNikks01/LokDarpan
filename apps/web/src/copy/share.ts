/**
 * What the explorer says about links to a view and the version they name (ADR-061).
 *
 * The version is LokDarpan's own record-keeping, not a statement about any
 * government's data, so these sentences talk only about what LokDarpan held.
 */
export const shareCopy = {
  copyLink: "Copy link to this view",
  copied: "Link copied. It names the dataset version this view was drawn from.",
  copyFailed: "The link could not be copied here. Select it below and copy it.",

  pinnedSame: (version: number, date: string): string =>
    `This link was made from dataset version ${String(version)}, opened ${date}. What is shown is that version.`,

  pinnedChanged: (version: number, date: string, current: number): string =>
    `This link was made from dataset version ${String(version)}, opened ${date}. LokDarpan has loaded data since, and what is shown is version ${String(current)}. Earlier versions of boundaries and counts are not kept, so this may differ from the view that was shared.`,
} as const;
