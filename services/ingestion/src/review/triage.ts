import { AMOUNT_IN, AMOUNT_WITH_SUBSTITUTED_MARK, amountToPaise } from "../cag/facts";

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
  /**
   * The evidence states several amounts, and every one of the others is itself
   * recorded as a fact on this page.
   *
   * This is window overlap, not a competing reading. `CONTEXT_CHARS` keeps 160
   * characters either side of a figure, so a paragraph naming three deficits
   * produces three candidates whose windows each contain all three. Asking a
   * reviewer which amount the claim is "really" about presumes a choice that
   * was never open: the neighbours were taken by their own candidates, and
   * nothing in the window is unaccounted for.
   */
  | "confirmed_in_context"
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

/** A candidate together with the page it was read from, as `document:page`. */
export interface TriageInput extends CheckInput {
  readonly pageKey?: string;
}

/**
 * Every amount claimed by a fact, per page.
 *
 * Built from *all* facts on the page, whatever their verification status, and
 * not only from the ones still awaiting review. A sibling that leaves the queue
 * because someone decided on it has not stopped accounting for its amount, and
 * a set that shrank as review progressed would move candidates back into
 * `ambiguous` — the partition would depend on how far through the queue the
 * reviewer happened to be.
 */
export type ClaimedByPage = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Re-derives every amount the evidence states, and compares.
 *
 * The comparison is on exact paise as strings. These are government figures in
 * the trillions of paise, where a float comparison would start inventing
 * differences of its own.
 */
export function selfCheck(input: CheckInput, claimedOnPage?: ReadonlySet<string>): Checked {
  const amounts: string[] = [];
  // `rupees` rather than the default refusal: the parser reads a bare figure as
  // rupees on a page that declares no scale, and a self-check that could not
  // reproduce that reading would report every one of those facts as a mismatch
  // — a defect flag on the exact candidates arithmetic agrees with. The two
  // readings never collide, being seven orders of magnitude apart.
  //
  // Both patterns, for the same reason. Some documents emit a backtick where the
  // page prints ₹, and the parser decodes that on a page carrying several of
  // them. A self-check blind to the decoding reported all 469 such facts as
  // "the stored value appears nowhere in its own evidence" — a defect flag on
  // every candidate of a class that is not defective, which is worse than no
  // triage at all: it buries the real mismatches.
  for (const pattern of [AMOUNT_IN, AMOUNT_WITH_SUBSTITUTED_MARK]) {
    for (const m of input.rawText.matchAll(pattern)) {
      const paise = amountToPaise(m[1] ?? "", m[2], "rupees");
      if (paise !== null) amounts.push(paise.toString());
    }
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
  if (amounts.length === 1) {
    return { id: input.id, check: "confirmed", amountsInEvidence: amounts };
  }

  // Unless the choice is already settled: if every other amount in the window
  // is claimed by a fact of its own, the overlap is the window's doing and not
  // a question about this reading. Without page context this cannot be known,
  // so the candidate stays ambiguous — the refinement only ever narrows.
  const unaccounted =
    claimedOnPage === undefined
      ? amounts.filter((a) => a !== input.normalisedValue)
      : amounts.filter((a) => a !== input.normalisedValue && !claimedOnPage.has(a));

  return {
    id: input.id,
    check: unaccounted.length === 0 ? "confirmed_in_context" : "ambiguous",
    amountsInEvidence: amounts,
  };
}

export interface Triage {
  readonly confirmed: number;
  readonly confirmedInContext: number;
  readonly ambiguous: number;
  readonly mismatch: number;
  readonly noValue: number;
}

export function triage(inputs: readonly TriageInput[], claimed?: ClaimedByPage): Triage {
  const counts = { confirmed: 0, confirmedInContext: 0, ambiguous: 0, mismatch: 0, noValue: 0 };
  for (const input of inputs) {
    const { check } = selfCheck(input, contextFor(input, claimed));
    if (check === "no_value") counts.noValue += 1;
    else if (check === "confirmed_in_context") counts.confirmedInContext += 1;
    else counts[check] += 1;
  }
  return counts;
}

/**
 * The amounts accounted for on this candidate's page, when both the page it
 * came from and a map of claims are known. Either missing means no context,
 * which leaves `selfCheck` at its unrefined answer.
 */
export function contextFor(
  input: TriageInput,
  claimed: ClaimedByPage | undefined,
): ReadonlySet<string> | undefined {
  if (claimed === undefined || input.pageKey === undefined) return undefined;
  return claimed.get(input.pageKey);
}

/**
 * The order a reviewer should work in.
 *
 * Mismatches first: a stored value that appears nowhere in its own evidence is
 * a defect, and finding those early is worth more than confirming a thousand
 * readings that were already right. `confirmed` is deliberately last - it is
 * the group where a reviewer adds least, and working it first is how the
 * mismatches end up never being reached. `confirmed_in_context` sits beside it
 * for the same reason: arithmetic has already accounted for every figure in
 * the window, so a reviewer is checking the parser took the right sentence
 * rather than adjudicating between readings.
 */
export const TRIAGE_ORDER: readonly SelfCheck[] = [
  "mismatch",
  "no_value",
  "ambiguous",
  "confirmed_in_context",
  "confirmed",
];
