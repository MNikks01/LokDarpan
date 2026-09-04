import { describe, expect, it } from "vitest";

import { locatedSentencesOf, sentencesOf } from "../src/cag/facts";

/**
 * The splitter as it stood before offsets were carried, character for
 * character.
 *
 * It is reproduced here rather than described because the property that
 * matters is byte-equality with it. Every review decision in the ledger is
 * keyed on the evidence text this produced; a splitter that disagrees with it
 * by one character orphans those decisions, and no amount of the new version
 * "looking right" would have caught that.
 */
function splitAsBefore(page: string): string[] {
  return page
    .replace(/\s+/gu, " ")
    .split(/(?<!\bM\/s)(?<!\bNo)(?<!\bRs)(?<![A-Z])\.\s+(?=[A-Z₹(])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const PAGES = [
  "The department released ₹177.79 crore. Of this M/s Kumar Builders drew ₹12.11 crore.",
  "Para No. 4.2 refers. Rs. 45 lakh was sanctioned in 2019. (₹2.50 crore was not.)",
  "मुख्य लेखापरीक्षक ने ₹3.75 कोटी की राशि. Audit observed a shortfall.",
  "Amount in ₹\n1 Academy of Nursing 33,000\n2 Institute of Health 1,20,000",
  "No full stops here at all just a long line of prose with ₹5 lakh in it",
  "Trailing sentence ends the page. ",
  "  Leading whitespace and\ttabs\n\nand blank lines. Then ₹1 crore.",
  "A.B.C. Ltd. was paid ₹9 crore. See Annexure I.",
];

describe("sentence splitting is unchanged by carrying offsets", () => {
  for (const [i, page] of PAGES.entries()) {
    it(`page ${String(i)} splits exactly as it did before`, () => {
      expect(sentencesOf(page)).toEqual(splitAsBefore(page));
    });
  }

  it("agrees on a page built to hit every abbreviation guard at once", () => {
    const page = PAGES.join(" ");
    expect(sentencesOf(page)).toEqual(splitAsBefore(page));
  });
});

describe("offsets address the page the evidence came from", () => {
  it("maps every character of every sentence back to the page", () => {
    for (const page of PAGES) {
      for (const sentence of locatedSentencesOf(page)) {
        expect(sentence.source).toHaveLength(sentence.text.length);
        for (const [i, at] of sentence.source.entries()) {
          const inPage = page[at];
          const inSentence = sentence.text[i];
          // Collapsed runs of whitespace point at the run's first character,
          // so a space maps to whitespace rather than to a space exactly.
          if (inSentence === " ") expect(inPage).toMatch(/\s/u);
          else expect(inPage).toBe(inSentence);
        }
      }
    }
  });

  it("keeps offsets strictly increasing, so a range is a range", () => {
    for (const page of PAGES) {
      for (const { source } of locatedSentencesOf(page)) {
        for (let i = 1; i < source.length; i++) {
          expect(source[i]).toBeGreaterThan(source[i - 1] ?? -1);
        }
      }
    }
  });

  it("points at the figure, not merely near it", () => {
    const page = "The first grant was ₹5 lakh. The second grant was ₹5 lakh.";
    const sentences = locatedSentencesOf(page);
    expect(sentences).toHaveLength(2);

    // The same string twice: a searcher would find the first for both, which is
    // the failure this mapping exists to prevent.
    const second = sentences[1];
    if (second === undefined) throw new Error("expected a second sentence");
    const at = second.text.indexOf("₹5 lakh");
    const start = second.source[at];
    if (start === undefined) throw new Error("expected an offset");
    expect(start).toBe(page.lastIndexOf("₹5 lakh"));
  });
});
