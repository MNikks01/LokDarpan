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

export function presentCandidate(c: ReviewCandidate, position: number, total: number): string {
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
