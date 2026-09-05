import { AmountFormatError, shiftedToPaise } from "../beams/amount";
import { validate, type Verdict } from "./validation";
import { boxAround, type TextItem } from "./extract";

/**
 * Pattern extraction over audit prose.
 *
 * Everything here produces *candidates*, never facts. The patterns are
 * deliberately narrow: a missed contractor costs a reviewer nothing, while a
 * wrong one attaches a company's name to a public claim about money. When the
 * two errors are that asymmetric, the parser should under-reach.
 *
 * Confidence values are the parser's own estimate of whether it read the text
 * correctly. They say nothing about whether the underlying government
 * statement is true, and none of them means "publishable".
 */
export const PARSER_VERSION = "cag-facts/23";

export type FactKind =
  "monetary_amount" | "contractor_reference" | "officer_role_reference" | "work_reference";

export interface FactCandidate {
  readonly kind: FactKind;
  readonly pageNumber: number;
  /** The sentence as published, so a reviewer judges the claim in context. */
  readonly rawText: string;
  /** Paise for money, trimmed name for a party. `null` if not normalisable. */
  readonly normalisedValue: string | null;
  readonly extractionConfidence: number;
  /**
   * What the field's own rules could establish about this reading.
   *
   * **Advisory.** A `rejected` verdict does not remove the value and does not
   * stop the candidate: it records that the sentence says this figure is a rate,
   * a threshold or an illustration, and leaves the decision where it has always
   * been. Sweeping the rules across the 5,102 figures already published found
   * 129 they disagree with, of which 113 are rates a reviewer chose to publish —
   * a question about the ledger's standard, not something a regular expression
   * should settle by unpublishing government figures.
   */
  readonly validation: Verdict;
  /**
   * What this figure is per, worded as the page words it, or `null`.
   *
   * A rate is publishable exactly when it carries this. Where the sentence
   * states a rate whose denominator cannot be read forward from the figure, the
   * validator refuses the reading rather than offering a number with no unit.
   */
  readonly perUnit: string | null;
  /**
   * Where on the page the figure itself sits — not the evidence window round
   * it. Absent when the page's text items were not supplied, which is every
   * caller that has only the stored text.
   */
  readonly box?: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * `₹ 15.14 crore`, `₹40 lakh`, `Rs. 1,234.56 crore`, `₹ 27,559.26 कोटी`.
 *
 * These reports are bilingual and the Marathi half states its units in
 * Devanagari. Matching only the Latin words left every Marathi figure looking
 * unqualified, which is how "₹ 27,559.26 कोटी" came to be stored as ₹27,559.26
 * — four orders of magnitude out, under a correct-looking citation.
 *
 * The Devanagari stems are matched without their inflections: कोटी appears as
 * कोटीची, कोटीहून and कोटींच्या depending on the case the sentence needs.
 *
 * The digit group tolerates whitespace *around its commas only*. This corpus's
 * text layer splits digit groups — "₹ 20 ,564.71 कोटी", "₹ 97 ,188.32 कोटी" —
 * and `[\d,]+` stopped at the space, capturing "20" and losing the unit that
 * followed. Those figures were then stored with no value at all and offered to
 * a reviewer as "the source stated no unit", which is false: the unit is
 * printed on the page. Requiring a comma to continue the group is what keeps
 * "₹ 1,500 26,200" from being read as one number.
 *
 * `ोटी` — कोटी with its leading conjunct detached — is matched because the text
 * layer produces it: "₹ 919.80 ोटींच् या" is कोटींच्या with the क lost, and the
 * figure is in crore whatever happened to the glyph. The same corruption is
 * already handled in the criterion screen for अधिक → अचधक.
 *
 * `Rs` needs a word boundary, and the pattern is **case-sensitive** for it.
 *
 * The boundary came first: case-insensitively, `Rs` matched the end of English
 * plurals, so "Parameters 2020-21" read as ₹2020 and "years 10.32" as ₹10.32.
 * The case matters for a second reason found later. These reports index their
 * own series with all-caps codes — GSS, ES, **RS**, COPU — so a table of audit
 * report numbers reading "GSS 12, 17 … RS 9, 16 … COPU 08,09" produced ₹916,
 * ₹33, ₹37, ₹54 and ₹56 out of report numbers. Across 2,792 pages, **every one
 * of the eleven `RS` occurrences before digits is a series code, and not one
 * genuine `Rs.` currency marker exists** — these reports write `₹`. Dropping
 * the flag costs nothing here and refuses all five fabrications.
 *
 * The unit words are therefore enumerated by case. Measured over the corpus:
 * `crore` 1,533, `lakh` 153, `Lakh` 1, and no all-caps form.
 *
 * The stem itself is also substituted. Document 3511 renders every `क` as `ि`,
 * so its crore figures read `₹ 2.12 िोटी` and were stored as ₹1. Measured over
 * the corpus, the character before `ोट` when it follows a figure is `क` 2,027
 * times, `ि` 21 times and absent 7 times — so the observed forms are listed and
 * nothing is guessed at. A mapping this corpus has not shown will slip past,
 * which is what the small-value screen in review is for: a two-digit rupee
 * finding in a CAG report is worth a person's eye, and that is how `ि` was
 * found.
 *
 * `कोट` is matched as a **bare stem** when it has to be, without requiring its
 * ी matra — but the intact spellings are listed **first**, because alternation
 * is ordered and the longest match must win. Matching the bare stem first
 * shortened every intact `कोटी` match by one character, which moved every
 * evidence window, which changed the identity of every Devanagari crore fact in
 * the corpus and stranded 504 sound decisions. A parser fix must not orphan the
 * review that was done against it.
 * The
 * broken font mapping in some documents replaces the matra with a digit or
 * punctuation — कोट2, कोट5, कोट8, कोट-, कोट: — or detaches it behind a space,
 * "₹ 100 कोट ीं हून". Requiring `कोट[ीि]` read 721 crore figures as bare rupees,
 * wrong by seven orders of magnitude. Every one of the कोट-stem forms following
 * a figure in this corpus means crore; there is no other word it could begin.
 */
/**
 * Exported so the review triage re-derives amounts with exactly the rules the
 * parser used. A second copy of this pattern would drift, and a self-check
 * that disagrees with the parser it checks is worse than none.
 *
 * Safe to share: `String.prototype.matchAll` operates on an internal clone, so
 * one consumer cannot leave `lastIndex` set for another.
 */
export const AMOUNT_IN =
  /(?:₹|\bRs\.?)\s*(\d+(?:\s*,\s*\d+)*(?:\.\d+)?)\s*(crore|Crore|lakh|Lakh|thousand|Thousand|कोटी|कोटि|कोट|िोटी|िोटि|िोट|ोटी|ोटि|ोट|लाख|हजार)?/gu;
const AMOUNT = AMOUNT_IN;

/**
 * The same amount, with a stray mark where the page prints ₹.
 *
 * Some documents map the rupee glyph through a font whose encoding the text
 * layer cannot resolve, and emit a backtick instead. `` ` 40.80 कोटी `` is what
 * arrives; ₹ 40.80 कोटी is what the page prints.
 *
 * **This is decoding, not inference**, and the distinction is the whole reason
 * it is allowed here while `039` refuses the same repair on OCR output. There,
 * a mark is an engine's guess at a glyph it could not recognise, and no one can
 * say what was printed. Here the glyph *is* printed: every fact now stores the
 * region it came from, so the exact characters can be rendered and looked at.
 * They were, for one site in each of the twelve affected documents, and eleven
 * showed ₹ unambiguously — see `040`.
 *
 * It is still not trusted on sight. A figure read this way carries a lower
 * confidence than one whose mark the layer resolved, and it reaches a reader
 * only after a person has reviewed it, like every other candidate.
 */
export const AMOUNT_WITH_SUBSTITUTED_MARK =
  /[`´]\s*(\d+(?:\s*,\s*\d+)*(?:\.\d+)?)\s*(crore|Crore|lakh|Lakh|thousand|Thousand|कोटी|कोटि|कोट|िोटी|िोटि|िोट|ोटी|ोटि|ोट|लाख|हजार)?/gu;

/**
 * How many amounts on this page lost their currency mark.
 *
 * Scoped to the page, like `pageDeclaresUnit`. A stray backtick on an otherwise
 * sound page is punctuation; a page carrying several of them is one whose font
 * mapping dropped a glyph, and only there is the mark read as a currency
 * symbol. Requiring the page to show the defect before decoding any of its
 * marks is what keeps a quoted word from becoming a government figure.
 */
const SUBSTITUTION_EVIDENCE = /[`´]\s?\d[\d,]*(?:\.\d+)?/gu;

/** One mark alone is punctuation; this many on one page is a broken mapping. */
const SUBSTITUTIONS_BEFORE_DECODING = 2;

export function pageLostItsCurrencyMark(page: string): boolean {
  return (page.match(SUBSTITUTION_EVIDENCE) ?? []).length >= SUBSTITUTIONS_BEFORE_DECODING;
}

/**
 * `M/s.` is the conventional marker for a firm in Indian government documents.
 * Matching bare capitalised phrases would sweep up place names, scheme names
 * and headings, so only the explicit marker is trusted.
 */
const CONTRACTOR = /\bM\/s\.?\s+([A-Z][^,.;()]{2,70}?)(?=\s*[,.;()]|\s+(?:for|was|had|to)\b)/gu;

/**
 * A designation and, where stated, the office it sits in. This records that a
 * role is mentioned near a claim — never that a person is responsible for an
 * outcome. `.docs/17-legal/legal-ethical-rules.md` forbids the second, and a
 * regex is nowhere near able to establish it.
 */
const OFFICER =
  /\b((?:Executive|Superintending|Deputy|Chief|Junior|Sectional|Assistant)\s+Engineer|Collector|Secretary)\b(?:\s*,?\s*([A-Z][A-Za-z\s]{2,44}?))?(?=\s*[,.;()]|\s+(?:requested|stated|had|was|issued)\b)/gu;

/**
 * Decimal places from the unit the text states down to paise, for the one
 * conversion in the codebase — `shiftedToPaise`, shared with BEAMS.
 *
 * A shift rather than a multiplier over thousands. The distinction is not
 * cosmetic: routing crore through thousands ran the sub-paise check at the
 * wrong scale, refusing figures that were exactly representable and truncating
 * others on the way back down.
 */
const SCALE: Readonly<Record<string, number>> = {
  thousand: 5,
  हजार: 5,
  lakh: 7,
  लाख: 7,
  crore: 9,
  // The stem, however its matra and its conjunct survived the font mapping.
  कोट: 9,
  "िोट": 9,
  "िोटी": 9,
  "िोटि": 9,
  कोटी: 9,
  कोटि: 9,
  // The text layer's detached-conjunct spelling of the same word. Quoted
  // because the key begins with a combining mark and is not an identifier.
  "ोट": 9,
  "ोटी": 9,
  "ोटि": 9,
};

/**
 * A page that states the unit its figures are in.
 *
 * Audit tables carry the scale in the caption — "(₹ in crore)", "(₹ कोटीत)" —
 * and then print bare numbers in the cells. A bare figure on such a page may
 * belong to that table, and reading it as rupees would understate a government
 * figure by seven orders of magnitude.
 *
 * A declaration names a unit **without naming an amount**: "(₹ in crore)",
 * "(₹ कोटीत)", "(₹ लाखात)". That is the whole discriminator, and it matters —
 * a first attempt matched any parenthesis containing a unit word, which swept
 * up "(₹ 1,902 crore)" and "(₹ 10 crore and above)". Those are a figure and a
 * criterion; each carries its own unit and says nothing about the scale of
 * anything else on the page. Treating them as captions refused whole pages of
 * ordinary rupee prose for no reason.
 *
 * Still deliberately generous within that shape. A false positive leaves a
 * figure unvalued for a person to read; a false negative publishes a wrong
 * number, and when the errors are that asymmetric over-detecting is the safe
 * direction.
 */
const PAGE_DECLARES_UNIT =
  /\(\s*(?:₹|Rs\.?|amount|amounts|रक्कम)?[^)\d]{0,18}?(?:crore|lakh|thousand|कोट|िोट|ोट|लाख|हजार)[^)\d]{0,10}\)|(?:₹|\bRs\.?|amount|amounts)\s*(?:are\s+)?in\s+(?:crore|lakh|thousand)/iu;

/**
 * Spellings that sit where a unit goes and are not units this parser knows.
 *
 * "₹ 145 core" is crore misspelled, and "₹ 7,700 cr" is crore abbreviated. The
 * parser does not translate either — mapping a typo to a meaning is a guess
 * about what a government document intended. What it must not do is treat them
 * as *absent*: reading "₹ 145 core" as one hundred and forty-five rupees would
 * be wrong by seven orders of magnitude, and it is wrong precisely because the
 * source did state a unit.
 *
 * So an attempted-but-unreadable unit refuses, wherever it appears and whatever
 * its page declares. "No unit was written" and "a unit was written that I
 * cannot read" are different facts, and only the first licenses rupees.
 *
 * `million` and `billion` are here rather than in `SCALE` deliberately. They are
 * not ambiguous words — but they occur **once** in 4,586 pages, and one data
 * point is not enough to add a scale to the money path. Refusing sends that one
 * figure to a person, which is what a single unfamiliar unit deserves; if these
 * become common in another state's reports, they earn a `SCALE` entry then.
 */
/**
 * Words that make a ₹ a column header rather than the start of a figure.
 *
 * The word may be abbreviated — "Amt. in ₹" — but the **"in" is required**, and
 * that boundary was found the hard way. Dropping it, and adding "total", was an
 * attempt to catch a hypothetical "Amount ₹ 1"; it instead suppressed
 * "Total ₹ 12.11 crore", "total amount ₹ 7.42 crore" and "Paid amount
 * ₹ 6,30,612" — nineteen real figures already verified, to catch a form no
 * document in this corpus actually produces.
 *
 * So this matches what the corpus contains and not what it might. A heading
 * reads "Amount in ₹"; prose reads "amount of ₹" or "amount ₹". The "in" is the
 * only reliable separator, and a guard that guesses wider destroys more than it
 * saves.
 */
/**
 * A decimal point the text layer split from its fraction, with a unit after it.
 *
 * "CGF of ₹177. 75 crore" is ₹177.75 crore. The digit group stops at the point,
 * so the figure was stored as ₹177 — wrong by seven orders of magnitude, and
 * silently, because ₹177 is a perfectly well-formed number.
 *
 * The guard refuses rather than repairs. Allowing whitespace inside the decimal
 * would also match "cost ₹ 100. 5 villages were covered", reading ₹100.5 where
 * the source says ₹100 — trading a rare truncation for a commoner invention.
 * Requiring a unit word after the fraction is what keeps the two apart, and a
 * refused figure goes to a person rather than into the ledger.
 */
/**
 * A scale word that governs a bracketed group rather than the amount inside it.
 *
 * The page states "shortfall of ₹11,553 (₹7,011+₹4,542) crore". Both amounts in
 * the bracket are in crore, and both were read as plain rupees — ₹4,542 instead
 * of ₹4,542 crore, **wrong by seven orders of magnitude**, in a well-formed
 * small figure nothing downstream could question. Three such readings reached
 * the review queue and were caught by hand.
 *
 * So an unqualified amount is refused when a closing bracket followed by a
 * scale word can be reached from it without leaving the bracket. The lookahead
 * is bounded and stops at any further bracket or full stop, because a scale
 * word two clauses away governs something else.
 */
const SCALE_OUTSIDE_BRACKET =
  /^[^().।]{0,40}\)\s*(?:crore|Crore|lakh|Lakh|thousand|Thousand|कोटी|कोटि|कोट|िोटी|िोटि|िोट|ोटी|ोटि|ोट|लाख|हजार)\b/u;

const SPLIT_DECIMAL = /^\.\s+\d+\s*(?:crore|lakh|thousand|कोट|िोट|ोट|लाख|हजार)/iu;

const DECLARES_RUPEES = /(?:amount|amounts|amt|figures?|value|values|rupees)\.?\s+in\s*$/iu;

const UNREADABLE_UNIT =
  /^\s*(?:core|cores|crores|cr|crs|lac|lacs|lakhs|thousands|million|millions|billion|billions|mn|bn|करोड|कोटय|ोटय)\b/iu;

/**
 * A word in a script the parser does not read, standing where a scale word
 * would.
 *
 * Tamil Nadu publishes its reports as separate Tamil and English PDFs, and the
 * Tamil half arrives two ways: in visual glyph order (`ணைாடி` where Unicode
 * spells `கோடி`), and as mojibake mixing Tamil with Latin-1 (`ேகா}`). Both keep
 * the digits and destroy the word. `₹2,43,749.34 ணைாடி` — the state's revenue
 * receipts, in crore — was read as ₹2,43,749: the same seven-order error as
 * `₹ 2.12 िोटी`, arrived at from a different direction.
 *
 * The rule states only what the parser can honestly claim. It reads English and
 * Devanagari; a figure whose next word is in neither has a magnitude it cannot
 * establish, so the figure is refused. Combining marks count as letters here
 * because a Tamil vowel sign leads the word once the text layer has reordered
 * it — `ேகா}` begins with one.
 *
 * Punctuation is deliberately outside the class. An amount followed by an en
 * dash or an ellipsis is ordinary English typesetting, and matching those would
 * retire figures that are already published and correct.
 */
const UNREADABLE_SCRIPT = /^\s*(?![A-Za-z]|\p{Script=Devanagari})(?:\p{L}|\p{M})/u;

/** Whether this page states a scale its bare figures could belong to. */
export function pageDeclaresUnit(content: string): boolean {
  return PAGE_DECLARES_UNIT.test(content);
}

/**
 * How to read a figure the source attached no unit to.
 *
 * `refuse` is the historical behaviour and stays the default: a bare figure in
 * a BEAMS export means thousands, and guessing there inflated a figure a
 * thousandfold. `rupees` is only ever passed for a figure in audit prose on a
 * page that declares no scale, where the ₹ sign is present and the amount is
 * simply written out — "₹1,500 per month", "₹50,000 per student".
 */
export type UnitlessReading = "refuse" | "rupees";

/**
 * Characters of context kept either side of a match.
 *
 * The evidence a reviewer reads must contain the claim and enough around it to
 * judge the claim — and no more. Audit PDFs run headings and numbered sections
 * into the body text, so splitting on sentences alone produced spans up to
 * 2,957 characters for a single figure. Nobody reviews that carefully, and an
 * unreviewable candidate is worse than none.
 */
const CONTEXT_CHARS = 160;

/**
 * A window around a match, snapped to word boundaries and marked where it was
 * cut, so a reviewer can see the text continues rather than mistaking a
 * fragment for a complete statement.
 */
export function contextAround(text: string, start: number, end: number): string {
  const from = Math.max(0, start - CONTEXT_CHARS);
  const to = Math.min(text.length, end + CONTEXT_CHARS);
  const head = from === 0 ? "" : "… ";
  const tail = to === text.length ? "" : " …";
  const body = text.slice(from, to).trim();
  return `${head}${body}${tail}`;
}

const SENTENCE_BREAK = /(?<!\bM\/s)(?<!\bNo)(?<!\bRs)(?<![A-Z])\.\s+(?=[A-Z₹(])/gu;

/** A sentence, and where each of its characters sits in the page's text. */
export interface LocatedSentence {
  readonly text: string;
  /** `source[i]` is the index in the page of this sentence's character `i`. */
  readonly source: readonly number[];
}

/**
 * Splits into sentences without losing the abbreviations these documents use,
 * and says where every character came from.
 *
 * The offsets are what let a figure be traced to a region of the page. They
 * have to be carried rather than recomputed, because the split runs over text
 * whose whitespace has been collapsed: a match at index 40 of a sentence is not
 * at index 40 of anything stored, and searching the page for the matched string
 * would find the wrong occurrence whenever a figure repeats.
 *
 * `sentencesOf` is kept as the plain-text view and delegates here, so there is
 * one splitter and no chance of the two disagreeing about where a sentence ends.
 */
/**
 * Collapses runs of whitespace to one space, remembering where each surviving
 * character came from. `source[i]` is the index in `page` of `collapsed[i]`.
 */
function collapseWhitespace(page: string): { collapsed: string; source: number[] } {
  let collapsed = "";
  const source: number[] = [];
  let inRun = false;

  for (let i = 0; i < page.length; i++) {
    const ch = page[i] ?? "";
    const isSpace = /\s/u.test(ch);
    if (isSpace && inRun) continue;
    collapsed += isSpace ? " " : ch;
    source.push(i);
    inRun = isSpace;
  }

  return { collapsed, source };
}

/** The half-open range of each sentence in the collapsed text. */
function sentenceRanges(collapsed: string): { start: number; end: number }[] {
  const pieces: { start: number; end: number }[] = [];
  let cursor = 0;

  SENTENCE_BREAK.lastIndex = 0;
  for (const m of collapsed.matchAll(SENTENCE_BREAK)) {
    // The whole separator is dropped, full stop included. That is not a
    // stylistic choice: `String.split` discarded it, so every sentence ever
    // reviewed was stored without it. Keeping it here re-words the evidence of
    // every decided fact and strands the decision — which is exactly what
    // happened when this was first written the other way.
    pieces.push({ start: cursor, end: m.index });
    cursor = m.index + m[0].length;
  }
  pieces.push({ start: cursor, end: collapsed.length });

  return pieces;
}

export function locatedSentencesOf(page: string): LocatedSentence[] {
  const { collapsed, source } = collapseWhitespace(page);

  const out: LocatedSentence[] = [];
  for (const piece of sentenceRanges(collapsed)) {
    let { start } = piece;
    let { end } = piece;
    while (start < end && /\s/u.test(collapsed[start] ?? "")) start++;
    while (end > start && /\s/u.test(collapsed[end - 1] ?? "")) end--;
    if (end <= start) continue;
    out.push({ text: collapsed.slice(start, end), source: source.slice(start, end) });
  }
  return out;
}

/** Splits into sentences without losing the abbreviations these documents use. */
export function sentencesOf(page: string): string[] {
  return locatedSentencesOf(page).map((s) => s.text);
}

/**
 * Converts a stated amount to paise exactly.
 *
 * Reuses the thousands scaling already proven against BEAMS rather than
 * writing a second money path — two conversions that can disagree is how one
 * of them silently becomes wrong.
 */
/** A figure written out in rupees is two decimal shifts from paise. */
const RUPEES_SHIFT = 2;

export function amountToPaise(
  digits: string,
  unit: string | undefined,
  unitless: UnitlessReading = "refuse",
): bigint | null {
  // Never a silent default. An unqualified figure was once read as thousands,
  // an assumption carried over from BEAMS, whose report headers say "Amounts
  // In Thousands"; a bare "₹1,53,427" in a rent calculation is rupees, and
  // reading it as thousands inflated it a thousandfold.
  //
  // `rupees` is the caller stating that it has checked the page states no
  // scale, so the ₹ figure is written out in full. It is an argument rather
  // than a default because the whole defect was a default nobody passed.
  if (unit === undefined && unitless === "refuse") return null;

  // A figure written out in full is two decimal shifts from paise. Reading it
  // by way of thousands and dividing back down truncated "₹1.234" to ₹1.23 —
  // a silent repair of exactly the kind this parser exists to refuse.
  const shift = unit === undefined ? RUPEES_SHIFT : SCALE[unit.toLowerCase()];
  if (shift === undefined) return null;

  try {
    // `shiftedToPaise` strips commas but not spaces, and the digit group may now
    // carry the ones the text layer injected between them.
    return shiftedToPaise(digits.replace(/\s+/gu, ""), shift, unit ?? "rupees");
  } catch (error) {
    // `thousandsToPaise` throws rather than round, which is right for a BEAMS
    // cell: a figure the parser cannot represent exactly is a defect in a
    // structured export. Prose is different — an odd figure is expected, and
    // aborting would lose every other candidate in a 337-page report. The
    // candidate survives with no value, for a person to read and supply.
    if (error instanceof AmountFormatError) return null;
    throw error;
  }
}

/**
 * Lowercase words that occur inside a proper name rather than ending one.
 * Deliberately tiny: every addition widens what the trimmer will swallow.
 */
const NAME_JOINERS = new Set(["of", "&"]);

/**
 * Cuts a captured name at the point it stops being a name.
 *
 * The regexes end their capture at a lookahead of punctuation or a stop-verb,
 * and that verb list can never be complete — real captures ran on into
 * "…Gondia communicated", "…Nashik Region sanctioned", "…Developers under the
 * Clause 7". Rather than enumerate the verbs, this keeps tokens only while they
 * still look like part of a name and stops at the first one that does not.
 *
 * It also stops at "and", which in these documents joins two separate parties
 * ("M/s A and M/s B"). Keeping the first and dropping the second loses a
 * candidate; keeping both would invent a single firm that does not exist, and
 * the reviewer still sees the whole sentence.
 */
/** Tokens kept while they still look like part of a name. */
function nameTokens(captured: string): string[] {
  const kept: string[] = [];
  for (const token of captured.trim().split(/\s+/u)) {
    const word = token.replace(/[,.;:]+$/u, "");
    if (word === "" || word.toLowerCase() === "and") break;
    // A date, a page number or a paragraph reference — never part of a name.
    if (/\d/u.test(word) && !/^[A-Z][A-Z\d-]*$/u.test(word)) break;
    if (/^[a-z]/u.test(word)) {
      if (!NAME_JOINERS.has(word.toLowerCase())) break;
      kept.push(word);
      continue;
    }
    kept.push(word);
  }
  return kept;
}

export function trimToName(captured: string): string {
  const kept = nameTokens(captured);
  // A trailing initial means the capture stopped inside a name, not at the end
  // of one: "M/s Water Staywordship Organization J.V Baramati" ends its capture
  // at the full stop in "J." and yields "…Organization J". Dropping the stray
  // letter and keeping the rest names a different firm than the page does — a
  // joint venture reduced to one of its partners — and a misnamed firm on a
  // public claim is the error this parser exists to avoid. So it captures
  // nothing: a missed contractor costs a reviewer nothing.
  const last = kept[kept.length - 1] ?? "";
  if (kept.length > 1 && last.length === 1 && /^[A-Z]$/u.test(last)) return "";

  // A trailing joiner is the start of something that was cut, not the end of
  // the name.
  while (kept.length > 0) {
    const tail = kept[kept.length - 1] ?? "";
    if (tail.length > 1 && !NAME_JOINERS.has(tail.toLowerCase())) break;
    kept.pop();
  }
  return kept.join(" ");
}

/**
 * How this page is to be read, decided once for the page and carried down.
 *
 * These are page-scoped judgements — whether a caption declares a scale,
 * whether the font mapping dropped the rupee glyph — and no single sentence can
 * make either of them. Passing them together keeps that visible.
 */
interface ReadingRules {
  readonly pageNumber: number;
  readonly unitless: UnitlessReading;
  /** True where the page shows a lost currency glyph; see `pageLostItsCurrencyMark`. */
  readonly decodeMark: boolean;
  readonly locate?: (from: number, to: number) => FactCandidate["box"];
}

function moneyIn(sentence: string, rules: ReadingRules): FactCandidate[] {
  const found = matchesIn(sentence, AMOUNT, rules, false);
  if (rules.decodeMark) {
    found.push(...matchesIn(sentence, AMOUNT_WITH_SUBSTITUTED_MARK, rules, true));
  }
  return found;
}

/**
 * Whether an unqualified amount's scale can be trusted to be absent.
 *
 * Four ways it cannot: a unit the parser could not read, a word in a script it
 * does not read at all, a fraction the text layer separated from its decimal
 * point, and a scale word the sentence states outside a bracket that governs
 * what is inside it. Each means the figure has a magnitude the parser cannot
 * establish, so it is refused rather than read as rupees — which is the same
 * error seven orders down.
 */
function scaleIsUnusable(sentence: string, from: number): boolean {
  const after = sentence.slice(from, from + 20);
  return (
    UNREADABLE_UNIT.test(after) ||
    UNREADABLE_SCRIPT.test(after) ||
    SPLIT_DECIMAL.test(after) ||
    SCALE_OUTSIDE_BRACKET.test(sentence.slice(from, from + 60))
  );
}

function matchesIn(
  sentence: string,
  pattern: RegExp,
  rules: ReadingRules,
  markWasDecoded: boolean,
): FactCandidate[] {
  const found: FactCandidate[] = [];
  for (const m of sentence.matchAll(pattern)) {
    // A ₹ that ends a column header is a declaration, not a figure. Audit tables
    // headed "No. | Name of Institution | Amount in ₹" are followed by the first
    // row, so the digits after that ₹ are a serial number: "Amount in ₹ 1
    // Academy of Nursing … 33,000" yielded ₹1. The symbol says what the column
    // holds; it does not begin an amount.
    if (DECLARES_RUPEES.test(sentence.slice(Math.max(0, m.index - 24), m.index))) continue;

    const reading =
      m[2] === undefined && scaleIsUnusable(sentence, m.index + m[0].length)
        ? "refuse"
        : rules.unitless;
    const paise = amountToPaise(m[1] ?? "", m[2], reading);
    found.push({
      kind: "monetary_amount",
      pageNumber: rules.pageNumber,
      rawText: contextAround(sentence, m.index, m.index + m[0].length),
      normalisedValue: paise === null ? null : paise.toString(),
      // A stated unit is the safest reading. A figure read as rupees because
      // its page declares no scale is a sound inference and still an
      // inference, so it sits between a stated unit and no reading at all.
      // A decoded mark sits below a stated one at every tier. The glyph was
      // read from the page rather than from the text layer, and a reader is
      // entitled to know the difference before the figure is published.
      ...(() => {
        const verdict = validate({
          kind: "monetary_amount",
          evidence: sentence,
          at: m.index,
          length: m[0].length,
        });
        return { validation: verdict, perUnit: verdict.perUnit ?? null };
      })(),
      extractionConfidence: markWasDecoded
        ? m[2] !== undefined
          ? 0.5
          : 0.3
        : m[2] !== undefined
          ? 0.8
          : paise === null
            ? 0.4
            : 0.6,
      ...(() => {
        const box = rules.locate?.(m.index, m.index + m[0].length);
        return box === undefined ? {} : { box };
      })(),
    });
  }
  return found;
}

function contractorsIn(sentence: string, pageNumber: number): FactCandidate[] {
  const found: FactCandidate[] = [];
  for (const m of sentence.matchAll(CONTRACTOR)) {
    const firm = trimToName(m[1] ?? "");
    // Nothing survived the trim, so the capture was never a name. A candidate
    // naming no one wastes review time and can only mislead.
    if (firm === "") continue;
    found.push({
      kind: "contractor_reference",
      validation: validate({
        kind: "contractor_reference",
        evidence: sentence,
        at: m.index,
        length: m[0].length,
      }),
      perUnit: null,
      pageNumber,
      rawText: contextAround(sentence, m.index, m.index + m[0].length),
      normalisedValue: firm,
      extractionConfidence: 0.7,
    });
  }
  return found;
}

function officersIn(sentence: string, pageNumber: number): FactCandidate[] {
  const found: FactCandidate[] = [];
  for (const m of sentence.matchAll(OFFICER)) {
    const role = m[1] ?? "";
    const office = trimToName(m[2] ?? "");
    found.push({
      kind: "officer_role_reference",
      validation: validate({
        kind: "officer_role_reference",
        evidence: sentence,
        at: m.index,
        length: m[0].length,
      }),
      perUnit: null,
      pageNumber,
      rawText: contextAround(sentence, m.index, m.index + m[0].length),
      normalisedValue: office === "" ? role : `${role}, ${office}`,
      // A designation is easy to spot; which office it belongs to, and whether
      // the sentence attributes anything to it, is not.
      extractionConfidence: 0.5,
    });
  }
  return found;
}

function candidatesIn(sentence: string, rules: ReadingRules): FactCandidate[] {
  return [
    ...moneyIn(sentence, rules),
    ...contractorsIn(sentence, rules.pageNumber),
    ...officersIn(sentence, rules.pageNumber),
  ];
}

export interface PageInput {
  readonly pageNumber: number;
  readonly content: string | null;
  /**
   * The page's text items, if the caller has them. Supplying them is what lets
   * a fact carry a region; omitting them changes nothing else.
   */
  readonly items?: readonly TextItem[];
}

export function extractFacts(pages: readonly PageInput[]): FactCandidate[] {
  const out: FactCandidate[] = [];
  for (const page of pages) {
    if (page.content === null) continue;
    // Decided per page, not per sentence: a table's caption sits at the top and
    // governs cells far below it, well outside any one sentence's window.
    const unitless: UnitlessReading = pageDeclaresUnit(page.content) ? "refuse" : "rupees";
    // Scoped to the page for the same reason: one stray mark is punctuation,
    // several are a font mapping that dropped the rupee glyph.
    const decodeMark = pageLostItsCurrencyMark(page.content);
    const items = page.items;
    for (const sentence of locatedSentencesOf(page.content)) {
      // Sentence offsets are meaningless to anyone else, so the mapping back to
      // the page — and from there to a region — is closed over here.
      const locate =
        items === undefined
          ? undefined
          : (from: number, to: number): FactCandidate["box"] => {
              const start = sentence.source[from];
              const last = sentence.source[to - 1];
              if (start === undefined || last === undefined) return undefined;
              return boxAround(items, start, last + 1) ?? undefined;
            };
      out.push(
        ...candidatesIn(sentence.text, {
          pageNumber: page.pageNumber,
          unitless,
          decodeMark,
          ...(locate === undefined ? {} : { locate }),
        }),
      );
    }
  }
  return out;
}
