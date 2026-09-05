import type { FactKind } from "./facts";

/**
 * What a field is, and how carefully it has to be read.
 *
 * The brief this was built to lists a dozen kinds of critical field — money,
 * counts, quantities, percentages, chronology-affecting dates, geographic and
 * local-body identifiers — and then says something more useful than the list:
 * **do not build extractors for fields the system does not support merely
 * because they appear here.** Make the validation field-aware instead, so an
 * extractor declares what it is producing and the rules follow.
 *
 * So this module holds no extraction. It holds the rules, and one declaration
 * per kind the parser actually produces today. A new extractor adds a line.
 *
 * For a critical field the bar is **precision before recall**: a false
 * numerical extraction is worse than an omission, because a wrong figure
 * arrives with a page citation and a source link attached and looks exactly
 * like a right one, whereas a missing figure shows up as a gap a person can
 * see.
 */

export interface FieldRules {
  /**
   * Whether a wrong reading of this field would reach a reader as a fact.
   *
   * Critical fields are read for precision: where a qualifier makes a figure
   * something other than the quantity the ledger models, no value is assigned
   * at all.
   */
  readonly critical: boolean;
  /** Why, in the terms a reviewer would use. */
  readonly note: string;
}

export const FIELDS: Readonly<Record<FactKind, FieldRules>> = {
  monetary_amount: {
    critical: true,
    note: "a sum the ledger publishes, cited to a page and linked to its source",
  },
  // Never published (ADR-033), so a wrong reading reaches nobody. The parser
  // still produces them, and a reviewer still rules on them.
  contractor_reference: { critical: false, note: "a party's name; never published" },
  officer_role_reference: { critical: false, note: "a role reference; never published" },
  // Declared but not produced by any extractor yet. It is here because the
  // record is exhaustive by type: adding a kind to `FactKind` and forgetting to
  // say how carefully it must be read is a compile error, not an omission
  // somebody notices later.
  work_reference: { critical: false, note: "not produced by any extractor yet" },
};

/**
 * What the machine could establish about a reading.
 *
 * Three states, deliberately separate from the four a *person* records on
 * `document_fact`. This is what the extractor determined; verification remains
 * a human act.
 *
 * - `accepted` — the reading is a quantity of the kind the field models.
 * - `needs_review` — nothing disqualifies it, and nothing here can confirm it.
 * - `rejected` — the evidence says this figure is not that quantity.
 *
 * `rejected` never means "probably wrong". It means the sentence states what
 * the number is, and it is not an amount: a rate per unit, a threshold in a
 * rule, an illustration in a formula.
 */
export type ValidationState = "accepted" | "needs_review" | "rejected";

export interface Verdict {
  readonly state: ValidationState;
  /** Empty for `needs_review`; a stated reason otherwise. */
  readonly reason: string;
}

const NEEDS_REVIEW: Verdict = { state: "needs_review", reason: "" };

/**
 * A qualifier attaching this figure to a unit of something else.
 *
 * "₹2,000 per beneficiary", "₹250 per tenement per month", "₹2,36,900 per sqm".
 * The figure is real and the sentence is clear; it is simply not a sum. The
 * ledger models amounts and carries no denominator, so publishing one as a sum
 * would misstate it by however many beneficiaries there are.
 *
 * Matched immediately after the amount, or immediately before it, and never
 * across the whole window: "₹104.87 crore at the rate of ₹4,661 per kit" holds
 * a total and a rate, and a window-wide search discards the total.
 */
const RATE_AFTER = /^\s*(?:crore|lakh|thousand|कोटी\S*|लाख|हजार)?\s*(?:per|प्रति)\s+\S{2,16}/iu;
const RATE_BEFORE = /(?:at the |@\s*)?(?:rate of|प्रति)\s*$/iu;
const RATE_LEADING = /\bper\s+\S{2,16}\s+(?:was|is|of|at|=)\s*$/iu;

/**
 * A value a rule selects on, rather than a value anyone paid.
 *
 * "works valuing more than ₹5.00 crore", "schemes with less than ₹400 crore",
 * "experience of a work order not less than ₹80 crore", "after retaining
 * ₹20 lakh". ADR-025 settled that a criterion is not a fact; this is that
 * decision applied where the sentence states it plainly.
 *
 * The list is narrower than it first was, and each removal was forced by a
 * published figure. "retaining" went the same way: "a challan showing
 * remittance of ₹2.33 crore after retaining ₹0.02 crore" is a sum a body
 * actually kept, and English does not distinguish that from a rule about
 * keeping. The one rule it caught — a circular directing Boards to transfer
 * balances after retaining ₹20 lakh — states its limit in words this list still
 * holds. "valuing" and "costing" describe what something was worth —
 * "285 medical equipment costing ₹68.55 crore" is a sum, not a cut-off. Bare
 * "exceeding" describes a quantity as often as it bounds one: "liabilities
 * exceeding ₹27,184 crore" is a liability. And "less" alone matched the
 * subtraction in "₹0.31 crore (₹4.00 crore less ₹3.69 crore)", so only "less
 * than" survives. A rule that reads a real figure as a threshold suppresses a
 * government number, which is the failure this whole module exists to avoid,
 * pointed the other way.
 */
const THRESHOLD_BEFORE =
  /\b(more than|not more than|not exceeding|up to|upto|not less than|less than|at least|in excess of|minimum of|maximum of|ceiling|permissible limit)\s*(?:₹|`|´|Rs\.?)?\s*$/iu;

/**
 * The same rule, stated after the figure instead of before it.
 *
 * "(₹10 crore or more in each case)", "₹25 lakh and above", "₹100 कोटीपेक्षा
 * जास्त". English audit prose puts the comparator either side; Marathi puts the
 * postposition पेक्षा — "than" — after. A figure followed by one of these is
 * the boundary of a set, and the set is what the sentence is about.
 *
 * The conjunction is required, not optional. Without it, "₹0.31 crore (₹4.00
 * crore less ₹3.69 crore)" reads as a threshold when it is a subtraction, and
 * a published figure is suppressed by a rule about a word.
 */
const THRESHOLD_AFTER =
  /^\s*(?:crore|lakh|thousand|कोटी|कोट\S*|लाख|हजार)?\s*(?:(?:or|and)\s+(?:more|above|below|less|higher|lower)|पेक्षा)\b/iu;

/**
 * A multiplicand between a count and a product: `490 tenements × ₹38,46,110 =`.
 *
 * The sentence has done the arithmetic and shown its working. The figure
 * between the multiplication sign and the equals is the price of one of
 * whatever was counted — a rate by construction, whatever noun follows it, and
 * in Marathi the noun is often mojibake and unreadable.
 *
 * The total on the other side of the `=` is a sum, and is left alone.
 */
const MULTIPLICAND_BEFORE = /[×x*]\s*(?:₹|`|´|Rs\.?)?\s*$/u;
const MULTIPLICAND_AFTER = /^\s*(?:crore|lakh|कोटी|कोट\S*|लाख)?\s*=/u;

/** An illustration of arithmetic, not a figure any body reported. */
const WORKED_EXAMPLE = /\b(for original|formula to be applied|illustrat)/iu;

export interface Reading {
  readonly kind: FactKind;
  /** The evidence window the fact carries. */
  readonly evidence: string;
  /** Where this fact's own figure starts in that window. */
  readonly at: number;
  /** How long the matched amount is. */
  readonly length: number;
}

/**
 * What can be established about one reading from the sentence it sits in.
 *
 * Only the text immediately around the figure is consulted. A window holding
 * four amounts may qualify exactly one of them, and judging the window judges
 * the wrong number three times out of four.
 */
export function validate(reading: Reading): Verdict {
  const rules = FIELDS[reading.kind];
  if (!rules.critical) return NEEDS_REVIEW;

  const after = reading.evidence.slice(
    reading.at + reading.length,
    reading.at + reading.length + 34,
  );
  const before = reading.evidence.slice(Math.max(0, reading.at - 30), reading.at);
  const around = reading.evidence.slice(Math.max(0, reading.at - 70), reading.at + 90);

  if (RATE_AFTER.test(after) || RATE_BEFORE.test(before) || RATE_LEADING.test(before)) {
    return {
      state: "rejected",
      reason: "a rate per unit, not an amount; the ledger carries no denominator for it",
    };
  }

  if (MULTIPLICAND_BEFORE.test(before) && MULTIPLICAND_AFTER.test(after)) {
    return {
      state: "rejected",
      reason: "the price of one unit, shown as the multiplicand of a product the sentence computes",
    };
  }

  if (THRESHOLD_BEFORE.test(before) || THRESHOLD_AFTER.test(after)) {
    return {
      state: "rejected",
      reason: "a threshold in a rule rather than a sum allocated, released or spent (ADR-025)",
    };
  }

  if (WORKED_EXAMPLE.test(around)) {
    return {
      state: "rejected",
      reason: "an illustration of a formula, not a figure any body reported",
    };
  }

  return NEEDS_REVIEW;
}
