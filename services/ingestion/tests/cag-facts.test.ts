import { describe, expect, it } from "vitest";

import {
  amountToPaise,
  contextAround,
  extractFacts,
  sentencesOf,
  trimToName,
} from "../src/cag/facts";

describe("amountToPaise", () => {
  // The unit is the whole risk here: the same digits mean four different
  // amounts depending on the word after them.
  it("scales each published unit", () => {
    expect(amountToPaise("15.14", "crore")).toBe(15_140_000_000n);
    expect(amountToPaise("40", "lakh")).toBe(40_00_000_00n);
    expect(amountToPaise("1,234", "thousand")).toBe(12_34_000_00n);
  });

  it("treats an unqualified figure as the smallest reading", () => {
    expect(amountToPaise("500", undefined)).toBe(amountToPaise("500", "thousand"));
  });

  it("refuses a unit it does not know rather than guessing a scale", () => {
    expect(amountToPaise("10", "billion")).toBeNull();
  });
});

describe("trimToName", () => {
  // Each of these is a real capture from the three ingested CAG reports.
  it("stops at the verb the sentence continues into", () => {
    expect(trimToName("Gondia communicated")).toBe("Gondia");
    expect(trimToName("MJP Nashik Region sanctioned")).toBe("MJP Nashik Region");
    expect(trimToName("Joy Developers under the Clause 7")).toBe("Joy Developers");
    expect(trimToName("SJSAD wherein the audit objectives")).toBe("SJSAD");
  });

  it("keeps the first party when two are joined", () => {
    expect(trimToName("MTP-INNOVINC-HES Joint Venture and M/s Rites Water Solutions")).toBe(
      "MTP-INNOVINC-HES Joint Venture",
    );
  });

  it("keeps a hyphenated acronym but drops a date or reference number", () => {
    expect(trimToName("SMC-CAPCO-PLUTO Joint Venture")).toBe("SMC-CAPCO-PLUTO Joint Venture");
    expect(trimToName("Vijay Constructions 29/09/2022 168")).toBe("Vijay Constructions");
  });

  it("drops a trailing stray initial", () => {
    expect(trimToName("Water Staywordship Organization J")).toBe("Water Staywordship Organization");
  });

  it("keeps a joiner that sits inside the name", () => {
    expect(trimToName("Department of Industries")).toBe("Department of Industries");
  });

  it("returns empty when nothing in the capture is a name", () => {
    expect(trimToName("and the")).toBe("");
  });
});

describe("contextAround", () => {
  const text = `${"a ".repeat(200)}TARGET${" b".repeat(200)}`;
  const start = text.indexOf("TARGET");

  it("always contains the matched text", () => {
    expect(contextAround(text, start, start + 6)).toContain("TARGET");
  });

  it("bounds the span a reviewer has to read", () => {
    expect(contextAround(text, start, start + 6).length).toBeLessThan(400);
  });

  it("marks where it cut, so a fragment is not read as a whole statement", () => {
    const cut = contextAround(text, start, start + 6);
    expect(cut.startsWith("…")).toBe(true);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("does not mark an edge it did not cut", () => {
    expect(contextAround("₹ 5 crore was spent", 0, 9)).toBe("₹ 5 crore was spent");
  });
});

describe("extractFacts", () => {
  const page =
    "The work was awarded by the Executive Engineer, Public Works Division, Nagpur to " +
    "M/s. Vijay Constructions, Nagpur for ₹ 15.14 crore. The work remained incomplete.";

  it("reads the contractor, the office and the amount from one sentence", () => {
    const found = extractFacts([{ pageNumber: 1, content: page }]);
    expect(found.map((f) => f.normalisedValue)).toEqual(
      expect.arrayContaining([
        "Vijay Constructions",
        "Executive Engineer, Public Works Division",
        15_140_000_000n.toString(),
      ]),
    );
  });

  // The promise the whole review step rests on: a reviewer can judge a
  // candidate from the text stored beside it, without reopening the PDF.
  it("stores evidence that contains the text it extracted from", () => {
    for (const fact of extractFacts([{ pageNumber: 1, content: page }])) {
      expect(fact.rawText.replace(/…/gu, "").trim().length).toBeGreaterThan(0);
      expect(page).toContain(fact.rawText.replace(/…/gu, "").trim().slice(0, 40));
    }
  });

  it("never returns a candidate already marked as anything but a candidate", () => {
    for (const fact of extractFacts([{ pageNumber: 1, content: page }])) {
      expect(fact.extractionConfidence).toBeGreaterThan(0);
      expect(fact.extractionConfidence).toBeLessThan(1);
    }
  });

  it("skips a page whose text could not be read, rather than treating it as empty prose", () => {
    expect(extractFacts([{ pageNumber: 1, content: null }])).toEqual([]);
  });

  it("finds nothing in prose that states no figure or party", () => {
    expect(
      extractFacts([{ pageNumber: 1, content: "The Department accepted the audit observation." }]),
    ).toEqual([]);
  });
});

describe("sentencesOf", () => {
  it("does not split on the abbreviations these documents use", () => {
    const s = sentencesOf("Paid to M/s. Alpha Ltd. for the work. The next sentence begins.");
    expect(s[0]).toContain("M/s. Alpha");
  });
});
