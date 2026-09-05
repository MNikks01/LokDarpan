import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FilterPanel } from "./FilterPanel";
import { RecordsPanel } from "./RecordsPanel";
import { TendersPanel, type StateCollection, type TenderOverview } from "./tenders";
import type { LevelCoverage } from "./use-explorer-data";

/**
 * What the rail is allowed to say when it holds nothing.
 *
 * Both panels had the same defect from opposite directions: each rendered a
 * count, and a count cannot distinguish "we hold none" from "there are none".
 * The first is a fact about LokDarpan; the second is a claim about a government.
 */

const collection = (over: Partial<StateCollection> = {}): StateCollection => ({
  stateLgdCode: "27",
  status: "not_collected",
  portalCode: null,
  collectingSince: null,
  lastSuccessAt: null,
  lastCheckedAt: null,
  ...over,
});

const overview = (over: Partial<TenderOverview> = {}): TenderOverview => ({
  districts: [],
  departments: [],
  windows: [],
  unplacedCount: 0,
  collection: collection(),
  ...over,
});

const noop = (): void => undefined;

const tenderPanel = (over: Partial<TenderOverview> = {}, stateName = "Maharashtra"): string =>
  renderToStaticMarkup(
    <TendersPanel
      overview={overview(over)}
      failed={false}
      department={null}
      onSelectDepartment={noop}
      showingUnplaced={false}
      onToggleUnplaced={noop}
      stateName={stateName}
    />,
  );

describe("a state nobody collects is not a state with no tenders", () => {
  it("says tender data is not collected, naming the state", () => {
    const markup = tenderPanel();
    expect(markup).toContain("not currently collected for Maharashtra");
  });

  // The specific regression: "0 tenders" is a true count and a false statement.
  it("shows no tender count at all when nothing is collected", () => {
    const markup = tenderPanel();
    expect(markup).not.toMatch(/\b0\b\s*(open\s*)?tenders?/u);
  });

  it("says the sentence is about our holdings, not about the state", () => {
    expect(tenderPanel()).toContain("not what has been advertised");
  });

  // A collected state that genuinely holds none must still be able to say zero:
  // there the count is a measurement, not a gap.
  it("still counts tenders for a state that is collected", () => {
    const markup = tenderPanel({
      collection: collection({ status: "collected", portalCode: "kerala" }),
      districts: [
        { adminUnitId: 1, districtName: "Somewhere", tenderCount: 4, departments: ["Works"] },
      ],
    });
    expect(markup).toContain("4");
    expect(markup).not.toContain("not currently collected");
  });

  it("warns that the last attempt did not complete when collection is failing", () => {
    const markup = tenderPanel({
      collection: collection({
        status: "failing",
        portalCode: "kerala",
        lastSuccessAt: "2026-08-01T00:00:00.000Z",
        lastCheckedAt: "2026-09-05T00:00:00.000Z",
      }),
    });
    expect(markup).toContain("did not complete");
    // The tenders already held stay on screen; a failed attempt withdraws
    // nothing.
    expect(markup).not.toContain("not currently collected");
  });

  it("says so when a collected state's figures have gone stale", () => {
    const markup = tenderPanel({
      collection: collection({
        status: "stale",
        portalCode: "kerala",
        lastSuccessAt: "2026-08-01T00:00:00.000Z",
        lastCheckedAt: "2026-08-01T00:00:00.000Z",
      }),
    });
    expect(markup).toContain("more than two days ago");
  });
});

const coverage = (over: Partial<LevelCoverage> = {}): LevelCoverage => ({
  level: "urban_local_body",
  status: "partial",
  note: "OpenStreetMap tags 18 of an estimated 270.",
  sourceId: "openstreetmap-overpass",
  checkedAt: "2026-09-05T00:00:00.000Z",
  inherited: true,
  ...over,
});

const filterPanel = (levels: readonly LevelCoverage[]): string =>
  renderToStaticMarkup(
    <FilterPanel
      states={[
        {
          id: "27",
          code: "27",
          name: "Maharashtra",
          slug: "maharashtra",
          bbox: [72.6, 15.6, 80.9, 22.0],
          labelPoint: [76.5, 19.0],
          labelWeight: 1,
          districtCount: 36,
          unitId: 20,
        },
      ]}
      units={[]}
      coverage={levels}
      geo={{ stateCode: "27", unitId: 3661 }}
      actions={{
        selectState: noop,
        selectUnit: noop,
        selectPlace: noop,
        selectDocument: noop,
        resetAll: noop,
      }}
      loading={false}
      ancestors={[]}
    />,
  );

describe("an area list is not a census of the place", () => {
  // Pune holds 14 talukas and no municipal body, and Pune Municipal Corporation
  // plainly exists. Without this the selector is read as Pune's local government.
  it("says local-body coverage is incomplete rather than leaving a silence", () => {
    const markup = filterPanel([coverage()]);
    expect(markup).toContain("coverage is incomplete");
    expect(markup).toContain("18 of an estimated 270");
  });

  it("never states that the place has none", () => {
    const markup = filterPanel([coverage()]);
    expect(markup).not.toMatch(/has no local bod/iu);
    expect(markup).not.toMatch(/there are no local bod/iu);
  });

  it("distinguishes a level nobody collected from one collected in part", () => {
    const markup = filterPanel([coverage({ level: "ward", status: "not_collected", note: null })]);
    expect(markup).toContain("have not been collected");
  });

  // Announcing that a complete level is complete would bury the line that
  // matters among lines that do not.
  it("says nothing when every level held is complete", () => {
    const markup = filterPanel([
      coverage({ level: "sub_district", status: "complete", note: "All 355 held." }),
    ]);
    expect(markup).not.toContain("incomplete");
    expect(markup).not.toContain("have not been collected");
  });
});

const recordsPanel = (documents: React.ComponentProps<typeof RecordsPanel>["documents"]): string =>
  renderToStaticMarkup(
    <RecordsPanel
      scopeLabel="Nagpur"
      documents={documents}
      loading={false}
      failed={false}
      selectedDocumentId={null}
      onSelect={noop}
      hasPlace
    />,
  );

describe("holding no record for a place is not a finding about the place", () => {
  // Before this, every level asked for its state's records, so Nagpur showed
  // Maharashtra's thirty audit reports and a reader could only read them as
  // findings about Nagpur.
  it("names the area and says nothing is attributed to it", () => {
    const markup = recordsPanel([]);
    expect(markup).toContain("No records are currently attributed to Nagpur");
  });

  it("says the sentence is about our holdings, not about the area", () => {
    const markup = recordsPanel([]);
    expect(markup).toContain("not what has been audited or spent in this area");
  });

  it("never states that the area has no audits", () => {
    const markup = recordsPanel([]);
    expect(markup).not.toMatch(/no audits?\b/iu);
    expect(markup).not.toMatch(/nothing (has been|was) audited/iu);
  });

  // The issuing office is the trap the attribution rule exists for, and the
  // panel says so where a reader meets the empty list.
  it("explains that an issuing office is not the area audited", () => {
    expect(recordsPanel([])).toContain("the office that issued a report is not the area it audits");
  });

  it("still lists records where there are some", () => {
    const markup = recordsPanel([
      {
        documentId: 1,
        title: "A report about this district",
        issuingAuthority: "Some authority",
        publishedFacts: 3,
        awaitingReview: 0,
        adminUnitName: "Nagpur",
        adminUnitLevel: "district",
        geographySource: "publisher_filter",
      },
    ]);
    expect(markup).toContain("A report about this district");
    expect(markup).not.toContain("No records are currently attributed");
  });
});
