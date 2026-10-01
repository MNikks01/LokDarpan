import { describe, expect, it } from "vitest";

import { collectionStatusOf } from "@lokdarpan/database";
import { assessCollection, type CollectionFacts } from "../src/freshness/assess";

const NOW = new Date("2026-10-01T02:00:00Z");
const hoursAgo = (h: number): string => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const window = (portalCode: string, success: number | null, checked: number | null) => ({
  portalCode,
  collectingSince: "2026-09-24",
  lastSuccessAt: success === null ? null : hoursAgo(success),
  lastCheckedAt: checked === null ? null : hoursAgo(checked),
  stateLgdCode: "32",
});

const healthy: CollectionFacts = {
  windows: [window("kerala", 6, 6), window("goa", 6, 6)],
  lastSweepStartedAt: new Date(hoursAgo(6)),
  stuck: [],
};

describe("collectionStatusOf: the rule the site and the alert share", () => {
  it("is collected when the last attempt succeeded recently", () => {
    expect(collectionStatusOf(window("k", 6, 6), NOW)).toBe("collected");
  });

  // Tried after it last succeeded: the most recent attempt did not complete.
  it("is failing when the last attempt is newer than the last success", () => {
    expect(collectionStatusOf(window("k", 30, 6), NOW)).toBe("failing");
    expect(collectionStatusOf(window("k", null, 6), NOW)).toBe("failing");
  });

  it("is stale after 48 hours without a success, and not before", () => {
    expect(collectionStatusOf(window("k", 47, 47), NOW)).toBe("collected");
    expect(collectionStatusOf(window("k", 49, 49), NOW)).toBe("stale");
  });
});

describe("assessCollection", () => {
  it("reports a healthy collection as healthy, with every portal listed", () => {
    const a = assessCollection(healthy, NOW);
    expect(a.healthy).toBe(true);
    expect(a.problems).toEqual([]);
    expect(a.report).toContain("healthy");
    expect(a.report).toContain("| kerala | collected |");
  });

  it("names a failing portal", () => {
    const a = assessCollection({ ...healthy, windows: [window("kerala", 30, 6)] }, NOW);
    expect(a.healthy).toBe(false);
    expect(a.problems.join()).toMatch(/`kerala` is failing/);
  });

  it("names a stale portal", () => {
    const a = assessCollection({ ...healthy, windows: [window("goa", 60, 60)] }, NOW);
    expect(a.problems.join()).toMatch(/`goa` is stale/);
  });

  // A schedule that stops firing leaves no run and no failure behind.
  it("notices when no sweep has started in 26 hours, or ever", () => {
    expect(
      assessCollection({ ...healthy, lastSweepStartedAt: new Date(hoursAgo(27)) }, NOW).problems,
    ).toEqual([expect.stringMatching(/No tender sweep has started/)]);
    expect(assessCollection({ ...healthy, lastSweepStartedAt: null }, NOW).healthy).toBe(false);
  });

  it("names a run left running by a collector that died", () => {
    const a = assessCollection(
      { ...healthy, stuck: [{ sourceId: "gepnic-kerala", startedAt: new Date(hoursAgo(5)) }] },
      NOW,
    );
    expect(a.problems.join()).toMatch(/`gepnic-kerala` has been `running`/);
  });
});
