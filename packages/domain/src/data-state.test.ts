import { describe, expect, it } from "vitest";

import {
  displayStateOf,
  levelCoverageState,
  mayShowCounts,
  tenderCollectionState,
  type DataState,
} from "./data-state";

const collected = tenderCollectionState({
  status: "collected",
  portalCode: "kerala",
  collectingSince: "2026-08-20",
  lastSuccessAt: "2026-09-16T01:00:00Z",
  lastCheckedAt: "2026-09-16T01:00:00Z",
});

describe("displayStateOf", () => {
  it("reports a failed request as the request's failure, never as the data's", () => {
    expect(displayStateOf(collected, "unavailable")).toBe("unavailable");
    expect(displayStateOf(null, "unavailable")).toBe("unavailable");
    expect(displayStateOf(collected, "loading")).toBe("loading");
  });

  it("puts not-collected ahead of every statement about data held", () => {
    const state: DataState = { ...collected, collection: "not_collected", freshness: "failing" };
    expect(displayStateOf(state, "ok")).toBe("not_collected");
  });

  it("treats a missing state as unknown, not as current", () => {
    expect(displayStateOf(null, "ok")).toBe("unknown");
  });

  it("puts failing and stale ahead of partial, because both can be true", () => {
    const state: DataState = { ...collected, freshness: "stale", completeness: "partial" };
    expect(displayStateOf(state, "ok")).toBe("stale");
    expect(displayStateOf({ ...state, freshness: "failing" }, "ok")).toBe("failing");
    expect(displayStateOf({ ...state, freshness: "fresh" }, "ok")).toBe("partial");
  });

  // Boundaries have no schedule. Calling them "current" would be a claim nothing supports.
  it("says held, not current, when there is no schedule to be current against", () => {
    expect(displayStateOf(collected, "ok")).toBe("current");
    expect(
      displayStateOf(
        levelCoverageState({
          status: "complete",
          note: null,
          sourceId: "openstreetmap-overpass",
          checkedAt: "2026-09-01T00:00:00Z",
        }),
        "ok",
      ),
    ).toBe("held");
  });
});

describe("mayShowCounts", () => {
  it("allows counts only for data we collect", () => {
    expect(mayShowCounts(collected)).toBe(true);
    expect(mayShowCounts({ ...collected, freshness: "failing" })).toBe(true);
    expect(mayShowCounts({ ...collected, collection: "not_collected" })).toBe(false);
    expect(mayShowCounts({ ...collected, collection: "unknown" })).toBe(false);
    expect(mayShowCounts(null)).toBe(false);
  });
});

describe("tenderCollectionState", () => {
  it("carries nothing for a state no portal collects", () => {
    const state = tenderCollectionState({
      status: "not_collected",
      portalCode: null,
      collectingSince: null,
      lastSuccessAt: null,
      lastCheckedAt: null,
    });
    expect(state).toMatchObject({
      collection: "not_collected",
      freshness: "unknown",
      completeness: "unknown",
      sourceIds: [],
    });
  });

  it("maps failing and stale collection to freshness, and never claims completeness", () => {
    for (const status of ["stale", "failing"] as const) {
      const state = tenderCollectionState({
        status,
        portalCode: "kerala",
        collectingSince: "2026-08-20",
        lastSuccessAt: "2026-09-01T01:00:00Z",
        lastCheckedAt: "2026-09-16T01:00:00Z",
      });
      expect(state.freshness).toBe(status);
      expect(state.completeness).toBe("unknown");
      expect(state.sourceIds).toEqual(["gepnic-kerala"]);
    }
  });
});

describe("levelCoverageState", () => {
  it("keeps the note wherever it explains a shortfall, and drops it for a complete level", () => {
    const partial = levelCoverageState({
      status: "partial",
      note: "Forty villages are held, all within Nagpur district.",
      sourceId: "openstreetmap-overpass",
      checkedAt: "2026-09-01T00:00:00Z",
    });
    expect(partial.completeness).toBe("partial");
    expect(partial.note).toMatch(/Forty villages/);

    const complete = levelCoverageState({
      status: "complete",
      note: "stray",
      sourceId: "openstreetmap-overpass",
      checkedAt: "2026-09-01T00:00:00Z",
    });
    expect(complete.note).toBeNull();
  });

  it("marks a level nobody collected as not collected, with no completeness claim", () => {
    const state = levelCoverageState({
      status: "not_collected",
      note: "No ward register has been collected.",
      sourceId: "lgd",
      checkedAt: "2026-09-01T00:00:00Z",
    });
    expect(state.collection).toBe("not_collected");
    expect(state.note).toBe("No ward register has been collected.");
    expect(mayShowCounts(state)).toBe(false);
  });
});
