import { describe, expect, it } from "vitest";

import { boxAround, cleanWithItems } from "../src/cag/extract";
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

describe("a character range becomes a region", () => {
  // Two items on one line, then one on the line below.
  const items = [
    { seq: 0, charStart: 0, charEnd: 5, x0: 100, y0: 700, x1: 140, y1: 709 },
    { seq: 1, charStart: 5, charEnd: 12, x0: 140, y0: 700, x1: 200, y1: 709 },
    { seq: 2, charStart: 13, charEnd: 20, x0: 100, y0: 688, x1: 170, y1: 697 },
  ];

  it("covers every item the range touches, and no others", () => {
    expect(boxAround(items, 0, 5)).toEqual({ x0: 100, y0: 700, x1: 140, y1: 709 });
    // A figure split across two items is covered by both — which the text layer
    // does routinely, and is the case a single-item box would get wrong.
    expect(boxAround(items, 3, 8)).toEqual({ x0: 100, y0: 700, x1: 200, y1: 709 });
    expect(boxAround(items, 14, 16)).toEqual({ x0: 100, y0: 688, x1: 170, y1: 697 });
  });

  it("spans lines when the range does", () => {
    expect(boxAround(items, 4, 15)).toEqual({ x0: 100, y0: 688, x1: 200, y1: 709 });
  });

  it("returns null rather than a box covering nothing", () => {
    expect(boxAround(items, 12, 13)).toBeNull();
    expect(boxAround([], 0, 5)).toBeNull();
  });

  it("treats the range as half-open, so an abutting item is not swept in", () => {
    // Item 1 begins exactly where this range ends.
    expect(boxAround(items, 0, 5)).toEqual({ x0: 100, y0: 700, x1: 140, y1: 709 });
  });
});

describe("cleanup moves the offsets with the text", () => {
  it("keeps items addressing the characters they held after a strip and trim", () => {
    const raw = "  ab cd  ";
    const items = [
      { seq: 0, charStart: 2, charEnd: 4, x0: 0, y0: 0, x1: 10, y1: 5 },
      { seq: 1, charStart: 5, charEnd: 7, x0: 10, y0: 0, x1: 20, y1: 5 },
    ];
    const cleaned = cleanWithItems(raw, items);

    expect(cleaned.content).toBe("ab cd");
    expect(cleaned.content.slice(cleaned.items[0]?.charStart, cleaned.items[0]?.charEnd)).toBe(
      "ab",
    );
    expect(cleaned.content.slice(cleaned.items[1]?.charStart, cleaned.items[1]?.charEnd)).toBe(
      "cd",
    );
  });

  it("drops an item whose every character was trimmed away", () => {
    const items = [
      { seq: 0, charStart: 0, charEnd: 1, x0: 0, y0: 0, x1: 10, y1: 5 },
      { seq: 1, charStart: 1, charEnd: 3, x0: 10, y0: 0, x1: 20, y1: 5 },
    ];
    const cleaned = cleanWithItems(" ab", items);
    expect(cleaned.content).toBe("ab");
    expect(cleaned.items).toHaveLength(1);
    expect(cleaned.items[0]?.seq).toBe(1);
  });
});
