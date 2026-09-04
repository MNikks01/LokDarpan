import { AMOUNT_IN, amountToPaise } from "../cag/facts";

/**
 * Figures that state a *criterion* rather than a reported amount.
 *
 * "Grants with savings over ₹100 crore" names which rows a table contains. The
 * ₹100 crore is a cut-off the auditor chose, not money the state spent, and
 * storing it as a monetary fact would put a figure into the ledger that no
 * government body ever reported — behind a correct-looking citation to a real
 * page of a real audit report. That is this project's worst failure mode
 * arriving by a different route than a misread unit.
 *
 * The arithmetic self-check cannot see this. `₹ 100 कोटी` re-derives perfectly;
 * the sentence does state it. What makes it unpublishable is what the sentence
 * is *doing* with it, which is a question about words.
 *
 * Deliberately narrow, and biased toward missing them. A false positive
 * rejects a real government figure and removes it from the ledger silently; a
 * false negative leaves a candidate for a person to read. Those errors are not
 * symmetric, so this under-reaches — the same principle the extraction
 * patterns are built on.
 */

/**
 * Words that, immediately before a figure, make it a bound on a set.
 *
 * `up to` and `subject to a maximum of` are deliberately absent, and the
 * leading lookbehind drops every negated form — `not exceeding`, `not more
 * than`. These read like thresholds but they cap a real entitlement: "a
 * benefit of up to ₹1,500 per month" is the scheme's actual rate, and
 * "sanctioned an amount not exceeding ₹500 crore" is a real ceiling on a real
 * sanction. Rejecting either would delete a figure the state published.
 *
 * A negated form can still be a criterion — "cases not exceeding ₹10 crore
 * were excluded" — so this leaves them for a person rather than guessing.
 */
const CRITERION_BEFORE =
  /(?<!\bnot\s)(?:more than|greater than|over|above|exceeding|in excess of|less than|below|each case of|each exceeding|aggregating to more than)\s*$/iu;

/**
 * The same, in the words that follow. English puts some of these after the
 * figure, and Marathi puts nearly all of them there.
 *
 * The Devanagari alternatives include the forms this corpus's text layer
 * actually produces: the conjunct in अधिक is routinely mangled to अचधक, and a
 * pattern matching only the correct spelling finds none of them in half the
 * pages it is meant to cover.
 *
 * Combining marks are skipped after the unit because the inflected form joins
 * the two words with no space — "₹ 10 कोटींपेक्षा अधिक". The amount pattern
 * consumes `कोटी` and leaves the anusvara sitting between it and the criterion,
 * which is enough to hide the phrase from a whitespace-only gap.
 *
 * The gap either side of the unit is therefore any run of **non-letters**,
 * bounded so it cannot reach across a clause. That one class covers both forms
 * the font mapping produces, because neither a matra nor a substituted glyph is
 * a letter: "₹ 100 कोट ीं हून अधिक" detaches the matra behind a space, and
 * "₹ 100 कोट2 पेक्षा जास्त" replaces it with a digit. The first is an appendix
 * heading — a criterion — and the gap hid it, so it was verified as a ₹100
 * spending figure when the page says ₹100 crore and reports no figure at all.
 */
const CRITERION_AFTER =
  /^[^\p{L}]{0,4}(?:कोट|िोट|ोट|लाख|हजार|crore|lakh|thousand)?[^\p{L}]{0,6}(?:or more|and above|or above|and more|or less|पेक्षा\s*(?:अधिक|अचधक|जास्त|कमी)|हून\s*(?:अधिक|अचधक|जास्त)|आणि\s*त्यावरील|व\s*त्यावरील)/u;

/** How far either side of the figure the criterion words are looked for. */
const BEFORE_CHARS = 30;
const AFTER_CHARS = 26;

/**
 * Where the evidence states this amount, or null.
 *
 * Re-derived with the parser's own pattern rather than by searching for the
 * stored paise, which never appears in the text — the page says "₹ 100 कोटी"
 * and the column holds "10000000000".
 */
function offsetOfAmount(flat: string, paise: string): { at: number; length: number } | null {
  for (const m of flat.matchAll(AMOUNT_IN)) {
    // Reads unitless figures as rupees — a criterion can govern a figure read as rupees just as well.
    if (amountToPaise(m[1] ?? "", m[2], "rupees")?.toString() === paise) {
      return { at: m.index, length: m[0].length };
    }
  }
  return null;
}

/**
 * The criterion words governing this figure, or null if it reads as a reported
 * amount.
 *
 * Returns the phrase rather than a boolean so a rejection can say what it
 * rejected. A decision recorded against hundreds of candidates has to be able
 * to explain itself afterwards, and "threshold" alone explains nothing.
 */
export function thresholdPhrase(rawText: string, normalisedValue: string | null): string | null {
  if (normalisedValue === null) return null;

  const flat = rawText.replace(/\s+/gu, " ").trim();
  const found = offsetOfAmount(flat, normalisedValue);
  if (found === null) return null;

  const before = flat.slice(Math.max(0, found.at - BEFORE_CHARS), found.at);
  const after = flat.slice(found.at + found.length, found.at + found.length + AFTER_CHARS);

  return (
    CRITERION_BEFORE.exec(before)?.[0].trim() ?? CRITERION_AFTER.exec(after)?.[0].trim() ?? null
  );
}
