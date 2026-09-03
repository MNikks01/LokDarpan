import { Money } from "@lokdarpan/money";

import type { FactKind } from "../cag/facts";

/**
 * Formatting for the review terminal.
 *
 * Everything here is pure so the wording a reviewer acts on can be tested. The
 * wording matters more than it looks: a reviewer deciding 1,825 times reads
 * these labels far more often than they read this file, and a label that
 * quietly overstates what the parser knows will produce confident approvals of
 * claims nobody checked.
 */

export interface ReviewCandidate {
  readonly id: number;
  readonly pageNumber: number;
  readonly kind: FactKind;
  readonly rawText: string;
  readonly normalisedValue: string | null;
  readonly extractionConfidence: number;
  readonly parserVersion: string;
  readonly documentTitle: string;
  readonly sourceUrl: string;
}

const KIND_LABEL: Readonly<Record<FactKind, string>> = {
  monetary_amount: "amount",
  contractor_reference: "firm named",
  officer_role_reference: "role named",
  work_reference: "work named",
};

// Weight only, never hue. `.docs/17-legal/legal-ethical-rules.md` reserves red
// for destructive user actions, and colouring a candidate by how suspicious it
// looks would state a conclusion before the reviewer has formed one.
const ESC = String.fromCharCode(27);
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const RESET = `${ESC}[0m`;

/**
 * How the parser's reading is shown back.
 *
 * Money is rendered in rupees rather than as the stored paise: a reviewer
 * cannot judge "15140000000" against a sentence reading "15.14 crore", and
 * asking them to divide by ten million every time is how a wrong figure gets
 * waved through.
 */
export function describeValue(kind: FactKind, normalisedValue: string | null): string {
  if (normalisedValue === null) {
    // Never "0", never blank. The parser found something it could not read,
    // and the reviewer is the one being asked to supply it.
    return "not read - needs a value";
  }
  if (kind !== "monetary_amount") return normalisedValue;
  try {
    return Money.fromPaise(BigInt(normalisedValue)).format("en", "crore-lakh");
  } catch {
    return `${normalisedValue} (unreadable as an amount)`;
  }
}

/** Shown as a plain percentage, always with what it is a claim about. */
export function describeConfidence(value: number): string {
  return `${String(Math.round(value * 100))}% that the text was read correctly`;
}

/**
 * The citation, in the form a reader could follow themselves. A page number
 * without the document and URL is not something anyone can check.
 */
export function describeCitation(c: ReviewCandidate): string {
  return `${c.documentTitle}, page ${String(c.pageNumber)}\n${c.sourceUrl}`;
}

/**
 * What the arithmetic already established, stated plainly.
 *
 * Deliberately not a recommendation. "confirmed" means the sentence contains
 * this figure and no other - nothing about whether the government statement is
 * true, or whether this figure belongs to the thing the reader will assume.
 */
const CHECK_NOTE: Readonly<Record<string, string>> = {
  confirmed: "the sentence states this amount, and no other",
  ambiguous: "the sentence states several amounts, including this one",
  mismatch: "this amount is not derivable from the sentence - look closely",
  no_value: "the source stated no unit; supply the scale with [c]",
};

export function presentCandidate(
  c: ReviewCandidate,
  position: number,
  total: number,
  check?: string,
): string {
  const head =
    `${DIM}${String(position)} of ${String(total)}${RESET}` +
    `  ${BOLD}${KIND_LABEL[c.kind]}${RESET}`;
  return [
    `${head}  ${DIM}#${String(c.id)}${RESET}`,
    "",
    `  ${c.rawText}`,
    "",
    `  ${BOLD}parser read:${RESET} ${describeValue(c.kind, c.normalisedValue)}`,
    `  ${DIM}${describeConfidence(c.extractionConfidence)} - ${c.parserVersion}${RESET}`,
    ...(check === undefined ? [] : [`  ${DIM}${CHECK_NOTE[check] ?? check}${RESET}`]),
    "",
    `  ${DIM}${describeCitation(c).replace("\n", "\n  ")}${RESET}`,
  ].join("\n");
}

/**
 * The prompt. "skip" is named first and is what Enter does, because the safe
 * default when a reviewer is unsure must be to decide nothing - an accidental
 * keypress should never publish a claim about a named company.
 */
export const PROMPT = "  [enter] skip   [v] verify   [r] reject   [c] correct   [q] quit  ";

/** The evidence around the figure, trimmed to what fits on one line. */
function around(text: string, value: string | null, width: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (value === null) return flat.slice(0, width);
  // Centre the window on the figure. A window that starts at the beginning of
  // a long paragraph often does not contain the number being judged, which
  // would make the line unreadable as evidence.
  const at = flat.indexOf(value.replace(/\.00$/, ""));
  if (at < 0) return flat.slice(0, width);
  const start = Math.max(0, at - Math.floor(width / 3));
  return (start > 0 ? "…" : "") + flat.slice(start, start + width);
}

/**
 * A page of candidates, one line each.
 *
 * ONLY EVER USED FOR THE `confirmed` PARTITION
 * These are candidates whose figure re-derives exactly from their own evidence
 * and from no other reading of it. The reviewer is checking that the parser
 * took the right sentence, not adjudicating between several amounts — that is
 * a question a line can carry and a paragraph is not needed for.
 *
 * The evidence is shown, not summarised. A page listing only values and page
 * numbers would be approval-without-reading with extra steps, and there would
 * be nothing for the reviewer to actually check.
 */
export function presentBatch(
  candidates: readonly ReviewCandidate[],
  offset: number,
  total: number,
): string {
  const lines = candidates.map((c, i) => {
    // The same formatter the single-candidate view uses. A page rendering
    // amounts differently from the screen a flagged one lands on would make
    // the two hard to compare at exactly the moment it matters.
    const value = describeValue(c.kind, c.normalisedValue);
    return (
      `  ${BOLD}${String(i + 1)}${RESET}  ${value.padStart(18)}  ${DIM}p${String(c.pageNumber)}${RESET}\n` +
      `     ${DIM}${around(c.rawText, c.normalisedValue, 96)}${RESET}`
    );
  });
  return (
    `${BOLD}${String(offset + 1)}–${String(offset + candidates.length)} of ${String(total)}${RESET}` +
    `  ${DIM}each figure below is stated by its own evidence and by no other reading of it${RESET}\n\n` +
    lines.join("\n\n")
  );
}

export const BATCH_PROMPT =
  "\n  [a] all correct   [1-9] one is wrong   [enter] skip page   [q] quit  ";
