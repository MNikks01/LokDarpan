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

  // Was "drops a trailing stray initial", which kept the rest of the capture.
  // A trailing initial means the capture stopped *inside* a name — the page
  // says "M/s Water Staywordship Organization J.V Baramati", a joint venture —
  // and keeping the head of it names one partner instead of the venture. The
  // asymmetry that governs this parser applies: a missed firm costs a reviewer
  // nothing, a misnamed one attaches the wrong company to a public claim.
  it("captures nothing when a trailing initial shows the name was cut", () => {
    expect(trimToName("Water Staywordship Organization J")).toBe("");
  });

  // A single capital on its own is not a name that was cut; there is nothing
  // to be wrong about.
  it("still returns empty for a lone initial", () => {
    expect(trimToName("J")).toBe("");
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
  // read: the candidate is kept for review with no value attached. Ten decimal
  // places in crore is finer than a paisa, so there is no exact reading to
  // give it — unlike six places, which is ₹1,23,456 and is kept.
  it("keeps a figure it cannot normalise, with a null value rather than a guess", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "A sum of ₹ 0.1234567890 crore was noted." },
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

describe("a declaration names a unit without naming an amount", () => {
  // "(₹ 1,902 crore)" is a figure carrying its own unit, and "(₹ 10 crore and
  // above)" is a criterion. Neither says anything about the scale of other
  // figures on the page, and treating them as captions refused whole pages of
  // ordinary rupee prose.
  it("does not mistake a parenthesised figure for a table caption", () => {
    const [found] = extractFacts([
      {
        pageNumber: 1,
        content:
          "The increase was under Urban development (₹ 1,902 crore). " +
          "A benefit of ₹ 1,500 per month is paid to each woman.",
      },
    ])
      .filter((f) => f.kind === "monetary_amount")
      .slice(1);
    expect(found?.normalisedValue).toBe("150000");
  });

  it("still refuses on a genuine caption", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "Table 2.6 (₹ in crore) Sr. Grant ₹ 5376.31 total." },
    ]).find((f) => f.kind === "monetary_amount");
    expect(found?.normalisedValue).toBeNull();
  });
});

describe("an unreadable unit is not a missing unit", () => {
  // "₹ 145 core" is crore misspelled. Reading it as one hundred and forty-five
  // rupees would be wrong by seven orders of magnitude — and wrong precisely
  // because the source did state a unit.
  it("refuses a figure whose unit was written but cannot be read", () => {
    for (const text of ["₹ 145 core under mining", "a loan of ₹ 7,700 cr in 2023-24"]) {
      const found = extractFacts([{ pageNumber: 1, content: text }]).find(
        (f) => f.kind === "monetary_amount",
      );
      expect(found?.normalisedValue).toBeNull();
    }
  });

  it("still reads a figure that simply states no unit", () => {
    const [found] = extractFacts([
      { pageNumber: 1, content: "a penalty of ₹54,33,780 was levied on 14 schools" },
    ]);
    expect(found?.normalisedValue).toBe("543378000");
  });
});

describe("a firm cut mid-name is not a firm", () => {
  // "M/s Water Staywordship Organization J.V Baramati" is a joint venture. The
  // capture stops at the full stop in "J.", and dropping the stray initial to
  // keep "…Organization" names one partner instead of the venture the page
  // names. A misnamed firm on a public claim is the error this parser exists to
  // avoid, so it captures nothing.
  it("captures nothing when the name was cut at an initial", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "awarded to M/s Water Staywordship Organization J.V Baramati" },
    ]).filter((f) => f.kind === "contractor_reference");
    expect(found).toHaveLength(0);
  });

  it("still captures a firm whose name ends cleanly", () => {
    const [found] = extractFacts([
      { pageNumber: 1, content: "awarded to M/s Vijay Constructions, Nagpur for the work." },
    ]).filter((f) => f.kind === "contractor_reference");
    expect(found?.normalisedValue).toBe("Vijay Constructions");
  });
});

describe("units the font mapping fragmented", () => {
  // 721 figures were read as bare rupees because their crore stem lost its
  // matra to the broken font mapping — wrong by seven orders of magnitude.
  it("reads crore however its matra survived", () => {
    for (const unit of ["कोटी", "कोट2", "कोट5", "कोट-", "कोट"]) {
      const [found] = extractFacts([{ pageNumber: 1, content: `एकूण ₹ 15.14 ${unit} होता.` }]);
      expect(found?.normalisedValue).toBe("15140000000");
    }
  });

  // These reports index their own series with all-caps codes — GSS, ES, RS,
  // COPU — so a table of report numbers produced ₹916, ₹33, ₹37, ₹54 and ₹56.
  // Across the corpus every `RS` before digits is a series code, and no genuine
  // `Rs.` currency marker exists at all.
  it("does not read an all-caps RS series code as a currency marker", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "GSS 12, 17 2015-16 37 10 RS 9, 16 2015-16 26 11 COPU 08,09" },
    ]).filter((f) => f.kind === "monetary_amount");
    expect(found).toHaveLength(0);
  });

  it("still reads a properly written Rs. figure", () => {
    const [found] = extractFacts([{ pageNumber: 1, content: "a contract of Rs. 1,234.56 crore." }]);
    expect(found?.normalisedValue).toBe("1234560000000");
  });

  // "(₹ कोट त)" is "(₹ in crore)" with the same fragmentation. Missing it made
  // the page look like it declared no scale, which licensed the rupee reading.
  it("recognises a table caption whose unit the font mapping fragmented", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "परिशिष्ट 2.7 बचत (₹ कोट त) अनु. क्र. ₹ 5376.31 आहे." },
    ]).find((f) => f.kind === "monetary_amount");
    expect(found?.normalisedValue).toBeNull();
  });
});

describe("crore whose conjunct the font mapping substituted", () => {
  // Document 3511 renders every क as ि, so its crore figures read "₹ 2.12 िोटी"
  // and were stored as ₹1 — wrong by seven orders of magnitude. Measured over
  // the corpus the character before ोट after a figure is क (2,027), ि (21) or
  // absent (7); those are listed, and nothing beyond them is guessed at.
  it("reads crore when क has been replaced by ि", () => {
    for (const unit of ["िोटी", "िोट", "कोटी", "ोटी"]) {
      const [found] = extractFacts([
        { pageNumber: 1, content: `नुकसान भरपाई ₹ 2.12 ${unit} होती.` },
      ]);
      expect(found?.normalisedValue).toBe("2120000000");
    }
  });

  it("recognises a caption whose unit carries the substituted conjunct", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "तक्ता 3 (₹ िोटीत) अनु. क्र. ₹ 5376.31 आहे." },
    ]).find((f) => f.kind === "monetary_amount");
    expect(found?.normalisedValue).toBeNull();
  });
});

describe("a ₹ that ends a column header", () => {
  // "No. | Name of Institution | Amount in ₹" is followed by the first row, so
  // the digits after that ₹ are a serial number. Three facts read ₹1, ₹23 and
  // ₹51 out of row numbers before this was guarded.
  // The first version required "amount in" exactly, and let "Amt. in ₹ 1" and
  // "Amount ₹ 1" through — both of which fabricate ₹1 out of a row number.
  it.each([
    "No. Name of Institution Amount in ₹ 1 Academy of Nursing Bhopal 33,000",
    "Sl. Name Amt. in ₹ 1 Academy of Nursing Bhopal 33,000",
    "Sl. Name Value in ₹ 51 Indira Gandhi Memorial College",
  ])("does not start a figure at a column header: %s", (content) => {
    const found = extractFacts([{ pageNumber: 1, content }]).filter(
      (f) => f.kind === "monetary_amount",
    );
    expect(found).toHaveLength(0);
  });

  // The "in" is what separates a heading from prose, and it must stay required.
  // Without it, "Total ₹ 12.11 crore" and "Paid amount ₹ 6,30,612" are
  // suppressed too — nineteen real figures lost to catch a form no document
  // here actually produces.
  it.each([
    ["The amount of ₹ 15.14 crore was sanctioned.", "15140000000"],
    ["a total of ₹ 4.53 crore was paid", "4530000000"],
    ["value of ₹ 2,268 was paid", "226800"],
    ["Total ₹ 12.11 crore was spent", "12110000000"],
    ["total amount ₹ 7.42 crore up to October 2024", "7420000000"],
  ])("still reads a figure the sentence introduces: %s", (content, expected) => {
    const [found] = extractFacts([{ pageNumber: 1, content }]);
    expect(found?.normalisedValue).toBe(expected);
  });

  it("still reads a figure that merely follows the word amount", () => {
    const [found] = extractFacts([
      { pageNumber: 1, content: "The amount of ₹ 15.14 crore was sanctioned." },
    ]);
    expect(found?.normalisedValue).toBe("15140000000");
  });
});

describe("units that occur too rarely to scale", () => {
  // "Loan amount Rs 283.9 Million or Rs 28.39 crores" — one occurrence in 4,586
  // pages. Read as rupees it is wrong by a million; given a SCALE entry on one
  // data point it would be a guess. Refusing sends it to a person.
  it("refuses million rather than reading it as rupees", () => {
    const found = extractFacts([
      { pageNumber: 1, content: "Loan amount Rs 283.9 Million was sanctioned." },
    ]).find((f) => f.kind === "monetary_amount");
    expect(found?.normalisedValue).toBeNull();
  });
});

describe("a decimal point split from its fraction", () => {
  // "CGF of ₹177. 75 crore" is ₹177.75 crore. The digit group stops at the
  // point, so it was stored as ₹177 — wrong by seven orders of magnitude, and
  // silently, because ₹177 is a perfectly well-formed number.
  it("refuses a figure whose fraction was separated from its point", () => {
    for (const text of ["CGF of ₹177. 75 crore was provided", "actual of ₹ 1636. 54 crore"]) {
      const found = extractFacts([{ pageNumber: 1, content: text }]).find(
        (f) => f.kind === "monetary_amount",
      );
      expect(found?.normalisedValue).toBeNull();
    }
  });

  // The reason it refuses rather than repairs: without the unit requirement,
  // repairing would read ₹100.5 here, where the source says ₹100.
  it("does not disturb a figure followed by a sentence break", () => {
    const [found] = extractFacts([
      { pageNumber: 1, content: "The cost was ₹ 100. 5 villages were covered by the scheme." },
    ]);
    expect(found?.normalisedValue).toBe("10000");
  });
});

describe("a scale word in a script the parser does not read", () => {
  // Tamil Nadu publishes Tamil and English as separate PDFs. The Tamil text
  // layer arrives either in visual glyph order — ணைாடி where Unicode spells
  // கோடி — or as mojibake mixing Tamil with Latin-1: ேகா}. Digits survive both;
  // the word does not. Read as rupees, the state's revenue receipts shrink by
  // seven orders of magnitude.
  it("refuses a figure whose next word it cannot read", () => {
    for (const text of [
      "மாநிைத்தின் பமாத்த வருவாய் ₹2,43,749.34 ணைாடி ஆை இருந்தது",
      "ெமாÚத உÚதரவாதÕகã ₹1,22,269.91 ேகா} ஆ¤Ý",
    ]) {
      const found = extractFacts([{ pageNumber: 1, content: text }]).find(
        (f) => f.kind === "monetary_amount",
      );
      expect(found?.normalisedValue).toBeNull();
    }
  });

  // Devanagari is a script the parser does read, so an ordinary word after a
  // figure is not evidence of a lost unit — it is a sentence continuing.
  it("still reads a figure followed by a word it does read", () => {
    const [found] = extractFacts([
      { pageNumber: 1, content: "एकूण ₹ 54,33,780 रुपये वसूल करण्यात आले." },
    ]);
    expect(found?.normalisedValue).toBe("543378000");
  });

  // Punctuation is not a word. Matching it would retire published figures.
  it("still reads a figure followed by punctuation", () => {
    for (const text of ["a grant of ₹ 1,00,000 — paid in March", "arrears of ₹ 2,500 … in all"]) {
      const found = extractFacts([{ pageNumber: 1, content: text }]).find(
        (f) => f.kind === "monetary_amount",
      );
      expect(found?.normalisedValue).not.toBeNull();
    }
  });
});
