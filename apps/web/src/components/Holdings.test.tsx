import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  auditHolding,
  boundaryHolding,
  budgetHolding,
  holdingHeadline,
  publicationDecision,
  tenderHolding,
  worksHolding,
  type Decide,
  type Holding,
  type HoldingHeadline,
} from "@lokdarpan/domain";

import { Holdings } from "./Holdings";

const asRecorded: Decide = (id) => publicationDecision(id);
const maharashtra = { unitId: 20, name: "Maharashtra" };

const text = (markup: string): string =>
  markup
    .replace(/<\/(dt|dd|p|h2)>/gu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x27;/gu, "'")
    .replace(/[ \t]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .trim();

const render = (holdings: readonly Holding[] | null, place = "Nagpur"): string =>
  text(renderToStaticMarkup(<Holdings holdings={holdings} place={place} />));

const tenders = {
  status: "collected" as const,
  portalCode: "kerala",
  collectingSince: "2026-08-20",
  lastSuccessAt: "2026-10-08T01:00:00Z",
  lastCheckedAt: "2026-10-08T01:00:00Z",
};

/** One row for every headline a row can carry, so each has a snapshot (LD-009). */
const EVERY_HEADLINE: Readonly<Partial<Record<HoldingHeadline, Holding>>> = {
  held: boundaryHolding({ level: "sub_district", held: 14, coverage: null }, asRecorded),
  partial: boundaryHolding(
    {
      level: "urban_local_body",
      held: 1,
      coverage: {
        status: "partial",
        note: "OpenStreetMap tags 18 of about 270.",
        sourceId: "openstreetmap-overpass",
        checkedAt: "2026-09-05T08:36:09Z",
      },
    },
    asRecorded,
  ),
  current: tenderHolding(tenders, asRecorded, maharashtra),
  stale: tenderHolding({ ...tenders, status: "stale" }, asRecorded, maharashtra),
  failing: tenderHolding({ ...tenders, status: "failing" }, asRecorded, maharashtra),
  withheld: budgetHolding(
    { held: 33, lastAt: "2026-08-26T11:58:19Z", filedUnder: maharashtra },
    asRecorded,
  ),
  not_collected: worksHolding(),
};

describe("Holdings", () => {
  it.each(Object.entries(EVERY_HEADLINE))("renders a %s row", (headline, holding) => {
    expect(holdingHeadline(holding)).toBe(headline);
    expect(render([holding])).toMatchSnapshot();
  });

  it("names the state a district's records are filed under, never reporting none for the district", () => {
    const page = render([
      auditHolding(
        { held: 10, lastAt: "2026-09-04T06:30:28Z", filedUnder: maharashtra },
        asRecorded,
      ),
    ]);
    expect(page).toContain(
      "10 reports of the Comptroller and Auditor General are held for Maharashtra.",
    );
    expect(page).toContain("Reports are filed by state");
    expect(page).not.toContain("for Nagpur");
  });

  it("states withheld budgets without a count, and why", () => {
    const page = render(
      [budgetHolding({ held: 33, lastAt: null, filedUnder: null }, asRecorded)],
      "Maharashtra",
    );
    expect(page).toContain("Held, not shown");
    expect(page).toContain("permission, which is not yet recorded");
    expect(page).not.toContain("33");
  });

  it("says the checklist could not be loaded, as a fault here, when it is missing", () => {
    expect(render(null)).toContain("This is a fault here, not a statement about any record.");
  });
});
