import { describe, expect, it } from "vitest";

import type { FactCandidate } from "../src/cag/facts";
import { asScanFact, type ScanReading } from "../src/ocr/scan-facts";

const reading: ScanReading = {
  id: 9,
  pageNumber: 4,
  engine: "tesseract",
  engineVersion: "5.5.3",
  content: "a contract value of ₹ 15.14 crore",
  words: [
    // The sentence round the figure, read badly: it says nothing of the figure.
    { seq: 0, charStart: 0, charEnd: 19, x0: 10, y0: 700, x1: 120, y1: 712, confidence: 0.1 },
    { seq: 1, charStart: 20, charEnd: 33, x0: 130, y0: 700, x1: 200, y1: 712, confidence: 0.9 },
  ],
};

const candidate = (over: Partial<FactCandidate> = {}): FactCandidate => ({
  kind: "monetary_amount",
  pageNumber: 4,
  rawText: "a contract value of ₹ 15.14 crore",
  normalisedValue: "15140000000",
  extractionConfidence: 0.9,
  validation: { state: "accepted", reason: "" },
  perUnit: null,
  box: { x0: 130, y0: 700, x1: 200, y1: 712 },
  ...over,
});

describe("asScanFact", () => {
  const fact = asScanFact(candidate(), reading);

  it("names the reading and the engine, and is always for review", () => {
    expect(fact).toMatchObject({
      pageReadingId: 9,
      extractionMethod: "regex over OCR reading (tesseract 5.5.3)",
      validation: { state: "needs_review" },
    });
    expect(fact.validation.reason).toContain("check it against the page image");
  });

  it("measures legibility from the words inside the figure's box, not the sentence", () => {
    expect(fact.readingConfidence).toBe(0.9);
    expect(fact.extractionConfidence).toBeCloseTo(0.81, 3);
  });

  it("keeps the parser's own reason after the scan's", () => {
    const flagged = asScanFact(
      candidate({ validation: { state: "needs_review", reason: "a rate" } }),
      reading,
    );
    expect(flagged.validation.reason).toMatch(/page image; a rate$/u);
  });

  it("measures nothing for a figure with no box, so it is never published", () => {
    const { box: _box, ...withoutBox } = candidate();
    const unboxed = asScanFact(withoutBox, reading);
    expect(unboxed.readingConfidence).toBeUndefined();
    expect(unboxed.extractionConfidence).toBe(0.9);
  });
});
