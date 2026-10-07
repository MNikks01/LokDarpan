import { describe, expect, it } from "vitest";

import { bodiesIn, departmentName, firstMentionOfEach } from "../src/cag/bodies";
import { extractFacts } from "../src/cag/facts";

const names = (sentence: string): (string | null)[] =>
  bodiesIn(sentence, 1).map((c) => c.normalisedValue);

describe("departmentName", () => {
  it("keeps a whole name, joiners included", () => {
    expect(departmentName("Water Supply and Sanitation ")).toBe(
      "Water Supply and Sanitation Department",
    );
    expect(departmentName("Women & Child Development ")).toBe(
      "Women & Child Development Department",
    );
  });

  it("drops the words that open a sentence or qualify a department generically", () => {
    expect(departmentName("In the Public Works ")).toBe("Public Works Department");
    expect(departmentName("The Finance ")).toBe("Finance Department");
  });

  it('keeps "General" that opens a name and restarts after one that ends a title', () => {
    expect(departmentName("General Administration ")).toBe("General Administration Department");
    expect(departmentName("Director General ")).toBeNull();
    // The secretary of the General Administration Department, not of an
    // "Administration Department".
    expect(departmentName("Secretary General Administration ")).toBe(
      "General Administration Department",
    );
  });

  it("names nothing when only joiners remain, and trims them from either end", () => {
    expect(departmentName("and & ")).toBeNull();
    expect(departmentName("and Housing and ")).toBe("Housing Department");
  });

  it("names nothing when only generic words remain", () => {
    expect(departmentName("The ")).toBeNull();
    expect(departmentName("Government ")).toBeNull();
    expect(departmentName("Administrative ")).toBeNull();
    expect(departmentName("The concerned State ")).toBeNull();
  });
});

describe("bodiesIn", () => {
  it("reads departments as audit prose names them", () => {
    expect(
      names("The Public Works Department did not obtain approval from the Finance Department."),
    ).toEqual(["Public Works Department", "Finance Department"]);
  });

  it("keeps a multi-word name whole rather than its last words", () => {
    expect(names("Funds released by the Rural Development Department were unspent.")).toEqual([
      "Rural Development Department",
    ]);
  });

  it("refuses a department the sentence does not name", () => {
    expect(names("The Department stated that the work was in progress.")).toEqual([]);
    expect(names("The Administrative Department replied in March 2025.")).toEqual([]);
  });

  it("reads a government by name", () => {
    expect(names("The Government of Maharashtra accepted the recommendation.")).toEqual([
      "Government of Maharashtra",
    ]);
  });

  it("produces candidates a reviewer can judge: the sentence, a confidence, no figure", () => {
    const [c] = bodiesIn("The Public Works Department did not reply.", 7);
    expect(c).toMatchObject({
      kind: "body_reference",
      pageNumber: 7,
      normalisedValue: "Public Works Department",
      perUnit: null,
      validation: { state: "needs_review" },
    });
    expect(c?.rawText).toContain("Public Works Department");
    expect(c?.extractionConfidence).toBeGreaterThan(0);
    expect(c?.extractionConfidence).toBeLessThan(1);
  });
});

describe("one candidate per name per document", () => {
  it("keeps the first page that names a body and drops its repetitions", () => {
    const kept = firstMentionOfEach([
      ...bodiesIn("The Finance Department released funds.", 3),
      ...bodiesIn("The Finance Department did not reply.", 9),
      ...bodiesIn("The Housing Department issued orders.", 9),
    ]);
    expect(kept.map((c) => [c.normalisedValue, c.pageNumber])).toEqual([
      ["Finance Department", 3],
      ["Housing Department", 9],
    ]);
  });

  it("applies across a whole document through extractFacts, and leaves figures alone", () => {
    const facts = extractFacts([
      { pageNumber: 2, content: "The Finance Department released ₹ 12.50 crore in 2024-25." },
      { pageNumber: 5, content: "The Finance Department released ₹ 3.00 crore in 2025-26." },
    ]);
    const bodies = facts.filter((f) => f.kind === "body_reference");
    const money = facts.filter((f) => f.kind === "monetary_amount");
    expect(bodies.map((f) => f.pageNumber)).toEqual([2]);
    expect(money).toHaveLength(2);
  });
});
