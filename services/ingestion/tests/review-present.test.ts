import { describe, expect, it } from "vitest";

import {
  PROMPT,
  describeCitation,
  describeConfidence,
  describeValue,
  presentBatch,
  presentCandidate,
  type ReviewCandidate,
} from "../src/review/present";

const candidate: ReviewCandidate = {
  id: 7,
  documentId: 4,
  pageNumber: 112,
  kind: "monetary_amount",
  rawText: "awarded to M/s. Vijay Constructions for a contract value of 15.14 crore",
  normalisedValue: "15140000000",
  extractionConfidence: 0.8,
  parserVersion: "cag-facts/2",
  documentTitle: "Nagpur Report No. 2 of 2026",
  sourceUrl: "https://cag.gov.in/webroot/uploads/download_audit_report/2026/x.pdf",
};

describe("describeValue", () => {
  // A reviewer cannot check "15140000000" against a sentence reading
  // "15.14 crore". Showing paise is how a wrong figure gets waved through.
  it("shows money in rupees, not in stored paise", () => {
    const shown = describeValue("monetary_amount", "15140000000");
    expect(shown).not.toBe("15140000000");
    expect(shown).toContain("15.14");
  });

  it("shows a party's name unchanged", () => {
    expect(describeValue("contractor_reference", "Vijay Constructions")).toBe(
      "Vijay Constructions",
    );
  });

  // Missing is never zero. The reviewer is being asked to supply what the
  // parser could not read, and must not be shown a number that looks decided.
  it("names an unread value as unread rather than as zero or blank", () => {
    const shown = describeValue("monetary_amount", null);
    expect(shown).not.toContain("0");
    expect(shown.trim()).not.toBe("");
    expect(shown).toMatch(/not read/i);
  });

  it("says so plainly when a stored value is not a usable amount", () => {
    expect(describeValue("monetary_amount", "not-a-number")).toContain("unreadable");
  });
});

describe("describeConfidence", () => {
  // The single most dangerous label in the tool. "80%" alone reads as "80%
  // likely this claim is true", which the parser has no basis to say.
  it("states what the number is a claim about", () => {
    expect(describeConfidence(0.8)).toContain("read correctly");
  });

  it("never suggests the underlying statement is true", () => {
    const text = describeConfidence(0.8).toLowerCase();
    expect(text).not.toMatch(/\btrue\b|accurate|correct claim|confidence that this is/);
  });
});

describe("describeCitation", () => {
  it("carries the document, the page and a URL a reader could follow", () => {
    const cited = describeCitation(candidate);
    expect(cited).toContain("Nagpur Report No. 2 of 2026");
    expect(cited).toContain("page 112");
    expect(cited).toContain("https://cag.gov.in/");
  });
});

describe("presentCandidate", () => {
  const shown = presentCandidate(candidate, 3, 1825);

  it("shows the evidence in full, so the claim is judged in its own context", () => {
    expect(shown).toContain(candidate.rawText);
  });

  it("shows position in the queue, the parser's reading, and the citation", () => {
    expect(shown).toContain("3 of 1825");
    expect(shown).toContain("parser read:");
    expect(shown).toContain("page 112");
    expect(shown).toContain("cag-facts/2");
  });

  // `.docs/17-legal/legal-ethical-rules.md` reserves red for destructive user
  // actions. Colouring a candidate by how suspicious it looks would state a
  // conclusion before the reviewer forms one.
  it("uses no colour, only weight", () => {
    const esc = String.fromCharCode(27);
    const codes = [...shown.matchAll(new RegExp(`${esc}\\[(\\d+)m`, "gu"))].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.every((c) => c === "0" || c === "1" || c === "2")).toBe(true);
  });

  it("labels a firm as named, never as accused or flagged", () => {
    const firm = presentCandidate(
      { ...candidate, kind: "contractor_reference", normalisedValue: "Vijay Constructions" },
      1,
      6,
    );
    expect(firm).toContain("firm named");
    expect(firm.toLowerCase()).not.toMatch(/flag|suspect|risk|irregular|accused/);
  });
});

describe("PROMPT", () => {
  // The safe default when a reviewer is unsure must be to decide nothing.
  it("offers skip first, and binds it to the easiest key", () => {
    expect(PROMPT.indexOf("skip")).toBeLessThan(PROMPT.indexOf("verify"));
    expect(PROMPT).toContain("[enter] skip");
  });

  it("offers every decision the tool can record", () => {
    for (const word of ["verify", "reject", "correct", "quit"]) {
      expect(PROMPT).toContain(word);
    }
  });
});

describe("presentBatch evidence window", () => {
  // The stored value is paise and the page states rupees-and-a-unit, so a
  // window located by searching for the paise string never found the figure
  // and quietly showed the opening of the paragraph instead. On a page of
  // overlapping windows that is a reviewer approving a figure the line in
  // front of them does not contain.
  it("centres the line on the figure, not on the start of the paragraph", () => {
    const lead = "A".repeat(200);
    const line = presentBatch(
      [
        {
          ...candidate,
          rawText: `${lead} the fiscal deficit was ₹ 1,24,208.74 crore in that year.`,
          normalisedValue: "124208740000000",
        },
      ],
      0,
      1,
      "confirmed_in_context",
    );
    expect(line).toContain("1,24,208.74");
  });

  // A Marathi figure has to locate the same way; half the corpus states its
  // unit in Devanagari, and a window that cannot find those figures would show
  // unreadable evidence for exactly the half already hardest to read.
  it("locates a figure whose unit the sentence states in Devanagari", () => {
    const line = presentBatch(
      [
        {
          ...candidate,
          rawText: `${"क".repeat(200)} महसुली तूट ₹ 29,994.76 कोटी होती.`,
          normalisedValue: "29994760000000",
        },
      ],
      0,
      1,
      "confirmed_in_context",
    );
    expect(line).toContain("29,994.76");
  });

  it("names the partition it is showing, and never overstates it", () => {
    const page = [candidate];
    expect(presentBatch(page, 0, 1, "confirmed")).toContain("by no other reading of it");
    expect(presentBatch(page, 0, 1, "confirmed_in_context")).toContain(
      "recorded as facts of their own",
    );
    expect(presentBatch(page, 0, 1, "confirmed_in_context")).not.toContain("no other reading");
  });
});
