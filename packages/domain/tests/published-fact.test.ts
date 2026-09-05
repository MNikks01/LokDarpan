import { describe, expect, it } from "vitest";

import {
  byPage,
  displayTitle,
  isReviewComplete,
  type DocumentFactsView,
  type PublishedFact,
} from "../src/published-fact";

const fact = (
  id: number,
  pageNumber: number,
  over: Partial<PublishedFact> = {},
): PublishedFact => ({
  id,
  kind: "monetary_amount",
  pageNumber,
  perUnit: null,
  evidence: "a contract value of 15.14 crore",
  value: "151400000.00",
  origin: "as_extracted",
  verifiedBy: "j.doe@example.org",
  verifiedAt: "2026-08-27T00:00:00.000Z",
  ...over,
});

const view = (over: Partial<DocumentFactsView> = {}): DocumentFactsView => ({
  documentId: 1,
  title: "Nagpur Report No. 2 of 2026",
  pageCount: 337,
  pagesWithoutText: 0,
  facts: [],
  awaitingReview: 0,
  provenance: {
    sourceId: "cag",
    sourceUrl: "https://cag.gov.in/x.pdf",
    retrievedAt: "2026-08-26T00:00:00.000Z",
    issuingAuthority: "Comptroller and Auditor General of India",
    publishedOn: null,
  },
  datasetVersion: 1,
  ...over,
});

describe("byPage", () => {
  // A reader checking a claim opens the PDF at one page. Presenting facts in
  // that same unit is what makes checking practical rather than nominal.
  it("groups facts by the page they were read from", () => {
    const grouped = byPage([fact(1, 12), fact(2, 40), fact(3, 12)]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ pageNumber: 12 });
    expect(grouped[0]?.facts.map((f) => f.id)).toEqual([1, 3]);
  });

  it("orders pages as the document does, not as the facts arrived", () => {
    expect(byPage([fact(1, 293), fact(2, 12), fact(3, 40)]).map((p) => p.pageNumber)).toEqual([
      12, 40, 293,
    ]);
  });

  // Two facts drawn from one sentence — an amount and the firm it was paid to —
  // must stay together, where their relationship is visible.
  it("keeps facts from one sentence side by side", () => {
    const grouped = byPage([
      fact(1, 293),
      fact(2, 293, { kind: "contractor_reference", value: "Joy Developers" }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.facts).toHaveLength(2);
  });

  it("has nothing to group when nothing is published", () => {
    expect(byPage([])).toEqual([]);
  });
});

describe("isReviewComplete", () => {
  // Four facts against 600 undecided candidates must not read as "this is what
  // the report says". The page needs this to say so plainly.
  it("is false while any candidate is still undecided", () => {
    expect(isReviewComplete(view({ awaitingReview: 596, facts: [fact(1, 12)] }))).toBe(false);
  });

  it("is true only when every candidate has been decided", () => {
    expect(isReviewComplete(view({ awaitingReview: 0, facts: [fact(1, 12)] }))).toBe(true);
  });

  // A document nobody has reviewed is not a document with nothing in it.
  it("does not call an unreviewed document complete", () => {
    expect(isReviewComplete(view({ awaitingReview: 1825, facts: [] }))).toBe(false);
  });
});

describe("displayTitle", () => {
  // A citation that looks machine-generated is read as less trustworthy at
  // exactly the moment a reader is deciding whether to trust it.
  it("removes the upload artefacts cag.gov.in puts in a filename", () => {
    expect(
      displayTitle(
        "Nagpur Report No. 2 of 2026 Marathi & English hyperlinked 06a50a7f0926c61.17881064",
      ),
    ).toBe("Nagpur Report No. 2 of 2026");
    expect(
      displayTitle(
        "Mumbai CAR 2023 24 Report No 3 of 2026 Marathi & English hyperlinked 06a50b1cd2fb039.62156072",
      ),
    ).toBe("Mumbai CAR 2023 24 Report No 3 of 2026");
  });

  // Nothing is invented. A title that does not match a known artefact shape is
  // published exactly as it was derived.
  it("leaves an ordinary title untouched", () => {
    expect(displayTitle("Report No. 4 of 2026")).toBe("Report No. 4 of 2026");
    expect(displayTitle("State Finances Audit Report 2024-25")).toBe(
      "State Finances Audit Report 2024-25",
    );
  });

  it("does not strip a year or a report number that looks like a hash", () => {
    expect(displayTitle("Report No. 2 of 2026")).toContain("2026");
    expect(displayTitle("Audit Report 202425")).toBe("Audit Report 202425");
  });

  // A document with no name is unciteable.
  it("never returns an empty title", () => {
    expect(displayTitle("Marathi & English hyperlinked")).not.toBe("");
    expect(displayTitle("   ")).toBe("");
  });
});
