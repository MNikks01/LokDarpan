import { contextAround, type FactCandidate } from "./facts";
import { validate } from "./validation";

/**
 * Governments and departments named in audit prose (ADR-074).
 *
 * A body enters the ledger only from a page that names it and a person who
 * agrees the page does. This module proposes the names. Like every extractor
 * here it under-reaches on purpose: a department it misses costs a reviewer
 * nothing, while a fragment it offers ("Development Department" out of "Rural
 * Development Department") costs a decision.
 *
 * What a candidate says: this page prints this name. Not that the page's
 * figures are about that body, and nothing downstream may present them so.
 */

/**
 * A run of capitalised words, joined by "and", "&" or commas, ending in
 * "Department". Lower-case joiners are allowed because the names contain them
 * ("Water Supply and Sanitation Department"); anything else lower-case ends the
 * run, so a sentence's preceding words are not swept in.
 */
const DEPARTMENT = /\b((?:[A-Z][A-Za-z'’-]*,?\s+(?:(?:and|&)\s+)?){1,7})Department\b/gu;

/**
 * "Government of Maharashtra", "Government of India", "Government of Madhya
 * Pradesh". Only the place is captured: the words after it are a heading or the
 * next sentence ("Government of Maharashtra Report No. 2"), and a two-word name
 * is accepted only with the second words state names use.
 */
const GOVERNMENT =
  /\bGovernment of ([A-Z][a-z]+(?:\s+(?:Pradesh|Nadu|Bengal)|\s+and\s+Kashmir)?)\b/gu;

/**
 * Words that open a run without being part of a name: sentence starters,
 * determiners, and the generic qualifiers audit prose puts before "Department"
 * when it means whichever department it was just discussing.
 */
const NOT_A_NAME = new Set([
  "a",
  "according",
  "administrative",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "as",
  "at",
  "audit",
  "but",
  "by",
  "concerned",
  "during",
  "each",
  "every",
  "for",
  "from",
  "further",
  "government",
  "however",
  "if",
  "implementing",
  "in",
  "its",
  "line",
  "nodal",
  "of",
  "on",
  "other",
  "respective",
  "said",
  "state",
  "such",
  "that",
  "the",
  "their",
  "these",
  "this",
  "to",
  "under",
  "when",
  "while",
  "with",
]);

/** Joiners belong inside a name, never at either end of one. */
const JOINERS = new Set(["and", "&"]);

/**
 * Words after which a name starts afresh. Report pages run headings, titles and
 * glossary abbreviations straight into the name that follows them
 * ("Principal Secretary Finance Department", "Introduction The Social Justice
 * and Special Assistance Department", "PWD Public Works Department"), so the
 * name is what comes after the last of these, not everything before
 * "Department".
 */
const RESTARTS = new Set([
  "accordingly",
  "act",
  "additional",
  "amount",
  "assistant",
  "chief",
  "commissioner",
  "department",
  "departmental",
  "deputy",
  "director",
  "engineer",
  "executive",
  "funds",
  "general",
  "gom",
  "guidelines",
  "hon’ble",
  "hon'ble",
  "introduction",
  "joint",
  "level",
  // The state's own name opens a run ("Maharashtra Finance Department"); the
  // department is named without it, as the rest of the report names it.
  "maharashtra",
  "minister",
  "observations",
  "officer",
  "principal",
  "report",
  "rule",
  "sample",
  "secretary",
  "similarly",
  "total",
  "under",
]);

/** A glossary abbreviation: "PWD", "UDD", "DDOs". */
const ABBREVIATION = /^[A-Z]{2,}s?$/u;

function startsAfresh(word: string): boolean {
  const lower = word.toLowerCase();
  if (JOINERS.has(lower)) return false;
  // "General" opens a real name ("General Administration Department") as well
  // as a title ("Director General"); it restarts only when it is not first.
  return NOT_A_NAME.has(lower) || RESTARTS.has(lower) || ABBREVIATION.test(word);
}

/**
 * The department name a run spells, or `null` if it spells none.
 *
 * The name is the words after the last one that cannot be part of a name. What
 * remains must still contain a word of its own: "The Department" and
 * "Government Department" name nothing a reader could look up.
 */
export function departmentName(run: string): string | null {
  const words = run
    .replace(/,/gu, " ")
    .split(/\s+/u)
    .filter((w) => w !== "");
  let start = 0;
  words.forEach((w, i) => {
    if (w.toLowerCase() === "general" && i === start) return;
    if (startsAfresh(w)) start = i + 1;
  });
  const rest = words.slice(start);
  const isWord = (w: string): boolean => !JOINERS.has(w.toLowerCase());
  const first = rest.findIndex(isWord);
  if (first === -1) return null;
  const last = rest.length - 1 - [...rest].reverse().findIndex(isWord);
  const name = rest.slice(first, last + 1);
  // "Director General Department" leaves "General", which names nothing.
  if (name.length === 1 && name[0]?.toLowerCase() === "general") return null;
  return `${name.join(" ")} Department`;
}

/** Bodies named in one sentence. */
export function bodiesIn(sentence: string, pageNumber: number): FactCandidate[] {
  const found: FactCandidate[] = [];
  const add = (name: string, at: number, length: number, confidence: number): void => {
    found.push({
      kind: "body_reference",
      validation: validate({ kind: "body_reference", evidence: sentence, at, length }),
      perUnit: null,
      pageNumber,
      rawText: contextAround(sentence, at, at + length),
      normalisedValue: name,
      extractionConfidence: confidence,
    });
  };

  for (const m of sentence.matchAll(DEPARTMENT)) {
    const name = departmentName(m[1] ?? "");
    if (name === null) continue;
    // A name is easy to spot and easy to cut short; a reviewer confirms both
    // that it is whole and that it names a body rather than a heading.
    add(name, m.index, m[0].length, 0.6);
  }
  for (const m of sentence.matchAll(GOVERNMENT)) {
    add(`Government of ${m[1] ?? ""}`, m.index, m[0].length, 0.7);
  }
  return found;
}

/**
 * One candidate per name per document: the first page that prints it.
 *
 * A report names its Finance Department dozens of times, and each mention is
 * the same claim. Asking a reviewer to confirm all of them would spend their
 * attention on repetition; one confirmed page per report is what establishes
 * the name and links the report to the body.
 */
export function firstMentionOfEach(candidates: readonly FactCandidate[]): FactCandidate[] {
  const seen = new Set<string | null>();
  const kept: FactCandidate[] = [];
  for (const c of candidates) {
    if (c.kind !== "body_reference") {
      kept.push(c);
      continue;
    }
    if (seen.has(c.normalisedValue)) continue;
    seen.add(c.normalisedValue);
    kept.push(c);
  }
  return kept;
}
