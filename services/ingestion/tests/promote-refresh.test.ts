import { describe, expect, it } from "vitest";

import { identityOf, isSettled, planRefresh } from "../src/cag/promote-refresh";

type Row = Record<string, unknown>;

/** A figure as `SELECT *` renders it. Ids differ between the two sides on purpose. */
const fact = (id: number, over: Row = {}): Row => ({
  id,
  page_number: 4,
  kind: "monetary_amount",
  raw_text: "released ₹ 5 crore",
  normalised_value: "5000000000",
  field: null,
  verification_status: "unverified",
  verified_by: null,
  verified_at: null,
  corrected_value: null,
  reviewer_note: null,
  parser_version: "cag-facts/24",
  extraction_confidence: 0.8,
  extraction_method: "pattern",
  validation_state: "needs_review",
  validation_reason: null,
  per_unit: null,
  bbox_x0: null,
  bbox_y0: null,
  bbox_x1: null,
  bbox_y1: null,
  same_figure_as: null,
  page_reading_id: null,
  ...over,
});

const verified = {
  verification_status: "verified",
  verified_by: "R",
  verified_at: "2026-10-07T10:00:00+00:00",
};
const body = (id: number, over: Row = {}): Row =>
  fact(id, {
    kind: "body_reference",
    raw_text: "The Public Works Department",
    normalised_value: "Public Works Department",
    ...over,
  });

describe("planRefresh", () => {
  it("is settled when both sides agree, whatever the ids", () => {
    const plan = planRefresh(
      { facts: [fact(1, verified)], history: [] },
      { facts: [fact(90, verified)], history: [] },
    );
    expect(isSettled(plan)).toBe(true);
  });

  it("adds a figure the target lacks, such as a new parser's candidate", () => {
    const plan = planRefresh(
      { facts: [fact(1), body(2, verified)], history: [] },
      { facts: [fact(90)], history: [] },
    );
    expect(plan.insert.map((f) => f["kind"])).toEqual(["body_reference"]);
    expect(plan.update).toEqual([]);
  });

  it("copies a decision made since, on the target's own row", () => {
    const plan = planRefresh(
      { facts: [fact(1, verified)], history: [] },
      { facts: [fact(90)], history: [] },
    );
    expect(plan.update).toEqual([{ targetId: 90, set: verified }]);
  });

  it("removes an undecided candidate the source retired, and keeps a decided one", () => {
    const plan = planRefresh(
      { facts: [], history: [] },
      { facts: [fact(90), body(91, verified)], history: [] },
    );
    expect(plan.retire).toEqual([90]);
    expect(plan.stranded).toBe(1);
  });

  it("carries history the target lacks, matched to the figure by identity", () => {
    const h = {
      id: 5,
      document_fact_id: 1,
      verification_status: "verified",
      verified_by: "R",
      verified_at: "2026-10-01T00:00:00+00:00",
      corrected_value: null,
      reviewer_note: null,
      superseded_at: "2026-10-07T00:00:00+00:00",
    };
    const plan = planRefresh(
      {
        facts: [
          fact(1, {
            verification_status: "rejected",
            verified_by: "R",
            verified_at: "2026-10-07T00:00:00+00:00",
          }),
        ],
        history: [h],
      },
      { facts: [fact(90, verified)], history: [] },
    );
    expect(plan.history).toEqual([{ identity: `${identityOf(fact(1))}#0`, row: h }]);
    // History the target already holds, under its own ids, is not carried twice.
    const settled = planRefresh(
      { facts: [fact(1)], history: [h] },
      { facts: [fact(90)], history: [{ ...h, id: 77, document_fact_id: 90 }] },
    );
    expect(settled.history).toEqual([]);
  });

  it("sets a same-figure link by what it points at, not by number", () => {
    const marathi = fact(2, { page_number: 1, raw_text: "रु. 5 कोटी", same_figure_as: 1 });
    const plan = planRefresh(
      { facts: [fact(1), marathi], history: [] },
      { facts: [fact(90), { ...marathi, id: 91, same_figure_as: null }], history: [] },
    );
    expect(plan.links).toEqual([[`${identityOf(marathi)}#0`, `${identityOf(fact(1))}#0`]]);
  });

  it("leaves figures read from a scan behind, and counts them", () => {
    const plan = planRefresh(
      { facts: [fact(1, { page_reading_id: 3 })], history: [] },
      { facts: [], history: [] },
    );
    expect(plan.insert).toEqual([]);
    expect(plan.scanSkipped).toBe(1);
  });

  it("matches figures that share an identity by their order, as promotion kept it", () => {
    const plan = planRefresh(
      { facts: [fact(1, verified), fact(2)], history: [] },
      { facts: [fact(90), fact(91)], history: [] },
    );
    expect(plan.update).toEqual([{ targetId: 90, set: verified }]);
    expect(plan.insert).toEqual([]);
    expect(plan.retire).toEqual([]);
  });
});

describe("isSettled", () => {
  const empty = planRefresh({ facts: [], history: [] }, { facts: [], history: [] });

  it.each([
    ["a figure to add", { insert: [{}] }],
    ["a decision to copy", { update: [{ targetId: 1, set: {} }] }],
    ["a candidate to retire", { retire: [1] }],
    ["history to carry", { history: [{ identity: "x", row: {} }] }],
    ["a link to set", { links: [["x", null] as const] }],
  ])("is not settled while there is %s", (_label, part) => {
    expect(isSettled({ ...empty, ...part })).toBe(false);
  });

  it("treats a column the row does not carry as empty, on either side", () => {
    const bare = (id: number): Record<string, unknown> => ({
      id,
      page_number: 2,
      kind: "work_reference",
      raw_text: "the road from A to B",
    });
    expect(
      isSettled(planRefresh({ facts: [bare(1)], history: [] }, { facts: [bare(9)], history: [] })),
    ).toBe(true);
  });
});
