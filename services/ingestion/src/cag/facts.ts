import { thousandsToPaise } from "../beams/amount";

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
export const PARSER_VERSION = "cag-facts/2";

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

/** `₹ 15.14 crore`, `₹40 lakh`, `Rs. 1,234.56 crore`. */
const AMOUNT = /(?:₹|Rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(crore|lakh|thousand)?/giu;

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

const SCALE: Readonly<Record<string, number>> = { thousand: 1, lakh: 100, crore: 10_000 };

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
export function amountToPaise(digits: string, unit: string | undefined): bigint | null {
  const multiplier = SCALE[(unit ?? "thousand").toLowerCase()];
  if (multiplier === undefined) return null;
  const paise = thousandsToPaise(digits);
  return paise === null ? null : paise * BigInt(multiplier);
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
export function trimToName(captured: string): string {
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
  // A trailing joiner or stray initial is the start of something that was cut,
  // not the end of the name.
  while (kept.length > 0) {
    const last = kept[kept.length - 1] ?? "";
    if (last.length > 1 && !NAME_JOINERS.has(last.toLowerCase())) break;
    kept.pop();
  }
  return kept.join(" ");
}

function moneyIn(sentence: string, pageNumber: number): FactCandidate[] {
  const found: FactCandidate[] = [];
  for (const m of sentence.matchAll(AMOUNT)) {
    const paise = amountToPaise(m[1] ?? "", m[2]);
    found.push({
      kind: "monetary_amount",
      pageNumber,
      rawText: contextAround(sentence, m.index, m.index + m[0].length),
      normalisedValue: paise === null ? null : paise.toString(),
      // An unqualified figure could be rupees, thousands, or a page number in
      // disguise; a stated unit is far safer to read.
      extractionConfidence: m[2] === undefined ? 0.4 : 0.8,
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

function candidatesIn(sentence: string, pageNumber: number): FactCandidate[] {
  return [
    ...moneyIn(sentence, pageNumber),
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
    for (const sentence of sentencesOf(page.content)) {
      out.push(...candidatesIn(sentence, page.pageNumber));
    }
  }
  return out;
}
