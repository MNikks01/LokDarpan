import { describe, expect, it } from "vitest";
import { BUDGETS, budgetsFor, judge, summarise } from "./budgets";

describe("performance budgets", () => {
  it("keep every ceiling above its target", () => {
    for (const budget of BUDGETS) {
      if (budget.ceiling !== null) expect(budget.ceiling, budget.id).toBeGreaterThan(budget.target);
    }
  });

  it("gate CI only on what a build determines", () => {
    // Runtime numbers vary with the machine; a flaky gate gets switched off.
    for (const budget of BUDGETS.filter((b) => b.gate === "ci")) expect(budget.unit).toBe("bytes");
  });

  it("carries the documented 400 KB target and 600 KB ceiling for the map page", () => {
    const [initialJs] = budgetsFor("explore.initial-js", null);
    expect(initialJs).toMatchObject({
      target: 400 * 1024,
      ceiling: 600 * 1024,
      basis: "documented",
    });
  });

  it("finds a profile's own budget and the ones for every profile", () => {
    expect(budgetsFor("map.load.cold", "mobile").map((b) => b.target)).toEqual([5000]);
    expect(budgetsFor("map.first-boundaries", "desktop")).toHaveLength(1);
  });

  it("judges against the target, then the ceiling", () => {
    const budget = BUDGETS.find((b) => b.ceiling !== null);
    if (budget === undefined) throw new Error("no budget with a ceiling");
    expect(judge(budget, budget.target)).toBe("within");
    expect(judge(budget, budget.target + 1)).toBe("over-target");
    expect(judge(budget, (budget.ceiling ?? 0) + 1)).toBe("over-ceiling");
  });

  it("summarises by nearest rank, discarding nothing", () => {
    expect(summarise([5, 1, 4, 2, 3])).toEqual({ n: 5, median: 3, p75: 4 });
    expect(summarise([10])).toEqual({ n: 1, median: 10, p75: 10 });
    expect(summarise([]).n).toBe(0);
  });
});
