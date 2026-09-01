import { describe, it, expect } from "vitest";

import { parseIstDateTime, parseLanding, tenderIdFrom } from "../src/gepnic/landing";

/**
 * Fixtures shaped like the real page, because the real page is what broke the
 * first design. Every structure asserted here was observed on
 * `tntenders.gov.in` on 2026-08-29 and is recorded in migration 0012.
 */
interface RowSpec {
  readonly title: string;
  readonly reference: string;
  readonly closing: string;
  readonly opening: string;
  /** `null` renders the title as plain text, with no identity to read. */
  readonly sp: string | null;
}

function row({ title, reference, closing, opening, sp }: RowSpec): string {
  const cell =
    sp === null
      ? title
      : `<a href="/nicgep/app?component=%24DirectLink&amp;page=Home&amp;service=direct&amp;session=T&amp;sp=${sp}">${title}</a>`;
  return `<tr><td>${cell}</td><td>${reference}</td><td>${closing}</td><td>${opening}</td></tr>`;
}

const CLOSES = "15-Sep-2026 03:00 PM";
const OPENS = "15-Sep-2026 03:30 PM";

const HEADER =
  "<tr><td>Tender Title</td><td>Reference No</td><td>Closing Date</td><td>Bid Opening Date</td></tr>";

describe("identity — the finding that reshaped the schema", () => {
  it("keeps tenders that share one reference number apart", () => {
    // Observed: reference 1657/2026/E1 carried six distinct tenders and
    // E5/6052/2025 carried four. Keying on the reference collapses twenty rows
    // into fifteen and under-reports what a government advertised.
    const html =
      HEADER +
      row({
        title: "1. General Fund",
        reference: "1657/2026/E1",
        closing: CLOSES,
        opening: OPENS,
        sp: "aaa",
      }) +
      row({
        title: "2. General Fund",
        reference: "1657/2026/E1",
        closing: CLOSES,
        opening: OPENS,
        sp: "bbb",
      }) +
      row({
        title: "3. General Fund",
        reference: "1657/2026/E1",
        closing: CLOSES,
        opening: OPENS,
        sp: "ccc",
      });

    const { tenders } = parseLanding(html);
    expect(tenders).toHaveLength(3);
    expect(new Set(tenders.map((t) => t.portalTenderId)).size).toBe(3);
    // The reference is retained — it is how a person cites the tender — but it
    // is not what tells two tenders apart.
    expect(new Set(tenders.map((t) => t.tenderReference)).size).toBe(1);
  });

  it("keeps rows apart that are identical in every visible field", () => {
    // Five of twenty rows matched another on title, reference AND closing date
    // together. Content is not an identity either.
    const html =
      row({ title: "1. Same", reference: "SAME/1", closing: CLOSES, opening: OPENS, sp: "one" }) +
      row({ title: "2. Same", reference: "SAME/1", closing: CLOSES, opening: OPENS, sp: "two" });
    expect(parseLanding(html).tenders).toHaveLength(2);
  });

  it("refuses a tender it cannot identify rather than holding it", () => {
    // Without an id it cannot be deduplicated on tomorrow's run, so it would
    // accumulate a fresh row every day until someone noticed.
    const html = row({
      title: "1. Unidentified",
      reference: "REF/9",
      closing: CLOSES,
      opening: OPENS,
      sp: null,
    });
    const { tenders, rejected } = parseLanding(html);
    expect(tenders).toHaveLength(0);
    expect(rejected[0]?.reason).toBe("no sp= identity");
  });

  it("reads the id out of an entity-encoded link", () => {
    expect(tenderIdFrom('<a href="/nicgep/app?page=Home&amp;sp=Sd1TTvyjZDD%3D">x</a>')).toBe(
      "Sd1TTvyjZDD%3D",
    );
  });

  it("has no id to report when the title is not a link", () => {
    expect(tenderIdFrom("<td>plain text</td>")).toBeNull();
  });

  it("has no id when the link carries no sp parameter", () => {
    // GePNIC links to help pages and downloads from the same tables.
    expect(tenderIdFrom('<a href="/nicgep/app?page=Help">help</a>')).toBeNull();
  });

  it("treats an empty sp as absent rather than as an identity", () => {
    // `sp=` with nothing after it would otherwise key every such row together,
    // merging unrelated tenders under one empty identity.
    expect(tenderIdFrom('<a href="/nicgep/app?sp=&page=Home">x</a>')).toBeNull();
  });
});

describe("a row count is not evidence of data", () => {
  it("ignores the search form's dropdown scaffolding", () => {
    // The gated pages return 116-125 rows of these. Counting them as tenders is
    // the misreading recorded in gepnic-access-findings.md.
    const html = "<tr><td>-Select-</td><td>-Select-</td><td>-Select-</td><td>-Select-</td></tr>";
    expect(parseLanding(html).tenders).toHaveLength(0);
  });

  it("ignores the header row", () => {
    expect(parseLanding(HEADER).tenders).toHaveLength(0);
  });

  it("ignores a row too narrow to be a tender", () => {
    // Layout tables on the same page have one and two cell rows.
    expect(parseLanding("<tr><td>x</td><td>y</td></tr>").tenders).toHaveLength(0);
  });

  it("ignores a row whose title or reference is blank", () => {
    // A tender with no title cannot be cited and a blank reference is a spacer
    // row, not a record. Neither is a rejection worth reporting.
    const blankTitle = row({
      title: "",
      reference: "REF/4",
      closing: CLOSES,
      opening: OPENS,
      sp: "x1",
    });
    const blankRef = row({
      title: "1. Something",
      reference: "",
      closing: CLOSES,
      opening: OPENS,
      sp: "x2",
    });
    const outcome = parseLanding(blankTitle + blankRef);
    expect(outcome.tenders).toHaveLength(0);
    expect(outcome.rejected).toHaveLength(0);
  });

  it("does not report navigation as a rejected tender", () => {
    // The page's nav strip and the corrigendum table's header both match the
    // four-cell shape. Reporting them as rejections tells an operator that data
    // was lost when none ever existed — a false alarm about missing records is
    // its own kind of dishonesty.
    const nav =
      "<tr><td>Search</td><td>Active Tenders</td><td>Corrigendum</td><td>Results</td></tr>" +
      "<tr><td>Reference No</td><td>Corrigendum Title</td><td>x</td><td>y</td></tr>";
    const { tenders, rejected } = parseLanding(nav);
    expect(tenders).toHaveLength(0);
    expect(rejected).toHaveLength(0);
  });
});

describe("dates are read in the zone the page prints them in", () => {
  it("reads a wall-clock time as IST, not as UTC", () => {
    // 14:00 IST is 08:30 UTC. Reading it as UTC moves the deadline five and a
    // half hours earlier, which can report a tender as closing a day early.
    expect(parseIstDateTime("14-Sep-2026 02:00 PM")).toBe("2026-09-14T08:30:00.000Z");
  });

  it("puts noon after morning, not before it", () => {
    const noon = parseIstDateTime("14-Sep-2026 12:00 PM");
    const morning = parseIstDateTime("14-Sep-2026 11:00 AM");
    expect(noon).toBe("2026-09-14T06:30:00.000Z");
    expect(Date.parse(noon ?? "")).toBeGreaterThan(Date.parse(morning ?? ""));
  });

  it("reads midnight as the start of its own day", () => {
    // 12 AM is 00:00, not 12:00. IST midnight is the previous UTC evening.
    expect(parseIstDateTime("14-Sep-2026 12:30 AM")).toBe("2026-09-13T19:00:00.000Z");
  });

  it("refuses a date that does not exist rather than rolling it forward", () => {
    // Date.UTC turns 31 February into 3 March without complaint, which would
    // silently invent a deadline.
    expect(parseIstDateTime("31-Feb-2026 10:00 AM")).toBeNull();
  });

  it("refuses a month it does not recognise", () => {
    expect(parseIstDateTime("14-Xyz-2026 10:00 AM")).toBeNull();
  });

  it("refuses an unparseable string instead of returning an epoch", () => {
    for (const bad of ["", "not a date", "2026-09-14", "14-Sep-2026", "14-Sep-2026 25:00 PM"]) {
      expect(parseIstDateTime(bad)).toBeNull();
    }
  });

  it("keeps a tender whose second date is unreadable", () => {
    // One missing date does not make the tender unusable, and dropping it would
    // lose a real advertisement over a formatting quirk.
    const html = row({
      title: "1. Partial",
      reference: "REF/1",
      closing: CLOSES,
      opening: "not stated",
      sp: "id1",
    });
    const [tender] = parseLanding(html).tenders;
    expect(tender?.closingAt).toBe("2026-09-15T09:30:00.000Z");
    expect(tender?.bidOpeningAt).toBeNull();
  });
});

describe("the text as the page states it", () => {
  it("strips the list numbering the portal prints before each title", () => {
    const html = row({
      title: "12. Supply of STAY SET COMPLETE",
      reference: "REF/2",
      closing: CLOSES,
      opening: OPENS,
      sp: "id2",
    });
    expect(parseLanding(html).tenders[0]?.title).toBe("Supply of STAY SET COMPLETE");
  });

  it("decodes entities without letting an escaped entity become markup", () => {
    const html = row({
      title: "1. Roads &amp;&#35; Bridges",
      reference: "REF/3",
      closing: CLOSES,
      opening: OPENS,
      sp: "id3",
    });
    expect(parseLanding(html).tenders[0]?.title).toBe("Roads &# Bridges");
  });
});
