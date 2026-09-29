import { describe, expect, it } from "vitest";

import { cliArgs } from "../src/cli-args";
import { districtKey } from "../src/gepnic/detail";
import {
  describeHint,
  districtsNamedIn,
  groupForReview,
  officeOf,
  reviewCsv,
  type District,
  type ReviewRow,
} from "../src/gepnic/review";

const DISTRICTS: ReadonlyMap<string, District> = new Map(
  [
    { name: "Bargarh", lgdCode: "347" },
    { name: "Siang", lgdCode: "679" },
    { name: "Marigaon", lgdCode: "296" },
    { name: "Kokrajhar", lgdCode: "294" },
    { name: "Nalbari", lgdCode: "298" },
  ].map((d) => [districtKey(d.name), d]),
);

const row = (over: Partial<ReviewRow>): ReviewRow => ({
  portalCode: "assam",
  portalTenderId: "T1",
  organisationChain: "Public Works Department||Division I",
  location: null,
  pincode: null,
  ...over,
});

describe("what a tender's text names", () => {
  it("finds a district by the ledger's name, and across a spelling variant of a long word", () => {
    expect(districtsNamedIn("Kokrajhar", DISTRICTS).map((d) => d.lgdCode)).toEqual(["294"]);
    expect(districtsNamedIn("Jagirod, Morigaon", DISTRICTS).map((d) => d.lgdCode)).toEqual(["296"]);
  });

  it("does not let a short town collide with a district through the vowel-less comparison", () => {
    // "Singa" and "Siang" reduce to the same letters; a hint must not say one is the other.
    expect(districtsNamedIn("Singa", DISTRICTS)).toEqual([]);
    expect(districtsNamedIn("Siang", DISTRICTS).map((d) => d.lgdCode)).toEqual(["679"]);
  });
});

describe("grouping the review list", () => {
  const rows: ReviewRow[] = [
    row({ portalTenderId: "A1", organisationChain: "PWD||DIV Kokrajhar", location: "Kokrajhar" }),
    row({ portalTenderId: "A2", organisationChain: "PWD||DIV Kokrajhar", location: "Gossaigaon" }),
    row({
      portalTenderId: "B1",
      organisationChain: "Irrigation||Chief Engineer",
      location: "Nalbari, Morigaon",
    }),
    row({
      portalTenderId: "C1",
      organisationChain: "Forest||Society",
      location: "As Per Tender Document",
    }),
    row({ portalTenderId: "D1", organisationChain: "Health||Corporation", location: "Guwahati" }),
  ];
  const groups = groupForReview(rows, DISTRICTS);
  const byOffice = new Map(groups.map((g) => [g.office, g]));

  it("groups by the issuing office, largest first", () => {
    expect(groups.map((g) => g.office)).toEqual([
      "DIV Kokrajhar",
      "Chief Engineer",
      "Corporation",
      "Society",
    ]);
    expect(officeOf(null)).toBe("(no chain)");
  });

  it("says how many of a group name the district, so one tender's answer is not taken for all", () => {
    const hint = byOffice.get("DIV Kokrajhar")?.hint;
    // The office "DIV Kokrajhar" names the district by an exact word, so both
    // tenders name it: one by its location, both by their office.
    expect(hint).toMatchObject({ kind: "names_district", namedBy: 2, of: 2 });
    const mixed = groupForReview(
      [
        row({ portalTenderId: "E1", organisationChain: "Police||Housing", location: "Baragarh" }),
        row({ portalTenderId: "E2", organisationChain: "Police||Housing", location: "Khurda" }),
      ],
      DISTRICTS,
    );
    expect(describeHint(mixed[0]?.hint ?? { kind: "names_no_place" })).toBe(
      "names Bargarh (LGD 347) in 1 of 2; the rest name no district",
    );
  });

  it("marks a group that names several districts, and one that names no place at all", () => {
    expect(byOffice.get("Chief Engineer")?.hint.kind).toBe("names_several");
    expect(byOffice.get("Society")?.hint.kind).toBe("names_no_place");
    expect(byOffice.get("Corporation")?.hint.kind).toBe("town_or_office");
  });
});

describe("the review sheet", () => {
  it("suggests each tender's own district, never its group's, and leaves the decision empty", () => {
    const groups = groupForReview(
      [
        row({ portalTenderId: "E1", organisationChain: "Police||Housing", location: "Baragarh" }),
        row({
          portalTenderId: "E2",
          organisationChain: "Police||Housing",
          location: 'Khurda "HQ"',
        }),
      ],
      DISTRICTS,
    );
    const [header, first, second] = reviewCsv("Odisha", groups, DISTRICTS).trim().split("\n");
    expect(header).toBe(
      "state,group,office,hint,suggested_district,portal,tender,organisation_chain,location,pincode,decision,reason",
    );
    expect(first).toContain('"E1"');
    expect(first).toContain('"347"');
    expect(first?.endsWith(',"",""')).toBe(true);
    // The Khurda tender names no district the ledger holds: no suggestion, and
    // its quote is escaped rather than breaking the row.
    expect(second).toContain('"Khurda ""HQ"""');
    expect(second).toContain(',"","assam","E2"');
  });
});

describe("command arguments", () => {
  it("drops the -- pnpm passes through, and only that", () => {
    expect(cliArgs(["node", "cli.ts", "--", "--api"])).toEqual(["--api"]);
    expect(cliArgs(["node", "cli.ts", "--api"])).toEqual(["--api"]);
    expect(cliArgs(["node", "cli.ts", "--tender", "--", "x"])).toEqual(["--tender", "--", "x"]);
  });
});
