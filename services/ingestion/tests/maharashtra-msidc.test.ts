import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MSIDC,
  MsidcListingNotUnderstood,
  leadingDateOf,
  msidcFactsOf,
  parseMsidcListing,
} from "../src/maharashtra/msidc";

const listing = readFileSync(join(__dirname, "fixtures", "msidc-tenders-2026-09-30.html"), "utf8");

describe("MSIDC's listing, as served on 2026-09-30", () => {
  const rows = parseMsidcListing(listing);

  it("reads all 290 notices on its single page", () => {
    expect(rows).toHaveLength(290);
    expect(rows[0]).toEqual({
      serial: "1",
      published: "6 July-2026 at 12:00 PM",
      publishedOn: "2026-07-06",
      deadline: "17 July-2026 up to 05:00 PM",
      deadlineOn: "2026-07-17",
      nameOfWork:
        "Appointment of Consultant for undertaking Architectural Consultancy Services for Development of a High Security Prison at Madh Island, Village Daravali, Borivali, Mumbai",
      documents: ["https://msidc.org/wp-content/uploads/2026/07/TenderNotice09.pdf"],
      deadlineBeforePublication: false,
    });
    expect(MSIDC.lastPage).toBe(0);
  });

  it("keeps MSIDC's own date errors as printed, and flags them rather than correcting them", () => {
    const row = rows.find((r) => r.serial === "289");
    if (row === undefined) throw new Error("row 289 missing");
    expect(row).toMatchObject({
      published: "01-Mar-2024 at 10:30 AM",
      publishedOn: "2024-03-01",
      deadline: "08-Mar-2023 upto 2:00 PM",
      deadlineOn: "2023-03-08",
      deadlineBeforePublication: true,
    });
    expect(rows.filter((r) => r.deadlineBeforePublication).map((r) => r.serial)).toEqual([
      "40",
      "289",
      "290",
    ]);
    expect(msidcFactsOf(row)["deadline_before_publication"]).toBe(true);
  });

  it("takes only real links: a malformed nested href is not a document", () => {
    const row = rows.find((r) => r.serial === "140");
    expect(row?.documents).toEqual([
      "https://msidc.org/wp-content/uploads/2024/03/New1.-Authority-engineer.pdf",
    ]);
    for (const r of rows) {
      for (const d of r.documents) {
        expect(d).toMatch(/^https:\/\/msidc\.org\/wp-content\/uploads\//u);
      }
    }
  });

  it("lists a package row's shared notice once per row, as MSIDC does", () => {
    const all = rows.flatMap((r) => r.documents);
    expect(all).toHaveLength(289);
    expect(new Set(all).size).toBe(227);
  });

  it("refuses a table whose columns are not the ones it knows", () => {
    expect(() => parseMsidcListing(listing.replace("Publication Date", "Opening Date"))).toThrow(
      MsidcListingNotUnderstood,
    );
    expect(() => parseMsidcListing("<html><body>Under maintenance</body></html>")).toThrow(
      /no tablepress table/u,
    );
  });
});

describe("MSIDC's dates are read only when the month is named", () => {
  it.each([
    ["6 July-2026 at 12:00 PM", "2026-07-06"],
    ["20-Jun-2024 at 3.00 PM", "2024-06-20"],
    ["15-Mar-2024 at 3.00 PM", "2024-03-15"],
    ["3 Sept 2025 upto 5 PM", "2025-09-03"],
  ])("%s → %s", (printed, iso) => {
    expect(leadingDateOf(printed)).toBe(iso);
  });

  it.each(["08-03-2023", "31-Jun-2024", "6 Junk-2026", "", "July 6 2026"])(
    "%j is left unread",
    (printed) => {
      expect(leadingDateOf(printed)).toBeNull();
    },
  );
});
