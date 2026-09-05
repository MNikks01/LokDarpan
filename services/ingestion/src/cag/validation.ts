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
  /**
   * What this figure is *per*, worded as the page words it — "month",
   * "record", "IPD patient per day".
   *
   * Present only where the sentence states a denominator the parser could read
   * whole. A rate whose denominator cannot be read is refused rather than
   * published without one: ₹15 shown alone, beside a page citation, is a claim
   * the source never made.
   */
  readonly perUnit?: string;
}

const NEEDS_REVIEW: Verdict = { state: "needs_review", reason: "" };

/**
 * Words that end a denominator rather than belong to it.
 *
 * "₹18,13,500 per hectare **as per** ASR for the year" — the unit is "hectare",
 * and the second "per" begins a citation, not a second denominator. "₹1,500 per
 * month **through** Direct Benefit Transfer" ends at "month".
 */
const ENDS_THE_UNIT = new Set([
  "as",
  "through",
  "for",
  "on",
  "of",
  "was",
  "is",
  "were",
  "are",
  "and",
  "to",
  "in",
  "at",
  "by",
  "with",
  "from",
  "the",
  "a",
  "an",
  "which",
  "that",
  "compared",
  "up",
  "will",
  "shall",
  "would",
  "may",
  "can",
  "than",
  "but",
  "or",
  "if",
  "when",
  "during",
  "under",
  "over",
  "into",
  "onto",
  "per",
]);

/**
 * The nouns a denominator's second word may be.
 *
 * Every genuine multi-word unit in this corpus is a measure preceded by a
 * qualifier — "cubic metre", "square metre" — or joined by "per", as in "IPD
 * patient per day" and "tenement per month". Everything else the capture picked
 * up was the sentence continuing: "month **since**", "annum **electricity
 * charges**", "sqm **x**", "kit **plus** GST", "MT **difference**".
 *
 * An allowlist rather than a longer list of stop words, because the words that
 * end a unit are unbounded and the words that continue one are not.
 */
const CONTINUES_A_UNIT = new Set([
  "metre",
  "meter",
  "metres",
  "meters",
  "m",
  "km",
  "kg",
  "mt",
  "tonne",
  "tonnes",
  "litre",
  "liter",
  "litres",
  "liters",
  "day",
  "days",
  "month",
  "months",
  "year",
  "years",
  "hour",
  "hours",
  "patient",
  "patients",
  "cum",
  "sqm",
  "unit",
  "units",
  "connection",
  "connections",
  "beneficiary",
  "beneficiaries",
  "child",
  "children",
]);

/** With "per" a unit may run to four words; without it, to two. */
const MOST_UNIT_WORDS = 4;

/** A denominator that is itself money: "the rate of Guarantee fee is ₹2 per ₹100". */
function currencyDenominator(text: string): string | null {
  // Fees per hundred rupees are ordinary in stamp duty and guarantee rules, and
  // "₹2" alone states a different thing entirely. Read separately because the
  // word reader refuses anything carrying a digit.
  const m = /^\s*(?:crore|lakh|कोटी|लाख)?\s*per\s*(?:₹|`|´|Rs\.?)\s*(\d[\d,]*)/iu.exec(text);
  return m === null ? null : `₹${m[1] ?? ""}`;
}

/** One word of a denominator, and what follows it. */
function nextWord(rest: string): { word: string; plain: string; rest: string } | null {
  const token = /^([A-Za-z][A-Za-z.]{0,15})(?=[\s,;)]|$)[\s,;)]?\s*/u.exec(rest);
  if (token === null) return null;

  // "Cu.M." keeps its final stop; "record." loses one. A trailing stop is
  // dropped only when nothing else in the word is a stop — then it ended the
  // sentence. Where the word already carries one it is an abbreviation the page
  // prints, and the unit is shown worded as the page words it.
  const captured = token[1] ?? "";
  const trimmed = captured.replace(/\.$/u, "");
  const word = trimmed.includes(".") ? captured : trimmed;
  return {
    word,
    plain: word.toLowerCase().replace(/\.+$/u, ""),
    rest: rest.slice(token[0].length),
  };
}

/** Whether this word opens something other than the denominator. */
function opensSomethingElse(word: string, previous: string | undefined): boolean {
  // A capitalised word after a lowercase one begins something new: the page
  // reads "₹3 per beneficiary Quantity in grams per day", and "Quantity" opens
  // the next column of a table. An all-capital word is an abbreviation and may
  // lead, as in "IPD patient".
  return previous !== undefined && /^[A-Z][a-z]/u.test(word) && /^[a-z]/u.test(previous);
}

/** Whether the capture has taken all it should, having just taken a word. */
function hasTakenEnough(
  words: readonly string[],
  rest: string,
  followedASecondPer: boolean,
): boolean {
  if (words.length >= MOST_UNIT_WORDS) return true;
  // "per day" takes exactly one word; anything after it is the sentence
  // resuming — "₹48 per IPD patient per day respectively on food".
  if (followedASecondPer && words[words.length - 2]?.toLowerCase() === "per") return true;
  return /^[,;.)]/u.test(rest);
}

/** What to do with the next word of a candidate denominator. */
type Step = "stop" | "follow-per" | "take";

/**
 * Whether a word belongs to the denominator, ends it, or joins its second part.
 *
 * Split out so each rule reads as one line at the call site. Every one of them
 * was added because a real capture ran past the unit and into the sentence.
 */
function stepFor(
  token: { readonly word: string; readonly plain: string },
  previous: string | undefined,
  followedASecondPer: boolean,
): Step {
  if (ENDS_THE_UNIT.has(token.plain)) {
    // "per day" after "per IPD patient" is the rest of one denominator.
    const joinsASecondPart = token.plain === "per" && !followedASecondPer && previous !== undefined;
    return joinsASecondPart ? "follow-per" : "stop";
  }
  if (opensSomethingElse(token.word, previous)) return "stop";
  // Past the first word, only a measure noun continues the unit. "cubic metre"
  // is one denominator; "month since" is a denominator and then a clause.
  if (previous !== undefined && !followedASecondPer && !CONTINUES_A_UNIT.has(token.plain)) {
    return "stop";
  }
  return "take";
}

/**
 * The denominator immediately following an amount, or `null`.
 *
 * Read rather than inferred, and bounded: a greedy capture swallows the rest of
 * the sentence, and a unit that is really a clause is worse than no unit — it
 * would render as "₹15 per record was charged for downloads with".
 */
export function denominatorAfter(text: string): string | null {
  const money = currencyDenominator(text);
  if (money !== null) return money;

  const opener = /^\s*(?:crore|lakh|thousand|कोटी|कोट\S*|लाख|हजार)?\s*per\s+/iu.exec(text);
  if (opener === null) return null;

  const words: string[] = [];
  let rest = text.slice(opener[0].length);
  let followedASecondPer = false;

  for (;;) {
    const token = nextWord(rest);
    if (token === null) break;

    const step = stepFor(token, words[words.length - 1], followedASecondPer);
    if (step === "stop") break;
    if (step === "follow-per") followedASecondPer = true;

    words.push(step === "follow-per" ? "per" : token.word);
    rest = token.rest;

    if (hasTakenEnough(words, rest, followedASecondPer)) break;
  }

  return finish(words, rest);
}

/** The captured words as a unit, or `null` where the capture cannot be trusted. */
function finish(words: readonly string[], rest: string): string | null {
  const kept = [...words];
  while (kept.length > 0 && kept[kept.length - 1]?.toLowerCase() === "per") kept.pop();
  if (kept.length === 0) return null;

  // The evidence window ended where the unit did, so the page may continue and
  // the unit may be a fragment of one. It is: "₹100 per Cu…" is "per Cu.M." on
  // the page, and Cu is not a cubic metre. A denominator that cannot be seen to
  // end is not read.
  if (rest.trim() === "" || /^\s*…/u.test(rest)) return null;

  const unit = kept.join(" ");
  // A unit carrying a digit is a figure the capture wandered into.
  return /\d/u.test(unit) ? null : unit;
}

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

/**
 * A qualifier attaching this figure to a unit of something else.
 *
 * "₹2,000 per beneficiary", "₹250 per tenement per month", "₹2,36,900 per sqm".
 * The figure is real and the sentence is clear, and since migration 0020 it is
 * publishable — but only carrying the denominator `denominatorAfter` reads.
 *
 * Matched immediately after the amount, or immediately before it, and never
 * across the whole window: "₹104.87 crore at the rate of ₹4,661 per kit" holds
 * a total and a rate, and a window-wide search discards the total.
 */
const RATE_AFTER = /^\s*(?:crore|lakh|thousand|कोटी\S*|लाख|हजार)?\s*(?:per|प्रति)\s+\S{2,16}/iu;
const RATE_BEFORE = /(?:at the |@\s*)?(?:rate of|प्रति)\s*$/iu;
const RATE_LEADING = /\bper\s+\S{2,16}\s+(?:was|is|of|at|=)\s*$/iu;

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
    // A rate is publishable exactly when the sentence says what it is per and
    // the parser can read that whole. ₹1,500 rendered alone is a claim the
    // source never made; ₹1,500 per month is the claim it did make.
    //
    // The denominator is only ever read forward from the figure. "at the rate
    // of ₹60,000" states a rate whose unit sits elsewhere in the sentence, and
    // guessing which noun it belongs to would be inventing the denominator
    // rather than reading it.
    const perUnit = denominatorAfter(after);
    if (perUnit !== null) return { state: "needs_review", reason: "", perUnit };

    return {
      state: "rejected",
      reason: "a rate whose denominator the sentence does not state where it can be read",
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
