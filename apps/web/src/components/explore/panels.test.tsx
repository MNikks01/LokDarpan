import { levelCoverageState, tenderCollectionState } from "@lokdarpan/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FilterPanel } from "./FilterPanel";
import { RecordsPanel } from "./RecordsPanel";
import { TenderList, TendersPanel, type StateCollection, type TenderOverview } from "./tenders";
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

/** An overview whose `collectionState` always agrees with its `collection`, as the API's does. */
const overview = (over: Partial<TenderOverview> = {}): TenderOverview => {
  const stateCollection = over.collection === undefined ? collection() : over.collection;
  return {
    districts: [],
    departments: [],
    windows: [],
    unplacedCount: 0,
    detailsWithheld: true,
    sources: [],
    ...over,
    collection: stateCollection,
    collectionState: stateCollection === null ? null : tenderCollectionState(stateCollection),
    // As the server computes it: the panel renders these and sums nothing.
    placed: {
      tenders: (over.districts ?? []).reduce((sum, d) => sum + d.tenderCount, 0),
      districts: (over.districts ?? []).length,
      inferred: over.placed?.inferred ?? 0,
    },
  };
};

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

describe("the tender total comes from the server", () => {
  // Rule A (ADR-059): client code does no arithmetic on what it shows. The
  // fixture's placed total deliberately disagrees with its districts, so only a
  // panel that renders the server's figure passes.
  it("renders the server's placed total, not a sum of its own", () => {
    const markup = renderToStaticMarkup(
      <TendersPanel
        overview={{
          ...overview({
            collection: collection({
              status: "collected",
              portalCode: "madhyaprades",
              collectingSince: "2026-09-01",
              lastSuccessAt: "2026-09-23T00:00:00Z",
              lastCheckedAt: "2026-09-23T00:00:00Z",
            }),
            districts: [
              { adminUnitId: 1, districtName: "Jabalpur", tenderCount: 3, departments: [] },
            ],
          }),
          placed: { tenders: 11, districts: 4, inferred: 0 },
        }}
        failed={false}
        department={null}
        onSelectDepartment={noop}
        showingUnplaced={false}
        onToggleUnplaced={noop}
        stateName="Madhya Pradesh"
      />,
    );
    expect(markup).toContain("<strong>11</strong> open tenders across 4 districts.");
  });
});

describe("a collected state with nothing to shade", () => {
  // The regression behind it: the panel under Odisha said "0 open tenders
  // across 0 districts" once its counts were scoped to Odisha. A bare zero is
  // a measurement of our collection that reads as one of the state.
  it("says none is held, in words, rather than counting zero", () => {
    const markup = tenderPanel(
      {
        collection: collection({
          status: "collected",
          portalCode: "odisha",
          collectingSince: "2026-09-01",
          lastSuccessAt: "2026-09-23T00:00:00Z",
          lastCheckedAt: "2026-09-23T00:00:00Z",
        }),
        districts: [],
      },
      "Odisha",
    );
    expect(markup).toContain("No open tender is held for offices in a district of Odisha");
    expect(markup).not.toMatch(/\b0\b\s*(open\s*)?tenders?/u);
  });
});

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

  it("says when a collected state's figures were last collected, not a fixed interval", () => {
    const markup = tenderPanel({
      collection: collection({
        status: "stale",
        portalCode: "kerala",
        lastSuccessAt: "2026-08-01T00:00:00.000Z",
        lastCheckedAt: "2026-08-01T00:00:00.000Z",
      }),
    });
    expect(markup).toContain("last collected on 1 Aug 2026");
    expect(markup).not.toContain("two days");
  });

  // A portal registered but never collected successfully holds no data to be stale.
  it("says there is no record of checking when collection has never succeeded", () => {
    const markup = tenderPanel({
      collection: collection({ status: "stale", portalCode: "kerala", lastSuccessAt: null }),
    });
    expect(markup).toContain("no record of checking its e-procurement portal for Maharashtra");
    expect(markup).not.toMatch(/\b0\b\s*(open\s*)?tenders?/u);
  });

  it("reports a failed request as a fault here, not a statement about a portal", () => {
    const markup = renderToStaticMarkup(
      <TendersPanel
        overview={overview()}
        failed
        department={null}
        onSelectDepartment={noop}
        showingUnplaced={false}
        onToggleUnplaced={noop}
        stateName="Kerala"
      />,
    );
    expect(markup).toContain("could not be loaded just now");
    expect(markup).toContain("not a statement about any portal");
    expect(markup).not.toContain("unavailable");
  });

  it("dates an empty list by when collection began, rather than calling it recent", () => {
    const markup = renderToStaticMarkup(
      <TenderList heading="Tenders" tenders={[]} loading={false} collectingSince="2026-08-20" />,
    );
    expect(markup).toContain("Tenders from before 20 Aug 2026 are not held");
    expect(markup).not.toContain("recently");
  });
});

const coverage = (over: Partial<Omit<LevelCoverage, "state">> = {}): LevelCoverage => {
  const level = {
    level: "urban_local_body",
    status: "partial" as const,
    note: "OpenStreetMap tags 18 of an estimated 270.",
    sourceId: "openstreetmap-overpass",
    checkedAt: "2026-09-05T00:00:00.000Z",
    inherited: true,
    ...over,
  };
  return { ...level, state: levelCoverageState(level) };
};

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
        toggleLayer: noop,
        selectDepartment: noop,
        resetAll: noop,
      }}
      loading={false}
      ancestors={[]}
    />,
  );

describe("an area list is not a census of the place", () => {
  // Pune holds 14 talukas and no municipal body, and Pune Municipal Corporation
  // plainly exists. Without this the selector is read as Pune's local government.
  it("says not every municipal body is held, rather than leaving a silence", () => {
    const markup = filterPanel([coverage()]);
    expect(markup).toContain("Not every municipal body is held.");
    expect(markup).not.toContain("incomplete");
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
    expect(markup).not.toContain("is held.");
    expect(markup).not.toContain("have not been collected");
  });

  it("keeps a Gram Panchayat a proper noun inside the sentence", () => {
    const markup = filterPanel([coverage({ level: "gram_panchayat" })]);
    expect(markup).toContain("Not every Gram Panchayat is held.");
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

const tender = {
  id: 1,
  title: "Improvement of Road from A to B",
  tenderReference: "2026_PWD_1_1",
  department: "Public Works Department",
  closingAt: null,
  tenderCategory: null,
  productCategory: null,
  tenderType: null,
  location: null,
  pincode: null,
  tenderValueInr: "5920000.00",
  emdInr: null,
  organisationChain: "PWD||Division 1",
  districtName: "Somewhere",
  districtSource: "chain_unit",
  districtEvidenceKey: null,
  sourceUrl: "https://etenders.kerala.gov.in/nicgep/app",
};

describe("tender details are withheld under the portals' terms", () => {
  // Every collected portal permits reproduction only with the issuing
  // department's permission. Until that exists the reader gets a count, the
  // reason, and the portal — which the same terms let anyone link to.
  it("states how many are held and links to the portal, reproducing nothing", () => {
    const markup = renderToStaticMarkup(
      <TenderList
        heading="Tenders from offices in Somewhere"
        tenders={[]}
        loading={false}
        detailsWithheld
        heldCount={12}
        portalUrl="https://etenders.kerala.gov.in/nicgep/app"
      />,
    );
    expect(markup).toContain("12 open tenders are held for offices here.");
    expect(markup).toContain("which LokDarpan has not sought");
    expect(markup).toContain('href="https://etenders.kerala.gov.in/nicgep/app"');
    expect(markup).not.toContain("Improvement of Road");
    expect(markup).not.toContain("59,20,000");
  });

  it("still says nothing is held when nothing is, rather than withholding nothing", () => {
    const markup = renderToStaticMarkup(
      <TenderList heading="Tenders" tenders={[]} loading={false} detailsWithheld heldCount={0} />,
    );
    expect(markup).toContain("No open tender is held here.");
    expect(markup).not.toContain("details are not shown");
  });

  it("lists tender details once permission is recorded", () => {
    const markup = renderToStaticMarkup(
      <TenderList heading="Tenders" tenders={[tender]} loading={false} detailsWithheld={false} />,
    );
    expect(markup).toContain("Improvement of Road from A to B");
  });

  it("says a district was inferred, and from what, never as the office's own statement", () => {
    const inferred = { ...tender, districtSource: "pincode", districtEvidenceKey: "605602" };
    const markup = renderToStaticMarkup(
      <TenderList heading="Tenders" tenders={[inferred]} loading={false} detailsWithheld={false} />,
    );
    expect(markup).toContain("Not named by the issuing office");
    expect(markup).toContain("pincode 605602");
    expect(markup).not.toContain("The issuing office names this district");
  });

  it("says how much of the shading is inference", () => {
    const markup = tenderPanel({
      collection: collection({ status: "collected", portalCode: "tripura" }),
      districts: [
        { adminUnitId: 1, districtName: "West Tripura", tenderCount: 5, departments: [] },
      ],
      placed: { tenders: 5, districts: 1, inferred: 3 },
    });
    expect(markup).toContain("3 of these are placed by inference");
  });

  it("offers no way to open the unplaced list while details are withheld", () => {
    const markup = tenderPanel({
      collection: collection({ status: "collected", portalCode: "kerala" }),
      unplacedCount: 7,
    });
    expect(markup).toContain("7 further tenders name no district");
    expect(markup).not.toContain("Show them");
    expect(markup).toContain("for the same reason as other tenders");
  });
});
