import { describe, expect, it } from "vitest";

import { halfOfPage, pairFigures, type LinkableFact } from "../src/cag/figure-link";

const CRORE_100 = "100000000000";
const CRORE_500 = "500000000000";

/** Doc 1 in the corpus: Marathi to page 260, English from 265. */
const half = (_documentId: number, pageNumber: number) =>
  pageNumber < 265 ? ("devanagari" as const) : ("latin" as const);

const fact = (id: number, pageNumber: number, normalisedValue: string | null): LinkableFact => ({
  id,
  documentId: 1,
  pageNumber,
  normalisedValue,
});

describe("halfOfPage", () => {
  it("reads a page by the script most of its own text is in", () => {
    expect(halfOfPage("महसुली तूट ₹ 29,994.76 कोटी होती.")).toBe("devanagari");
    expect(halfOfPage("The revenue deficit was ₹ 29,994.76 crore.")).toBe("latin");
  });

  // Both halves are full of digits and neither is decided by them.
  it("is not swayed by a page that is mostly numbers", () => {
    expect(halfOfPage("1,234.56 7,890.12 3,456.78 अनुदान")).toBe("devanagari");
    expect(halfOfPage("1,234.56 7,890.12 3,456.78 Grant")).toBe("latin");
  });
});

describe("pairFigures", () => {
  it("pairs one figure stated once in each half", () => {
    const out = pairFigures([fact(1, 18, CRORE_100), fact(2, 280, CRORE_100)], half);
    expect(out.pairs).toEqual([{ citationId: 1, countedId: 2 }]);
  });

  // The Latin fact is the one to count: this corpus's Devanagari text layer
  // mangles conjuncts, so the English row is the readable evidence.
  it("counts the Latin fact and makes the Devanagari one the citation", () => {
    const [pair] = pairFigures([fact(9, 300, CRORE_100), fact(8, 20, CRORE_100)], half).pairs;
    expect(pair?.countedId).toBe(9);
    expect(pair?.citationId).toBe(8);
  });

  // The whole point of the conservative rule. Merging two distinct figures is
  // worse than the double count it would have fixed.
  it("refuses to guess when a value appears twice in one half", () => {
    const out = pairFigures(
      [fact(1, 18, CRORE_100), fact(2, 90, CRORE_100), fact(3, 280, CRORE_100)],
      half,
    );
    expect(out.pairs).toHaveLength(0);
    expect(out.ambiguous).toBe(1);
  });

  it("leaves a figure stated in only one half alone", () => {
    const out = pairFigures([fact(1, 18, CRORE_500)], half);
    expect(out.pairs).toHaveLength(0);
    expect(out.unpaired).toBe(1);
  });

  it("never pairs different values, and ignores facts with no value", () => {
    const out = pairFigures(
      [fact(1, 18, CRORE_100), fact(2, 280, CRORE_500), fact(3, 20, null), fact(4, 290, null)],
      half,
    );
    expect(out.pairs).toHaveLength(0);
  });

  // A citation must resolve to a fact that is itself counted, never to another
  // citation: `same_figure_as` is a pointer, and a chain would make the rule
  // "count where it is null" wrong.
  it("never makes a fact both a citation and a target", () => {
    const facts = [
      fact(1, 18, CRORE_100),
      fact(2, 280, CRORE_100),
      fact(3, 20, CRORE_500),
      fact(4, 290, CRORE_500),
    ];
    const { pairs } = pairFigures(facts, half);
    const citations = new Set(pairs.map((p) => p.citationId));
    expect(pairs.some((p) => citations.has(p.countedId))).toBe(false);
  });
});
