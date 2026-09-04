import { describe, expect, it } from "vitest";

import { substitutedCurrencyMarks } from "../src/cag/extract";
import { extractFacts, pageLostItsCurrencyMark } from "../src/cag/facts";
import { selfCheck } from "../src/review/triage";

/**
 * Some documents map the rupee glyph through a font the text layer cannot
 * resolve, and emit a backtick instead: `` ` 40.80 कोटी `` where the page prints
 * ₹ 40.80 कोटी.
 *
 * Reading that mark as a rupee sign is decoding, not guessing — the glyph is
 * printed, and every fact stores the region it came from, so it can be rendered
 * and looked at. It was, for one site in each affected document. What these
 * tests pin is the *scope* of the decoding: it applies to a page that shows the
 * defect, and to no other, because a backtick quoting a word is punctuation.
 */

const money = (page: string): { value: string | null; confidence: number }[] =>
  extractFacts([{ pageNumber: 1, content: page }])
    .filter((f) => f.kind === "monetary_amount")
    .map((f) => ({ value: f.normalisedValue, confidence: f.extractionConfidence }));

describe("counting the pages that lost their currency glyph", () => {
  it("counts a mark standing before an amount", () => {
    expect(substitutedCurrencyMarks("interest of ` 40.80 crore was due")).toBe(1);
    expect(substitutedCurrencyMarks("` 3,094.72 कोटी and ` 56.74 कोटी")).toBe(2);
  });

  it("does not count a backtick that is only punctuation", () => {
    expect(substitutedCurrencyMarks("the department's `own funds` were used")).toBe(0);
    expect(substitutedCurrencyMarks("see note `a` below")).toBe(0);
  });

  it("reports zero as a measurement, not as an absence", () => {
    // A page read with no such mark is a different fact from a page never read.
    expect(substitutedCurrencyMarks("₹ 40.80 crore was released")).toBe(0);
  });
});

describe("decoding is scoped to a page that shows the defect", () => {
  it("reads the mark where the page carries several of them", () => {
    const page = "A sum of ` 40.80 crore was due. A further ` 25.96 crore was released.";
    expect(pageLostItsCurrencyMark(page)).toBe(true);
    expect(money(page).map((m) => m.value)).toEqual(["40800000000", "25960000000"]);
  });

  it("leaves a lone mark alone", () => {
    // One backtick is punctuation. Decoding it would let a quoted word become a
    // government figure.
    const page = "The department's `own funds` covered ` 12.50 crore of the cost.";
    expect(pageLostItsCurrencyMark(page)).toBe(false);
    expect(money(page)).toEqual([]);
  });

  it("does not disturb a page whose layer resolved the glyph", () => {
    const page = "₹ 40.80 crore was due and ₹ 25.96 crore was released.";
    expect(pageLostItsCurrencyMark(page)).toBe(false);
    expect(money(page).map((m) => m.value)).toEqual(["40800000000", "25960000000"]);
  });
});

describe("a decoded figure is marked as less certain than a stated one", () => {
  it("sits below a stated mark at the same tier", () => {
    const stated = money("₹ 40.80 crore was due and ₹ 25.96 crore was released.");
    const decoded = money("` 40.80 crore was due and ` 25.96 crore was released.");

    expect(stated[0]?.value).toBe(decoded[0]?.value);
    // Same figure, lower confidence: the glyph was read from the page rather
    // than from the text layer, and a reviewer is entitled to know.
    expect(decoded[0]?.confidence).toBeLessThan(stated[0]?.confidence ?? 1);
  });

  it("is lower still where no scale word follows", () => {
    const page = "` 1,53,427 was paid and ` 2,40,000 remained.";
    const found = money(page);
    expect(found).toHaveLength(2);
    for (const f of found) expect(f.confidence).toBeLessThanOrEqual(0.3);
  });
});

describe("decoding does not weaken the guards it passes through", () => {
  it("still refuses a unit it cannot read", () => {
    const page = "` 40.80 core was due. ` 25.96 core was released.";
    // "core" is not "crore"; the parser refuses rather than reading rupees.
    expect(money(page).every((m) => m.value === null)).toBe(true);
  });

  it("still refuses a figure whose page declares its scale in a caption", () => {
    const page = "(Amount in ` crore)\n` 40.80 was due. ` 25.96 was released.";
    expect(money(page).every((m) => m.value === null)).toBe(true);
  });

  it("does not read a mark that ends a column header as a figure", () => {
    const page = "No. Name of Institution Amount in ` 1 Academy of Nursing 33,000. ` 5.00 crore.";
    expect(money(page).map((m) => m.value)).not.toContain("100");
  });
});

describe("the self-check can reproduce a decoded reading", () => {
  it("finds the stored value in evidence whose mark was decoded", () => {
    // A self-check blind to the decoding reported all 469 facts of this class
    // as "the stored value appears nowhere in its own evidence" — a defect flag
    // on every candidate of a class that is not defective, which buries the
    // real mismatches rather than surfacing them.
    const checked = selfCheck({
      id: 1,
      rawText:
        "certified annual 12 BG: ` 9085.20 crore and tied grant: ` 13,627.80 crore 13 Amravati",
      normalisedValue: "13627800000000",
    });
    expect(checked.check).not.toBe("mismatch");
    expect(checked.amountsInEvidence).toContain("13627800000000");
  });

  it("still reports a genuine mismatch on a decoded page", () => {
    const checked = selfCheck({
      id: 2,
      rawText: "a sum of ` 40.80 crore and ` 25.96 crore",
      normalisedValue: "999900000000",
    });
    expect(checked.check).toBe("mismatch");
  });
});
