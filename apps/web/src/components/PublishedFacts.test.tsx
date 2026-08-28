import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DocumentFactsView, PublishedFact } from "@lokdarpan/domain";

import { FactCard, Scope, Value } from "./PublishedFacts";

const fact = (over: Partial<PublishedFact> = {}): PublishedFact => ({
  id: 1,
  kind: "monetary_amount",
  pageNumber: 293,
  evidence: "in favour of M/s Joy Developers … for a contract value of 15.14 crore",
  value: "151400000.00",
  origin: "as_extracted",
  verifiedBy: "j.doe@example.org",
  verifiedAt: "2026-08-27T09:00:00.000Z",
  ...over,
});

const view = (over: Partial<DocumentFactsView> = {}): DocumentFactsView => ({
  documentId: 4,
  title: "Nagpur Report No. 2 of 2026",
  pageCount: 261,
  pagesWithoutText: 40,
  facts: [],
  awaitingReview: 257,
  provenance: {
    sourceId: "cag",
    sourceUrl: "https://cag.gov.in/x.pdf",
    retrievedAt: "2026-08-26T00:00:00.000Z",
    issuingAuthority: "Comptroller and Auditor General of India",
    publishedOn: null,
  },
  datasetVersion: 1684,
  ...over,
});

const text = (markup: string): string =>
  markup
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x27;/gu, "'")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();

describe("Value", () => {
  it("renders an amount in Indian grouping, from a decimal rupee string", () => {
    const shown = text(renderToStaticMarkup(<Value fact={fact()} />));
    expect(shown).toContain("15.14");
    // Never the raw integer that arrived over the wire.
    expect(shown).not.toContain("151400000.00");
  });

  it("renders a firm's name as published, with nothing added", () => {
    const shown = text(
      renderToStaticMarkup(
        <Value fact={fact({ kind: "contractor_reference", value: "Joy Developers" })} />,
      ),
    );
    expect(shown).toBe("Joy Developers");
  });
});

describe("FactCard", () => {
  const shown = text(renderToStaticMarkup(<FactCard fact={fact()} />));

  // A reader who cannot see the words the value was drawn from is being asked
  // to take our word for it, which is the opposite of what this is for.
  it("shows the evidence sentence and the page it came from", () => {
    expect(shown).toContain("Joy Developers");
    expect(shown).toContain("Page 293");
  });

  it("names the person who verified it", () => {
    expect(shown).toContain("verified by j.doe@example.org");
  });

  it("says when a figure is the reviewer's reading, not the extractor's", () => {
    const corrected = text(
      renderToStaticMarkup(<FactCard fact={fact({ origin: "corrected_by_reviewer" })} />),
    );
    expect(corrected).toContain("corrected by the reviewer");
    expect(shown).not.toContain("corrected by the reviewer");
  });

  // `.docs/17-legal/legal-ethical-rules.md`: a contractor screen carries no
  // score, rank, badge or flag, and red is reserved for destructive actions.
  it("attaches no score, rank or flag to a named firm", () => {
    const firm = renderToStaticMarkup(
      <FactCard fact={fact({ kind: "contractor_reference", value: "Joy Developers" })} />,
    );
    expect(text(firm).toLowerCase()).not.toMatch(/score|rank|flag|risk|suspect|irregular/);
    expect(firm.toLowerCase()).not.toMatch(/#(d|e|f)(0|1|2)(0|1|2)|red|crimson/);
  });
});

describe("Scope", () => {
  // Four facts against 257 undecided candidates must not read as "this is what
  // the report says".
  it("states how many candidates are still unreviewed", () => {
    const shown = text(renderToStaticMarkup(<Scope view={view({ facts: [fact()] })} />));
    expect(shown).toContain("257 further extracted candidates are awaiting review");
    expect(shown).toContain("1 fact that a person has checked");
  });

  it("says an empty page means unconfirmed, never that the document is silent", () => {
    const shown = text(renderToStaticMarkup(<Scope view={view()} />));
    expect(shown).toContain("No fact from this document has been verified yet");
    expect(shown).toContain("absence here does not mean the document is silent");
  });

  // A reader comparing this to the PDF must be able to tell "not in the report"
  // from "in a part the extractor could not read".
  it("discloses pages whose text could not be read", () => {
    const shown = text(renderToStaticMarkup(<Scope view={view()} />));
    expect(shown).toContain("40 of 261 pages carried no readable text");
  });

  it("says so plainly when every candidate has been decided", () => {
    const shown = text(
      renderToStaticMarkup(<Scope view={view({ awaitingReview: 0, facts: [fact()] })} />),
    );
    expect(shown).toContain("Every candidate extracted from this document has been reviewed");
    expect(shown).not.toContain("awaiting review");
  });

  it("never claims to summarise the document", () => {
    const shown = text(renderToStaticMarkup(<Scope view={view({ facts: [fact()] })} />));
    expect(shown).toContain("This is not a summary of the document");
  });
});
