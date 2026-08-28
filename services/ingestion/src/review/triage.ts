import { AMOUNT_IN, amountToPaise } from "../cag/facts";

/**
 * Sorting money candidates by whether the parser's reading can be re-derived
 * from the evidence stored beside it.
 *
 * This is not a substitute for review, and it makes no judgement about whether
 * a government statement is true. It answers one narrow, mechanical question -
 * does this sentence contain this figure? - so a reviewer spends their
 * attention on the candidates where the answer is no, instead of on the
 * thousand where arithmetic already agrees.
 *
 * A reviewer confirming 1,491 amounts one keypress at a time will not do it,
 * and a review nobody performs publishes nothing. The risk of an accelerator is
 * that it becomes approval-without-reading, so this deliberately stops short of
 * deciding anything: it partitions, and a person still decides each partition.
 */

export type SelfCheck =
  /** The evidence states exactly one amount, and it is the stored one. */
  | "confirmed"
  /** The evidence states several amounts; the stored one is among them. */
  | "ambiguous"
  /** The evidence states amounts, and none of them is the stored one. */
  | "mismatch"
  /** The source stated no unit, so there is nothing to check against. */
  | "no_value";

export interface Checked {
  readonly id: number;
  readonly check: SelfCheck;
  /** Every amount the evidence itself states, for a reviewer to choose from. */
  readonly amountsInEvidence: readonly string[];
}

export interface CheckInput {
  readonly id: number;
  readonly rawText: string;
  readonly normalisedValue: string | null;
}

/**
 * Re-derives every amount the evidence states, and compares.
 *
 * The comparison is on exact paise as strings. These are government figures in
 * the trillions of paise, where a float comparison would start inventing
 * differences of its own.
 */
export function selfCheck(input: CheckInput): Checked {
  const amounts: string[] = [];
  for (const m of input.rawText.matchAll(AMOUNT_IN)) {
    const paise = amountToPaise(m[1] ?? "", m[2]);
    if (paise !== null) amounts.push(paise.toString());
  }

  if (input.normalisedValue === null) {
    return { id: input.id, check: "no_value", amountsInEvidence: amounts };
  }

  const matches = amounts.filter((a) => a === input.normalisedValue).length;
  if (matches === 0) {
    return { id: input.id, check: "mismatch", amountsInEvidence: amounts };
  }
  // One figure, once. Anything else leaves a reviewer a choice to make about
  // which of several amounts the claim is actually about.
  const check: SelfCheck = amounts.length === 1 ? "confirmed" : "ambiguous";
  return { id: input.id, check, amountsInEvidence: amounts };
}

export interface Triage {
  readonly confirmed: number;
  readonly ambiguous: number;
  readonly mismatch: number;
  readonly noValue: number;
}

export function triage(inputs: readonly CheckInput[]): Triage {
  const counts = { confirmed: 0, ambiguous: 0, mismatch: 0, noValue: 0 };
  for (const input of inputs) {
    const { check } = selfCheck(input);
    if (check === "no_value") counts.noValue += 1;
    else counts[check] += 1;
  }
  return counts;
}

/**
 * The order a reviewer should work in.
 *
 * Mismatches first: a stored value that appears nowhere in its own evidence is
 * a defect, and finding those early is worth more than confirming a thousand
 * readings that were already right. `confirmed` is deliberately last - it is
 * the group where a reviewer adds least, and working it first is how the
 * mismatches end up never being reached.
 */
export const TRIAGE_ORDER: readonly SelfCheck[] = [
  "mismatch",
  "no_value",
  "ambiguous",
  "confirmed",
];
