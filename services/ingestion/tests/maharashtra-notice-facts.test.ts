import { describe, expect, it } from "vitest";

import type { FactCandidate } from "../src/cag/facts";
import {
  asciiDigits,
  gepnicDateTime,
  noticeFacts,
  printedRupeesToPaise,
  type PageReadingInput,
} from "../src/maharashtra/notice-facts";

/**
 * Page text below is copied from MSIDC notices collected on 2026-10-01, line
 * breaks included: the text layer wraps labels mid-phrase, and the parser has
 * to read them as printed.
 */

// A GePNIC "Tender Details" printout, attached to MSIDC's listing row as its notice.
const GEPNIC_PAGE_1 = `eProcurement System Government of Maharashtra
Tender Details
Basic Details
Organisation Chain Maharashtra State Infrastructure Development Corporation
Tender Reference
Number MSIDC/HAM-II/SAT/TREES/02/2026
Tender ID 2026_MSIDC_1285274_1 Withdrawal Allowed Yes
Tender Fee Details, [Total Fee in ₹ * - 12,300]
Tender Fee in ₹ 11,800
Processing Fee in ₹ 500
EMD Fee Details
EMD Amount in ₹ 1,50,791 EMD Exemption
Allowed
Tender Value in ₹ 1,50,79,073 Product Category Civil Works -
Pre Bid Meeting Date 12-Mar-2026
03:30 PM
Critical Dates
Publish Date 10-Mar-2026 09:00 AM Bid Opening Date 17-Mar-2026 05:00 PM
Document Download / Sale Start
Date
10-Mar-2026 09:00 AM Document Download / Sale End Date 16-Mar-2026 05:00 PM
eProcurement System Government of Maharashtra`;

const GEPNIC_PAGE_2 = `Clarification Start Date NA Clarification End Date NA
Bid Submission Start Date 05-Jan-2026 05:55 PM Bid Submission End Date 30-Jan-2026 05:00 PM
Financial Bid Opening Date 17-Feb-2026 04:45 PM
eProcurement System Government of Maharashtra`;

// MSIDC's own letter: E-Tender Notice No. 09 (2026-2027).
const LETTER_PAGE_1 = `E-Tender Notice No. 09 (2026-2027)
Tender Document
Fees
INR 23,600/- (20,000/- + GST) [ to be paid online only]**
EMD
Earnest Money Deposit: INR 6,00,000/- (In words: Rupees Six Lakhs
only); to be submitted online
- Annual Turnover of last financial year should not be less than INR 5.00
Crores.`;

const LETTER_PAGE_2 = `TIMELINES
1. Date of Issue Tender Notice: 06/07/2026 at 12.00 Hrs.
2. Start Date for submission of Bids: 08/07/2026 ; Time - 15.00 Hrs.
3. Last Date for submitting the Bids: 17/07/2026 ; Time - 17.00 Hrs.
4. Date of Opening of technical bids: 20/07/2026 at 17.30 Hrs (if possible)
No. MSIDC/Mumbai/Limited/Tender/ 09 /2026
MSIDC, Mumbai.
Date: 06/07/2026`;

// An empanelment notice: its fee is stated before tax.
const EMPANELMENT = `Tender Ref. No. MSIDC/EOI/PMC/ 06 /2024-25 Date: 23/12/2024
2. Earnest Money Deposit (EMD) for Empanelment: Rs. 20,000/- to be submitted online only
3. Tender Document Fee: Rs. 5,000/- + GST (i.e. Rs. 5,900/-) to be submitted online only
4. Date of Issue of Empanelment Notice : 23/12/2024
5. Last date of submitting the Empanelment Application (Online): 31/12/2024 up to 3.00 P.M.`;

function byField(facts: readonly FactCandidate[]): Record<string, string | null> {
  return Object.fromEntries(facts.map((f) => [f.field ?? "", f.normalisedValue]));
}

describe("printedRupeesToPaise", () => {
  it("reads Indian and Western grouping into paise", () => {
    expect(printedRupeesToPaise("1,50,79,073")).toBe("1507907300");
    expect(printedRupeesToPaise("1,507,907")).toBe("150790700");
    expect(printedRupeesToPaise("500")).toBe("50000");
    expect(printedRupeesToPaise("23,600.5")).toBe("2360050");
  });

  it("leaves a figure whose commas fall nowhere a grouping puts them unread", () => {
    expect(printedRupeesToPaise("1,50,7,9073")).toBeNull();
    expect(printedRupeesToPaise("12,30")).toBeNull();
    expect(printedRupeesToPaise("NA")).toBeNull();
  });

  it("keeps a sum past Number.MAX_SAFE_INTEGER exact", () => {
    expect(printedRupeesToPaise("9,99,99,99,99,99,999")).toBe("9999999999999900");
  });
});

describe("gepnicDateTime", () => {
  it("reads the portal's twelve-hour clock into IST", () => {
    expect(gepnicDateTime("16-Mar-2026 05:00 PM")).toBe("2026-03-16T17:00+05:30");
    expect(gepnicDateTime("10-Mar-2026 12:15 AM")).toBe("2026-03-10T00:15+05:30");
    expect(gepnicDateTime("10-Mar-2026 12:15 PM")).toBe("2026-03-10T12:15+05:30");
  });

  it("refuses a date or time that does not exist", () => {
    expect(gepnicDateTime("31-Feb-2026 05:00 PM")).toBeNull();
    expect(gepnicDateTime("10-Mar-2026 13:00 PM")).toBeNull();
    expect(gepnicDateTime("10-Foo-2026 05:00 PM")).toBeNull();
  });
});

describe("noticeFacts: the GePNIC printout", () => {
  const facts = noticeFacts([
    { pageNumber: 1, content: GEPNIC_PAGE_1 },
    { pageNumber: 2, content: GEPNIC_PAGE_2 },
  ]);
  const fields = byField(facts);

  it("reads the MahaTenders tender ID and the department's reference", () => {
    expect(fields["gepnic_tender_id"]).toBe("2026_MSIDC_1285274_1");
    expect(fields["tender_reference_number"]).toBe("MSIDC/HAM-II/SAT/TREES/02/2026");
  });

  it("reads each amount into the field it fills, in paise", () => {
    expect(fields).toMatchObject({
      tender_value: "1507907300",
      emd: "15079100",
      tender_fee: "1180000",
      processing_fee: "50000",
      total_fee: "1230000",
    });
  });

  it("reads dates whose labels and times the text layer wrapped", () => {
    expect(fields["pre_bid_meeting"]).toBe("2026-03-12T15:30+05:30");
    expect(fields["document_download_start"]).toBe("2026-03-10T09:00+05:30");
    expect(fields["document_download_end"]).toBe("2026-03-16T17:00+05:30");
  });

  it("keeps the financial bid opening apart from the bid opening", () => {
    const openings = facts.filter((f) => f.field?.endsWith("bid_opening") === true);
    expect(openings.map((f) => [f.pageNumber, f.field, f.normalisedValue])).toEqual([
      [1, "bid_opening", "2026-03-17T17:00+05:30"],
      [2, "financial_bid_opening", "2026-02-17T16:45+05:30"],
    ]);
  });

  it("cites the page each fact was read from", () => {
    const submission = facts.find((f) => f.field === "bid_submission_end");
    expect(submission).toMatchObject({
      pageNumber: 2,
      kind: "tender_date",
      rawText: "Bid Submission End Date 30-Jan-2026 05:00 PM",
    });
  });

  it("reads nothing where the portal printed NA", () => {
    expect(facts.some((f) => f.field?.startsWith("clarification") === true)).toBe(false);
  });

  it("marks every reading as a candidate a person must still verify", () => {
    expect(facts.every((f) => f.validation.state === "accepted")).toBe(true);
    expect(facts.every((f) => f.extractionConfidence < 1)).toBe(true);
  });
});

describe("noticeFacts: MSIDC's own letter", () => {
  const facts = noticeFacts([
    { pageNumber: 1, content: LETTER_PAGE_1 },
    { pageNumber: 2, content: LETTER_PAGE_2 },
  ]);
  const fields = byField(facts);

  it("reads the notice number and the issuer's reference", () => {
    expect(fields["notice_number"]).toBe("09 (2026-2027)");
    expect(fields.issuer_reference).toBe("MSIDC/Mumbai/Limited/Tender/09/2026");
  });

  it("reads the EMD and the fee payable, and no figure that is not one", () => {
    const amounts = facts.filter((f) => f.kind === "monetary_amount");
    expect(amounts.map((f) => [f.field, f.normalisedValue])).toEqual([
      ["emd", "60000000"],
      ["tender_fee", "2360000"],
    ]);
  });

  it("reads dates day-first, and marks for review those that also read month-first", () => {
    const opening = facts.find((f) => f.field === "bid_opening");
    expect(opening?.normalisedValue).toBe("2026-07-20T17:30+05:30");
    expect(opening?.validation.state).toBe("accepted");

    const issued = facts.find((f) => f.field === "publish");
    expect(issued?.normalisedValue).toBe("2026-07-06T12:00+05:30");
    expect(issued?.validation.state).toBe("needs_review");
    expect(issued?.extractionConfidence).toBeLessThan(opening?.extractionConfidence ?? 0);
  });

  it("does not read the letter's own date as one the tender sets", () => {
    expect(facts.filter((f) => f.kind === "tender_date")).toHaveLength(4);
  });
});

describe("noticeFacts: an empanelment notice", () => {
  const fields = byField(noticeFacts([{ pageNumber: 1, content: EMPANELMENT }]));

  it("records a fee stated before tax as that, not as the fee", () => {
    expect(fields["tender_fee_before_gst"]).toBe("500000");
    expect(fields["tender_fee"]).toBeUndefined();
  });

  it("reads the EMD, the reference and a date with no time", () => {
    expect(fields).toMatchObject({
      emd: "2000000",
      issuer_reference: "MSIDC/EOI/PMC/06/2024-25",
      bid_submission_end: "2024-12-31",
    });
  });
});

describe("noticeFacts: pages with nothing to read", () => {
  it("yields nothing for a scanned page or a page of prose", () => {
    expect(
      noticeFacts([
        { pageNumber: 1, content: null },
        { pageNumber: 2, content: "Digitally signed by an officer\nDate: 2024.09.28 17:48:59 IST" },
      ]),
    ).toEqual([]);
  });
});

/**
 * Lines below are copied from Tesseract 5.5.3's readings of MHADA notices
 * (scans, collected 2026-09-30, read 2026-10-06), OCR damage included.
 */
const MHADA_SCHEDULE = `ई-निविदा सुचना क्र.:- का. अ. (पूर्व) / मु.झो.सु.मंडळ/ ई-निविदा/ ३९ /२०२६-२७
जाहिरात दिनांक २९.०९.२०२६, सकाळी १०.०० वा.
निविदा स्विकृती अंतिम दिनांक ०६.१०.२०२६, सायंकाळी ६.१५ वाजता
तांत्रिक बोली उघडण्याचा दिनांक ०८.१०.२०२६, सकाळी १०.३० नंतर`;

describe("noticeFacts: MHADA's Marathi schedule", () => {
  const fields = Object.fromEntries(
    noticeFacts([{ pageNumber: 1, content: MHADA_SCHEDULE }]).map((f) => [
      f.field,
      f.normalisedValue,
    ]),
  );

  it("reads each dated line in Devanagari digits, with the time the part of day gives", () => {
    expect(fields).toMatchObject({
      publish: "2026-09-29T10:00+05:30",
      bid_submission_end: "2026-10-06T18:15+05:30",
      bid_opening: "2026-10-08T10:30+05:30",
    });
  });

  it("keeps the reference as printed, Devanagari and all", () => {
    expect(fields.issuer_reference).toBe("का. अ. (पूर्व) / मु.झो.सु.मंडळ/ ई-निविदा/ ३९ /२०२६-२७");
  });

  it("leaves a date OCR damaged unread, rather than repairing it", () => {
    // Both are from real readings: a doubled digit, and a dot read as a comma.
    const damaged = noticeFacts([
      {
        pageNumber: 1,
        content: "तांत्रिक बोली उघडण्याचा दिनांक ०८.१९०.२०२६\nनिविदापूर्व बैठक दिनांक २५,०५,२०२६",
      },
    ]);
    expect(damaged).toEqual([]);
  });

  it("reads no time a part of day cannot name", () => {
    const [fact] = noticeFacts([
      { pageNumber: 1, content: "निविदा स्विकृती अंतिम दिनांक ०६.१०.२०२६, दुपारी ९.१५" },
    ]);
    expect(fact?.normalisedValue).toBe("2026-10-06");
  });

  it("turns Devanagari digits into ASCII for a value only", () => {
    expect(asciiDigits("२९.०९.२०२६")).toBe("29.09.2026");
  });
});

describe("noticeFacts: a scan, read from an OCR reading", () => {
  const content = "जाहिरात दिनांक २९.०९.२०२६";
  const labelEnd = content.indexOf("२९");
  const reading: PageReadingInput = {
    id: 41,
    engine: "tesseract",
    engineVersion: "5.5.3",
    words: [
      // The label, read badly: an engine's doubt about it says nothing about the date.
      { charStart: 0, charEnd: labelEnd - 1, x0: 10, y0: 700, x1: 80, y1: 712, confidence: 0.05 },
      {
        charStart: labelEnd,
        charEnd: content.length,
        x0: 90,
        y0: 700,
        x1: 150,
        y1: 712,
        confidence: 0.8,
      },
    ],
  };
  const [fact] = noticeFacts([{ pageNumber: 2, content, reading }]);

  it("is offered for review, and names the reading and the engine", () => {
    expect(fact).toMatchObject({
      field: "publish",
      normalisedValue: "2026-09-29",
      pageReadingId: 41,
      extractionMethod: "labelled fields over OCR reading (tesseract 5.5.3)",
      validation: { state: "needs_review" },
    });
    expect(fact?.validation.reason).toContain("tesseract 5.5.3");
  });

  it("is only as confident as the engine was of the figures, not of the label", () => {
    expect(fact?.extractionConfidence).toBeCloseTo(0.85 * 0.8, 3);
  });

  it("carries the box of the figures it was read from", () => {
    expect(fact?.box).toEqual({ x0: 90, y0: 700, x1: 150, y1: 712 });
  });

  it("is marked for review even where the same line on a text layer would not be", () => {
    const [typed] = noticeFacts([{ pageNumber: 2, content }]);
    expect(typed?.validation.state).toBe("accepted");
    expect(typed?.pageReadingId).toBeUndefined();
  });
});

describe("noticeFacts: the part of the day a Marathi notice names", () => {
  const at = (when: string): string | null =>
    noticeFacts([{ pageNumber: 1, content: `निविदा स्विकृती अंतिम दिनांक ०६.१०.२०२६, ${when}` }])[0]
      ?.normalisedValue ?? null;

  it.each([
    ["सकाळी १०.३०", "2026-10-06T10:30+05:30"],
    ["सकाळी १२.१५", "2026-10-06T00:15+05:30"],
    ["दुपारी १२.००", "2026-10-06T12:00+05:30"],
    ["दुपारी ३.००", "2026-10-06T15:00+05:30"],
    ["सायंकाळी ६.१५", "2026-10-06T18:15+05:30"],
    ["संध्याकाळी ५.३०", "2026-10-06T17:30+05:30"],
    ["रात्री ८.००", "2026-10-06T20:00+05:30"],
  ])("reads %s as the hour it names", (when, expected) => {
    expect(at(when)).toBe(expected);
  });

  it.each([
    "दुपारी ९.००",
    "सायंकाळी १२.००",
    "रात्री २.००",
    "सकाळी १३.००",
    "सकाळी ०.३०",
    "सकाळी १०.७५",
  ])("reads the date alone where %s is no time on a clock", (when) => {
    expect(at(when)).toBe("2026-10-06");
  });

  it("reads no value from a date no calendar has, and still offers the line", () => {
    const [fact] = noticeFacts([{ pageNumber: 1, content: "जाहिरात दिनांक ३१.०२.२०२६" }]);
    expect(fact).toMatchObject({ field: "publish", normalisedValue: null });
  });
});

describe("noticeFacts: a reading whose words do not cover the match", () => {
  it("offers the fact with no box rather than an invented one", () => {
    const [fact] = noticeFacts([
      {
        pageNumber: 1,
        content: "जाहिरात दिनांक २९.०९.२०२६",
        reading: { id: 7, engine: "tesseract", engineVersion: "5.5.3", words: [] },
      },
    ]);
    expect(fact?.box).toBeUndefined();
    expect(fact?.pageReadingId).toBe(7);
  });
});

describe("noticeFacts: where a reference ends", () => {
  const reference = (line: string): string | null =>
    noticeFacts([{ pageNumber: 1, content: line }]).find((f) => f.field === "issuer_reference")
      ?.normalisedValue ?? null;

  it("ends at its year, though OCR joined the signature beside it onto the line", () => {
    // From Tesseract's reading of an MSIDC scan: the reference and the officer's
    // name sit in two columns, and the reading put them on one line.
    expect(reference("No. MSIDC/Mumbai/Tender/g4 /2024 (R.R.Hande)")).toBe(
      "MSIDC/Mumbai/Tender/g4/2024",
    );
    expect(reference("No. MSIDC/Mumbai/Tender/ 344 /2024 Sd/-")).toBe(
      "MSIDC/Mumbai/Tender/344/2024",
    );
  });

  it("keeps a re-tender's call, which two calls of one tender differ by", () => {
    expect(reference("No. MSIDC/Mumbai/Tender/05/2024 (2nd Call)")).toBe(
      "MSIDC/Mumbai/Tender/05/2024(2ndCall)",
    );
  });

  it("keeps a financial year written as a range", () => {
    expect(reference("Tender Ref. No: MSIDC/EOI/PMC/06/2024-25")).toBe("MSIDC/EOI/PMC/06/2024-25");
  });
});
