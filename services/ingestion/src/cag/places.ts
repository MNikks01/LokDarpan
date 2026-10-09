import { contextAround, locatedSentencesOf, type FactCandidate, type PageInput } from "./facts";
import { validate } from "./validation";

/**
 * Districts and talukas named on audit pages (ADR-077).
 *
 * Unlike every other extractor here, this one cannot invent its subject: it
 * matches only the names of places the ledger already holds for the report's
 * own state. What a reviewer confirms is that the word names that place on the
 * page — not a person called Satara, a scheme, or a town of the same name in
 * another district.
 *
 * It under-reaches on purpose, like the others. A taluka it skips costs nothing;
 * one it pins wrongly puts a mark on a map a reader may act on. So:
 * - a taluka whose name another taluka in the state shares is skipped, because
 *   the page cannot be read for which one it means;
 * - a taluka named as its district is, or as any district is, is read as the
 *   district;
 * - names of three letters or fewer are skipped ("Man", "Pen", "Wai" are
 *   talukas and are also words);
 * - matching is case-sensitive, Title Case or capitals, so "pen" in a sentence
 *   is never Pen taluka.
 *
 * What a candidate says: this page names this place. Not that the page's
 * figures were spent there, and nothing downstream may present them so.
 */

export type PlaceLevel = "district" | "sub_district";

export interface GazetteerEntry {
  readonly name: string;
  readonly level: PlaceLevel;
}

/** How a place is written in a candidate's value, and read back by the loader. */
const SUFFIX: Readonly<Record<PlaceLevel, string>> = {
  district: "district",
  sub_district: "taluka",
};

/** "Gadchiroli district", "Mul taluka": what a reviewer is shown and may correct. */
export function placeValue(name: string, level: PlaceLevel): string {
  return `${name} ${SUFFIX[level]}`;
}

/** The place a value names, or null when it does not end in a level the loader knows. */
export function parsePlaceValue(value: string): GazetteerEntry | null {
  const trimmed = value.trim();
  for (const level of ["district", "sub_district"] as const) {
    const suffix = ` ${SUFFIX[level]}`;
    if (trimmed.toLowerCase().endsWith(suffix)) {
      const name = trimmed.slice(0, -suffix.length).trim();
      return name === "" ? null : { name, level };
    }
  }
  return null;
}

/**
 * The name as reports write it. OpenStreetMap names some districts with the
 * word itself ("Ahilyanagar District"); reports write "Ahilyanagar district" or
 * just "Ahilyanagar", so the word is dropped and matched separately.
 */
export function bareName(name: string): string {
  return name.replace(/\s+District$/iu, "").trim();
}

const SHORTEST_NAME = 4;

/** The places a page may be matched against, with the ambiguous ones removed. */
export function gazetteerOf(entries: readonly GazetteerEntry[]): GazetteerEntry[] {
  const districts = new Set(
    entries.filter((e) => e.level === "district").map((e) => bareName(e.name)),
  );
  const talukaCounts = new Map<string, number>();
  for (const e of entries) {
    if (e.level !== "sub_district") continue;
    const name = bareName(e.name);
    talukaCounts.set(name, (talukaCounts.get(name) ?? 0) + 1);
  }

  const kept: GazetteerEntry[] = [];
  for (const name of districts) kept.push({ name, level: "district" });
  for (const [name, count] of talukaCounts) {
    if (count > 1 || districts.has(name) || name.length < SHORTEST_NAME) continue;
    kept.push({ name, level: "sub_district" });
  }
  // Longest first, so "Mumbai Suburban" is tried before anything it contains.
  return kept.sort((a, b) => b.name.length - a.name.length);
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** Title Case or capitals, as a whole word; never the lower-case word. */
function patternFor(name: string): RegExp {
  const variants = [escape(name), escape(name.toUpperCase())];
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${variants.join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

/**
 * The first match of a pattern in a sentence that no longer name has already
 * claimed, so "Mumbai Suburban" is not also read as a shorter place inside it.
 */
function firstUnclaimed(
  sentence: string,
  pattern: RegExp,
  claimed: [number, number][],
): { at: number; end: number } | null {
  for (const m of sentence.matchAll(pattern)) {
    const at = m.index;
    const end = at + m[0].length;
    if (!claimed.some(([s, e]) => at < e && end > s)) return { at, end };
  }
  return null;
}

/** One candidate per place per page: the first sentence on the page that names it. */
export function placesIn(
  pages: readonly PageInput[],
  gazetteer: readonly GazetteerEntry[],
): FactCandidate[] {
  const patterns = gazetteer.map((entry) => ({ entry, pattern: patternFor(entry.name) }));
  const out: FactCandidate[] = [];
  for (const page of pages) {
    if (page.content === null) continue;
    const seen = new Set<string>();
    for (const { text: sentence } of locatedSentencesOf(page.content)) {
      const claimed: [number, number][] = [];
      for (const { entry, pattern } of patterns) {
        const value = placeValue(entry.name, entry.level);
        const match = seen.has(value) ? null : firstUnclaimed(sentence, pattern, claimed);
        if (match === null) continue;
        claimed.push([match.at, match.end]);
        seen.add(value);
        out.push({
          kind: "place_reference",
          validation: validate({
            kind: "place_reference",
            evidence: sentence,
            at: match.at,
            length: match.end - match.at,
          }),
          perUnit: null,
          pageNumber: page.pageNumber,
          rawText: contextAround(sentence, match.at, match.end),
          normalisedValue: value,
          // The name is certain to be a place the state holds; whether this
          // word means that place is what the reviewer decides.
          extractionConfidence: entry.level === "district" ? 0.8 : 0.7,
        });
      }
    }
  }
  return out;
}
