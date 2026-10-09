import { describe, expect, it } from "vitest";

import { groupByPlace, placeDecisionNote, type PlaceCandidateRow } from "../src/review/places";

const row = (
  id: number,
  value: string,
  documentId: number,
  pageNumber: number,
): PlaceCandidateRow => ({
  id,
  documentId,
  documentTitle: `Report ${String(documentId)}`,
  pageNumber,
  rawText: `… ${value} on page ${String(pageNumber)} …`,
  value,
});

describe("groupByPlace", () => {
  const groups = groupByPlace([
    row(1, "Nagpur district", 7, 10),
    row(2, "Nagpur district", 7, 30),
    row(3, "Nagpur district", 5, 2),
    row(4, "Mul taluka", 5, 9),
  ]);

  it("puts every page of a place in one group, most-named first", () => {
    expect(groups.map((g) => [g.value, g.pages, g.factIds])).toEqual([
      ["Nagpur district", 3, [1, 2, 3]],
      ["Mul taluka", 1, [4]],
    ]);
  });

  it("shows one sentence from each report, in the order the reports are held", () => {
    expect(groups[0]?.examples.map((e) => [e.documentTitle, e.pageNumber])).toEqual([
      ["Report 5", 2],
      ["Report 7", 10],
    ]);
  });

  it("writes a note that says the decision was made by place, and on what", () => {
    const [nagpur, mul] = groups;
    if (nagpur === undefined || mul === undefined) throw new Error("expected two groups");
    expect(placeDecisionNote(nagpur)).toBe(
      "Decided by place (ADR-077): Nagpur district, 3 pages in 2 reports, after reading one sentence from each report.",
    );
    expect(placeDecisionNote(mul)).toContain("1 page in 1 report");
  });
});
