import { describe, expect, it } from "vitest";

import {
  tenderRecord,
  tenderStatus,
  type FieldState,
  type TenderFieldKey,
  type TenderRecordInput,
} from "../src/tender-record";

const NOW = new Date("2026-10-09T06:00:00Z");

const input = (over: Partial<TenderRecordInput> = {}): TenderRecordInput => ({
  id: 41,
  portalCode: "kerala",
  title: "Resurfacing of the Kollam–Kundara road",
  reference: "PWD/KLM/2026/88",
  department: "Public Works Department",
  organisationChain: "Public Works Department||Roads Division Kollam||Subdivision Kundara",
  location: "Kollam",
  pincode: "691001",
  tenderCategory: "Works",
  productCategory: "Civil Works - Roads",
  tenderType: "Open Tender",
  tenderValueInr: "18250000.00",
  emdInr: "182500.00",
  closingAt: "2026-10-14T10:30:00Z",
  bidOpeningAt: "2026-10-16T11:00:00Z",
  districtName: "Kollam",
  districtSource: "chain_unit",
  districtEvidenceKey: null,
  linkageConfidence: 0.9,
  detailFields: {
    "Work Description": "Resurfacing with BC 30 mm, km 2/400 to 6/900",
    "Tender Fee in ₹": "2,950",
    "Published Date": "30-Sep-2026 05:00 PM",
    "Document Download / Sale Start Date": "30-Sep-2026 05:00 PM",
    "Document Download / Sale End Date": "14-Oct-2026 10:00 AM",
    "Period Of Work(Days)": "120",
  },
  sourceUrl: "https://etenders.kerala.gov.in/nicgep/app?tid=41",
  firstSeenAt: "2026-10-01T01:00:00Z",
  lastSeenAt: "2026-10-09T01:00:00Z",
  changes: 1,
  ...over,
});

const field = (over: Partial<TenderRecordInput>, key: TenderFieldKey): FieldState | undefined =>
  tenderRecord(input(over), NOW)
    .sections.flatMap((s) => s.fields)
    .find((f) => f.key === key)?.value;

describe("tenderRecord", () => {
  it("answers the five questions, in that order", () => {
    expect(tenderRecord(input(), NOW).sections.map((s) => s.key)).toEqual([
      "what",
      "where",
      "who",
      "money",
      "when",
    ]);
  });

  it("reads fields from the page as the page printed them", () => {
    expect(field({}, "workDescription")).toEqual({
      state: "known",
      value: { kind: "text", text: "Resurfacing with BC 30 mm, km 2/400 to 6/900" },
    });
    expect(field({}, "tenderFee")).toEqual({
      state: "known",
      value: { kind: "as_printed", text: "₹2,950" },
    });
    expect(field({}, "documentsAvailable")).toEqual({
      state: "known",
      value: { kind: "as_printed", text: "30-Sep-2026 05:00 PM to 14-Oct-2026 10:00 AM" },
    });
  });

  it("adds the rupee sign to a plain fee, and leaves words like Exempted as printed", () => {
    expect(field({ detailFields: { "Tender Fee in ₹": "Exempted" } }, "tenderFee")).toEqual({
      state: "known",
      value: { kind: "as_printed", text: "Exempted" },
    });
  });

  it("keeps money as decimal rupee strings, never numbers", () => {
    expect(field({}, "estimatedValue")).toEqual({
      state: "known",
      value: { kind: "rupees", inr: "18250000.00" },
    });
  });

  it("gives every missing field its reason, and tells 'not on the page' from 'never read'", () => {
    expect(field({}, "preBidMeeting")).toEqual({ state: "missing", why: "not_on_page" });
    expect(field({ detailFields: null }, "workDescription")).toEqual({
      state: "missing",
      why: "detail_not_read",
    });
    expect(field({ detailFields: null, pincode: null }, "pincode")).toEqual({
      state: "missing",
      why: "detail_not_read",
    });
    expect(field({ pincode: null }, "pincode")).toEqual({ state: "missing", why: "not_on_page" });
  });

  it("says why award and progress fields are empty, rather than leaving a blank", () => {
    expect(field({}, "winner")).toEqual({ state: "missing", why: "award_not_collected" });
    expect(field({}, "contractValue")).toEqual({ state: "missing", why: "award_not_collected" });
    expect(field({}, "workProgress")).toEqual({ state: "missing", why: "progress_not_available" });
    expect(field({}, "workSite")).toEqual({ state: "missing", why: "site_not_stated" });
  });

  it("labels the district as the issuing office's, with how it was found", () => {
    expect(
      field(
        { districtSource: "pincode", districtEvidenceKey: "691001", linkageConfidence: 0.6 },
        "officeDistrict",
      ),
    ).toEqual({
      state: "known",
      value: {
        kind: "office_district",
        name: "Kollam",
        method: "pincode",
        evidence: "691001",
        confidence: 0.6,
      },
    });
    expect(field({ districtName: null }, "officeDistrict")).toEqual({
      state: "missing",
      why: "district_not_established",
    });
  });

  it("splits the issuing office's chain into its offices, outermost first", () => {
    expect(field({}, "issuingOffice")).toEqual({
      state: "known",
      value: {
        kind: "chain",
        offices: ["Public Works Department", "Roads Division Kollam", "Subdivision Kundara"],
      },
    });
    expect(field({ organisationChain: null }, "issuingOffice")).toEqual({
      state: "missing",
      why: "not_on_page",
    });
  });

  it("joins a pre-bid meeting's date and place when the page states them", () => {
    expect(
      field(
        {
          detailFields: {
            "Pre Bid Meeting Date": "05-Oct-2026 11:00 AM",
            "Pre Bid Meeting Place": "Office of the EE, Kollam",
          },
        },
        "preBidMeeting",
      ),
    ).toEqual({
      state: "known",
      value: { kind: "as_printed", text: "05-Oct-2026 11:00 AM, Office of the EE, Kollam" },
    });
  });
});

describe("tenderStatus", () => {
  it("is open before the closing date and closed after it, never awarded", () => {
    expect(tenderStatus("2026-10-14T10:30:00Z", NOW)).toEqual({
      kind: "open",
      closesAt: "2026-10-14T10:30:00Z",
    });
    expect(tenderStatus("2026-10-01T10:30:00Z", NOW)).toEqual({
      kind: "closed",
      closedAt: "2026-10-01T10:30:00Z",
    });
    expect(tenderStatus(null, NOW)).toEqual({ kind: "unknown" });
  });
});
