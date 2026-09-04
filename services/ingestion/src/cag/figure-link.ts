/**
 * Pairing the two halves of a bilingual report.
 *
 * These CAG reports are one PDF containing the whole report in Marathi and
 * then the whole report in English, so extraction reads every figure twice.
 * Both facts are true — each page does state the amount — but an aggregate
 * that sums them counts the same rupee twice. Migration 0014 records the
 * relationship; this decides which facts hold it.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * It does not try to resolve an ambiguous pairing. Where a value appears more
 * than once in a half, page alignment and the surrounding amounts were both
 * measured against 359 known-good pairs and neither separates the candidates:
 * alignment residuals run to 29 pages, and of 348 ambiguous Marathi facts the
 * neighbouring-amount signal was decisive for 97 and tied for 201. A wrong
 * pairing merges two distinct government figures into one and is worse than
 * the double count it was meant to fix, so an ambiguous group is left unlinked
 * and counted twice until someone decides it.
 */

/** Which half of the document a page belongs to. */
export type Half = "devanagari" | "latin";

export interface LinkableFact {
  readonly id: number;
  readonly documentId: number;
  readonly pageNumber: number;
  readonly normalisedValue: string | null;
}

export interface Pair {
  /** The fact that becomes a second citation — the Devanagari one. */
  readonly citationId: number;
  /**
   * The fact to count, and the one a citation resolves to.
   *
   * The Latin-half fact, because this corpus's Devanagari text layer mangles
   * conjuncts: the English row is the one whose stored evidence a reader can
   * read back. Not a claim that English is authoritative.
   */
  readonly countedId: number;
}

export interface LinkOutcome {
  readonly pairs: readonly Pair[];
  /** Values appearing more than once in a half, left for a person. */
  readonly ambiguous: number;
  /** Values found in only one half, which are simply single facts. */
  readonly unpaired: number;
}

/**
 * The half a page belongs to, by which script its own text is mostly written
 * in.
 *
 * Judged from the page rather than from a fact's evidence window: a window is
 * a couple of hundred characters and can be almost entirely digits, while the
 * page it came from is never ambiguous about which half of the report it is.
 */
export function halfOfPage(content: string): Half {
  const devanagari = (content.match(/[ऀ-ॿ]/gu) ?? []).length;
  const latin = (content.match(/[A-Za-z]/gu) ?? []).length;
  return devanagari > latin ? "devanagari" : "latin";
}

/**
 * Pairs facts stating the same value in opposite halves of the same document.
 *
 * Only where exactly one fact holds that value in each half. Anything else is
 * counted and reported, never guessed at.
 */
export function pairFigures(
  facts: readonly LinkableFact[],
  halfOf: (documentId: number, pageNumber: number) => Half | undefined,
): LinkOutcome {
  const groups = new Map<string, { devanagari: LinkableFact[]; latin: LinkableFact[] }>();

  for (const fact of facts) {
    if (fact.normalisedValue === null) continue;
    const half = halfOf(fact.documentId, fact.pageNumber);
    if (half === undefined) continue;
    const key = `${String(fact.documentId)}|${fact.normalisedValue}`;
    const group = groups.get(key) ?? { devanagari: [], latin: [] };
    group[half].push(fact);
    groups.set(key, group);
  }

  const pairs: Pair[] = [];
  let ambiguous = 0;
  let unpaired = 0;

  for (const group of groups.values()) {
    if (group.devanagari.length === 0 || group.latin.length === 0) {
      unpaired += 1;
      continue;
    }
    const citation = group.devanagari[0];
    const counted = group.latin[0];
    if (group.devanagari.length !== 1 || group.latin.length !== 1) {
      ambiguous += 1;
      continue;
    }
    if (citation === undefined || counted === undefined) continue;
    pairs.push({ citationId: citation.id, countedId: counted.id });
  }

  return { pairs, ambiguous, unpaired };
}
