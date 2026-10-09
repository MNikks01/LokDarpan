import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PlaceMentionsInReport } from "@lokdarpan/domain";

import { PlaceMentions } from "./PlaceMentions";

const report: PlaceMentionsInReport = {
  documentId: 7,
  title: "Nagpur Report No. 4 of 2026",
  issuingAuthority: "Comptroller and Auditor General of India",
  sourceId: "cag",
  sourceUrl: "https://cag.gov.in/r.pdf",
  retrievedAt: "2026-10-06T00:00:00+00:00",
  pages: [
    { pageNumber: 41, excerpt: "… works in Gadchiroli district were delayed …" },
    { pageNumber: 212, excerpt: "… Gadchiroli 3,214 …" },
  ],
};

const render = (reports: readonly PlaceMentionsInReport[] | null): string =>
  renderToStaticMarkup(<PlaceMentions reports={reports} place="Gadchiroli" />);

describe("PlaceMentions", () => {
  it("lists each report with its pages, each linked to that page of the original", () => {
    const html = render([report]);
    expect(html).toContain("Where published audit reports name Gadchiroli");
    expect(html).toContain('href="/documents/7"');
    expect(html).toContain('href="https://cag.gov.in/r.pdf#page=41"');
    expect(html).toContain("Named on 2 pages");
    expect(html).toContain("not a statement that a page&#x27;s figures were spent there");
  });

  it("says none is reviewed yet, not that no report concerns the place", () => {
    expect(render([])).toContain("not that no report concerns it");
  });

  it("says a failed load is a fault here", () => {
    expect(render(null)).toContain("This is a fault here");
  });
});
