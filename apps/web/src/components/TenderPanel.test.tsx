import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { tenderRecord, type TenderRecordInput } from "@lokdarpan/domain";

import { rupeesText, untilText } from "@/copy/tender";

import { TenderPanel, TenderWithheld } from "./TenderPanel";

const NOW = new Date("2026-10-09T06:00:00Z");

const input: TenderRecordInput = {
  id: 2595,
  portalCode: "kerala",
  title: "Retarring works to Kaippallikund road",
  reference: "AE-LID-EW-KTKL-02/26-27",
  department: "Local Self Government Department",
  organisationChain: "Local Self Government Department||Malappuram||Municipal Engineer Kottakkal",
  location: "kottakkal",
  pincode: "676303",
  tenderCategory: "Works",
  productCategory: "Civil Works - Others",
  tenderType: "Open Tender",
  tenderValueInr: "506291.00",
  emdInr: null,
  closingAt: "2026-10-14T13:25:00Z",
  bidOpeningAt: null,
  districtName: "Malappuram",
  districtSource: "chain_unit",
  districtEvidenceKey: null,
  linkageConfidence: 0.9,
  detailFields: null,
  sourceUrl: "https://etenders.kerala.gov.in/nicgep/app",
  firstSeenAt: "2026-10-01T01:00:00Z",
  lastSeenAt: "2026-10-09T01:00:00Z",
  changes: 0,
};

const text = (html: string): string =>
  html
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x27;/gu, "'")
    .replace(/\s+/gu, " ");

describe("TenderPanel", () => {
  const page = text(
    renderToStaticMarkup(<TenderPanel record={tenderRecord(input, NOW)} now={NOW} />),
  );

  it("leads with the title, where it stands, and the facts most people want", () => {
    expect(page).toContain("Retarring works to Kaippallikund road");
    expect(page).toContain("Open · bids close 14 October 2026, 6:55 pm, in 5 days");
    expect(page).toContain("Estimated cost ₹5.06 lakh (₹5,06,291)");
  });

  it("says the district is the issuing office's, and how it was found", () => {
    expect(page).toContain("Malappuram (named in the issuing office's own chain)");
    expect(page).toContain("The work may be elsewhere.");
  });

  it("gathers what is missing into one line per reason, never empty rows", () => {
    expect(page).toContain(
      "Not available: Who bid, Who won. The portals show who bid and who won only behind a CAPTCHA",
    );
    expect(page.match(/Not available: Who bid/gu)).toHaveLength(1);
  });

  it("ends with the original tender and how long LokDarpan has watched it", () => {
    expect(page).toContain("Open the original tender on the portal");
    expect(page).toContain("first saw this tender on 1 October 2026");
    expect(page).toContain("No change has been recorded");
  });

  it("never calls a closed tender awarded", () => {
    const closed = text(
      renderToStaticMarkup(
        <TenderPanel
          record={tenderRecord({ ...input, closingAt: "2026-10-06T13:25:00Z" }, NOW)}
          now={NOW}
        />,
      ),
    );
    expect(closed).toContain("Bids closed on 6 October 2026. Whether it was awarded is not known.");
  });
});

describe("TenderWithheld", () => {
  it("says the tender is held, why its details are not shown, and where to read it", () => {
    const html = text(
      renderToStaticMarkup(<TenderWithheld portalUrl="https://etenders.kerala.gov.in" />),
    );
    expect(html).toContain("LokDarpan holds this tender");
    expect(html).toContain("Read this tender on the state's portal");
    expect(text(renderToStaticMarkup(<TenderWithheld portalUrl={null} />))).not.toContain(
      "Read this tender",
    );
  });
});

describe("words for amounts and deadlines", () => {
  it("gives the short amount with the exact one beside it", () => {
    expect(rupeesText("18250000.00")).toBe("₹1.82 crore (₹1,82,50,000)");
    expect(rupeesText("950.00")).toBe("₹950");
  });

  it("says how far off a deadline is in words", () => {
    expect(untilText("2026-10-09T15:00:00Z", NOW)).toBe("today");
    expect(untilText("2026-10-10T08:00:00Z", NOW)).toBe("tomorrow");
  });
});
