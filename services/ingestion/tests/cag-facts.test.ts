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

  // The bug this replaced: an unqualified figure was read as thousands, an
  // assumption carried from BEAMS report headers. Audit prose states no such
  // thing, and a bare "₹1,53,427" rent figure became ₹15.34 crore.
  it("refuses to invent a unit the source did not state", () => {
    expect(amountToPaise("500", undefined)).toBeNull();
  });

  // These reports are bilingual and the Marathi half states units in
  // Devanagari. Matching only Latin words left every Marathi figure looking
  // unqualified: "₹ 27,559.26 कोटी" was stored as ₹27,559.26.
  it("reads the Devanagari unit words the Marathi half uses", () => {
    expect(amountToPaise("15.14", "कोटी")).toBe(amountToPaise("15.14", "crore"));
    expect(amountToPaise("113.47", "लाख")).toBe(amountToPaise("113.47", "lakh"));
    expect(amountToPaise("500", "हजार")).toBe(amountToPaise("500", "thousand"));
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
  // A real sentence from the Marathi half of the Nagpur report, whose scale was
  // read four orders of magnitude wrong before Devanagari units were matched.
  it("scales a Marathi figure by the unit its own sentence states", () => {
    const found = extractFacts([{ pageNumber: 1, content: "एकूण यनधी ₹ 27,559.26 कोटी होता." }]);
    const amount = found.find((f) => f.kind === "monetary_amount");
    expect(amount?.normalisedValue).toBe(27_559_26_00_00_000n.toString());
  });

  // Audit prose writes crore and lakh out when it means them, so a ₹ figure
  // with no scale word is the amount itself — "₹1,53,427" is one lakh
  // fifty-three thousand four hundred and twenty-seven rupees.
  it("reads a figure with no stated unit as rupees when its page declares no scale", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "Total annual Rent for both the offices: ₹1,53,427 was paid." },
    ]);
    const amount = found.find((f) => f.kind === "monetary_amount");
    expect(amount?.normalisedValue).toBe("15342700");
    // A sound inference is still an inference, and says so.
    expect(amount?.extractionConfidence).toBeLessThan(0.8);
  });

  // The dangerous direction, and the reason the reading is page-scoped. A table
  // states its scale in the caption and then prints bare cells; reading one of
  // those as rupees understates a government figure by seven orders of
  // magnitude, so on such a page the parser goes back to refusing.
  it("refuses to scale a bare figure on a page whose caption declares a unit", () => {
    const found = extractFacts([
      {
        pageNumber: 1,
        content:
          "Table 2.6: Unnecessary Supplementary Budget Allocation (₹ in crore) " +
          "Sr. No. Grant Amount 1. A-2 ₹ 5376.31 for the year.",
      },
    ]);
    const amount = found.find((f) => f.kind === "monetary_amount");
    expect(amount?.normalisedValue).toBeNull();
  });

  it("refuses on a Marathi table that declares its scale as (₹ कोटीत)", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "परिशिष्ट 2.7 मोठ्या बचती (₹ कोटीत) अनु. क्र. ₹ 5376.31 आहे." },
    ]);
    const amount = found.find((f) => f.kind === "monetary_amount");
    expect(amount?.normalisedValue).toBeNull();
  });

  // The text layer drops the leading conjunct of कोटी, leaving "ोटी". The
  // figure is in crore whatever happened to the glyph.
  it("reads कोटी even when the text layer detached its conjunct", () => {
    const [found] = extractFacts([
      { pageNumber: 1, content: "देय रक्कम ₹ 919.80 ोटींच् या इतकी होती." },
    ]);
    expect(found?.normalisedValue).toBe("919800000000");
  });

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

  // The "M/s." marker is not by itself proof that a name follows it.
  it("drops a firm marker whose capture trims away to nothing", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "Paid to M/s. And the work was abandoned." },
    ]);
    expect(found.filter((f) => f.kind === "contractor_reference")).toEqual([]);
  });

  it("records a designation with no office stated, rather than inventing one", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "The Executive Engineer stated that the work was complete." },
    ]);
    expect(found.map((f) => f.normalisedValue)).toContain("Executive Engineer");
  });

  // Missing is never zero, and a figure read wrongly is worse than one not
  // read: the candidate is kept for review with no value attached.
  it("keeps a figure it cannot normalise, with a null value rather than a guess", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "A sum of ₹ 0.123456 crore was noted." },
    ]);
    const amounts = found.filter((f) => f.kind === "monetary_amount");
    expect(amounts).toHaveLength(1);
    expect(amounts[0]?.normalisedValue).toBeNull();
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

describe("digit groups the text layer has split", () => {
  // "₹ 20 ,564.71 कोटी" on page 32 of the Mumbai SFAR. The old digit group
  // stopped at the injected space, captured "20", and lost the कोटी that
  // followed — so the figure was stored with no value and offered to a
  // reviewer as "the source stated no unit". The unit is printed on the page.
  it("reads a figure whose digit group carries an injected space", () => {
    const [found] = extractFacts([
      { pageNumber: 32, content: "राज्याची रोख शिल्लक ₹ 20 ,564.71 कोटी होती." },
    ]);
    expect(found?.normalisedValue).toBe("20564710000000");
  });

  it("reads the same figure identically when the text layer did not split it", () => {
    const [split] = extractFacts([{ pageNumber: 1, content: "शिल्लक ₹ 97 ,188.32 कोटी होती." }]);
    const [whole] = extractFacts([{ pageNumber: 1, content: "शिल्लक ₹ 97,188.32 कोटी होती." }]);
    expect(split?.normalisedValue).toBe(whole?.normalisedValue);
  });

  // The guard on the widening: a comma is required to continue the group, so
  // two figures separated by a space stay two figures. Merging them would
  // invent a number that appears nowhere on the page.
  it("does not run two adjacent figures together", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "A benefit of ₹ 1,500 and an outlay of ₹ 26,200 crore." },
    ]).filter((f) => f.kind === "monetary_amount");
    expect(found).toHaveLength(2);
    expect(found[1]?.normalisedValue).toBe("26200000000000");
  });

  // Still no default unit. A split digit group is a reading problem; an absent
  // unit is the source declining to state a scale, and the two must not be
  // confused now that one of them has been fixed.
  it("reads a split digit group with no unit as rupees", () => {
    const [found] = extractFacts([
      { pageNumber: 1, content: "Total annual rent of ₹ 1 ,53,427 was paid." },
    ]);
    expect(found?.normalisedValue).toBe("15342700");
  });
});

describe("Rs is a currency marker, not the end of an English word", () => {
  // The pattern is case-insensitive and these reports are written in English.
  // Without a word boundary "Parameters 2020-21" read as ₹2020 and
  // "Surrenders 2.5.4" as ₹2.5 — a year and a paragraph number entering the
  // ledger as money.
  it("does not read the tail of a plural noun as a currency marker", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "Parameters 2020-21 and Surrenders 2.5.4 are shown." },
    ]).filter((f) => f.kind === "monetary_amount");
    expect(found).toHaveLength(0);
  });

  it("does not turn a trailing comma into a figure", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "based on vouchers, challans, and subsidiary registers." },
    ]).filter((f) => f.kind === "monetary_amount");
    expect(found).toHaveLength(0);
  });

  it("still reads a real Rs figure", () => {
    const [found] = extractFacts([{ pageNumber: 1, content: "a contract of Rs. 1,234.56 crore." }]);
    expect(found?.normalisedValue).toBe("1234560000000");
  });
});
