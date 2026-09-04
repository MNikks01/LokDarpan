import { AmountFormatError, thousandsToPaise } from "../beams/amount";

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
export const PARSER_VERSION = "cag-facts/6";

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
 * `Rs` needs a word boundary because the pattern is case-insensitive and these
 * reports are full of English plurals. Without it "Parameters 2020-21" read as
 * ₹2020, "Surrenders 2.5.4" as ₹2.5 and "years 10.32" as ₹10.32 — years,
 * paragraph numbers and table columns entering the ledger as money. 64 such
 * candidates existed; none had been verified, because none carried a unit and
 * all of them stopped in the queue as "the source stated no unit".
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
  /(?:₹|\bRs\.?)\s*(\d+(?:\s*,\s*\d+)*(?:\.\d+)?)\s*(crore|lakh|thousand|कोट[ीि]|ोट[ीि]|लाख|हजार)?/giu;
const AMOUNT = AMOUNT_IN;

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
 * Multipliers over `thousandsToPaise`, which is reused rather than reimplemented
 * so there is only one money conversion in the codebase to get wrong.
 */
const SCALE: Readonly<Record<string, number>> = {
  thousand: 1,
  हजार: 1,
  lakh: 100,
  लाख: 100,
  crore: 10_000,
  कोटी: 10_000,
  कोटि: 10_000,
  // The text layer's detached-conjunct spelling of the same word. Quoted
  // because the key begins with a combining mark and is not an identifier.
  "ोटी": 10_000,
  "ोटि": 10_000,
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
  /\(\s*(?:₹|Rs\.?|amount|amounts|रक्कम)?[^)\d]{0,18}?(?:crore|lakh|thousand|कोट[ीि]|ोट[ीि]|लाख|हजार)[^)\d]{0,10}\)|(?:₹|\bRs\.?|amount|amounts)\s*(?:are\s+)?in\s+(?:crore|lakh|thousand)/iu;

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
 */
const UNREADABLE_UNIT =
  /^\s*(?:core|cores|crores|cr|crs|lac|lacs|lakhs|thousands|mn|bn|करोड|कोटय|ोटय)\b/iu;

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

/** Splits into sentences without losing the abbreviations these documents use. */
export function sentencesOf(page: string): string[] {
  return page
    .replace(/\s+/gu, " ")
    .split(/(?<!\bM\/s)(?<!\bNo)(?<!\bRs)(?<![A-Z])\.\s+(?=[A-Z₹(])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Converts a stated amount to paise exactly.
 *
 * Reuses the thousands scaling already proven against BEAMS rather than
 * writing a second money path — two conversions that can disagree is how one
 * of them silently becomes wrong.
 */
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
  if (unit === undefined) {
    if (unitless === "refuse") return null;
    try {
      const rupees = thousandsToPaise(digits.replace(/\s+/gu, ""));
      // thousands → paise is a shift of five; rupees → paise is two.
      return rupees === null ? null : rupees / 1000n;
    } catch (error) {
      if (error instanceof AmountFormatError) return null;
      throw error;
    }
  }
  const multiplier = SCALE[unit.toLowerCase()];
  if (multiplier === undefined) return null;
  try {
    // `scaledToPaise` strips commas but not spaces, and the digit group may now
    // carry the ones the text layer injected between them.
    const paise = thousandsToPaise(digits.replace(/\s+/gu, ""));
    return paise === null ? null : paise * BigInt(multiplier);
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

function moneyIn(sentence: string, pageNumber: number, unitless: UnitlessReading): FactCandidate[] {
  const found: FactCandidate[] = [];
  for (const m of sentence.matchAll(AMOUNT)) {
    // A unit the parser could not read is not a missing unit.
    const after = sentence.slice(m.index + m[0].length, m.index + m[0].length + 12);
    const reading = m[2] === undefined && UNREADABLE_UNIT.test(after) ? "refuse" : unitless;
    const paise = amountToPaise(m[1] ?? "", m[2], reading);
    found.push({
      kind: "monetary_amount",
      pageNumber,
      rawText: contextAround(sentence, m.index, m.index + m[0].length),
      normalisedValue: paise === null ? null : paise.toString(),
      // A stated unit is the safest reading. A figure read as rupees because
      // its page declares no scale is a sound inference and still an
      // inference, so it sits between a stated unit and no reading at all.
      extractionConfidence: m[2] !== undefined ? 0.8 : paise === null ? 0.4 : 0.6,
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

function candidatesIn(
  sentence: string,
  pageNumber: number,
  unitless: UnitlessReading,
): FactCandidate[] {
  return [
    ...moneyIn(sentence, pageNumber, unitless),
    ...contractorsIn(sentence, pageNumber),
    ...officersIn(sentence, pageNumber),
  ];
}

export interface PageInput {
  readonly pageNumber: number;
  readonly content: string | null;
}

export function extractFacts(pages: readonly PageInput[]): FactCandidate[] {
  const out: FactCandidate[] = [];
  for (const page of pages) {
    if (page.content === null) continue;
    // Decided per page, not per sentence: a table's caption sits at the top and
    // governs cells far below it, well outside any one sentence's window.
    const unitless: UnitlessReading = pageDeclaresUnit(page.content) ? "refuse" : "rupees";
    for (const sentence of sentencesOf(page.content)) {
      out.push(...candidatesIn(sentence, page.pageNumber, unitless));
    }
  }
  return out;
}
