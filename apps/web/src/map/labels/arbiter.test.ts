import { describe, expect, it } from "vitest";

import {
  COOLDOWN_MS,
  LabelArbiter,
  MIN_VISIBLE_MS,
  compareKeys,
  priorityKey,
  type PriorityInput,
  type ScreenLabel,
} from "./arbiter";

const VIEW = { width: 800, height: 600 };

function label(id: string, x: number, y: number, pinned = false): ScreenLabel {
  return { id, x, y, width: 80, height: 16, pinned };
}

function place(input: Partial<PriorityInput> & { id: string }): PriorityInput {
  return { level: "district", size: 1e9, selected: false, focused: false, ...input };
}

function order(inputs: readonly PriorityInput[]): string[] {
  return [...inputs].sort((a, b) => compareKeys(priorityKey(a), priorityKey(b))).map((p) => p.id);
}

describe("priorityKey", () => {
  it("puts the reader's selection first, then focus", () => {
    expect(
      order([
        place({ id: "plain" }),
        place({ id: "focused", focused: true }),
        place({ id: "selected", selected: true, size: 1 }),
      ]),
    ).toEqual(["selected", "focused", "plain"]);
  });

  it("ranks coarser levels above finer ones, whatever their size", () => {
    expect(
      order([
        place({ id: "v", level: "village", size: 1e12 }),
        place({ id: "d", level: "district", size: 1 }),
        place({ id: "t", level: "sub_district", size: 5e8 }),
      ]),
    ).toEqual(["d", "t", "v"]);
  });

  it("puts a municipal body level with a taluka, so size decides between them", () => {
    const taluka = place({ id: "taluka", level: "sub_district", size: 4e8 });
    const body = place({ id: "body", level: "urban_local_body", size: 4e8 });
    expect(priorityKey(taluka)[2]).toBe(priorityKey(body)[2]);
    expect(order([taluka, place({ ...body, size: 9e8 })])).toEqual(["body", "taluka"]);
    expect(order([place({ ...taluka, size: 9e8 }), body])).toEqual(["taluka", "body"]);
  });

  it("lets larger places win, but treats near-equal sizes as a tie broken by id", () => {
    expect(order([place({ id: "small", size: 1e6 }), place({ id: "large", size: 1e9 })])).toEqual([
      "large",
      "small",
    ]);
    // 1.10e9 and 1.12e9 share a power-of-two bucket: the id decides, not a rounding difference.
    expect(order([place({ id: "b", size: 1.12e9 }), place({ id: "a", size: 1.1e9 })])).toEqual([
      "a",
      "b",
    ]);
  });

  // The neutrality guarantee, stated as a test: nothing about a place's records
  // can change which name is drawn, because nothing else is read.
  it("ignores every property it was not built from", () => {
    const bare = place({ id: "x" });
    const withRecords = { ...bare, tenderCount: 900, auditFindings: 12, spendInr: "1000000" };
    expect(priorityKey(withRecords)).toEqual(priorityKey(bare));
  });
});

describe("LabelArbiter", () => {
  it("gives an overlap to the label earlier in priority order", () => {
    const arbiter = new LabelArbiter();
    const placement = arbiter.solve([label("first", 100, 100), label("second", 110, 100)], VIEW, 0);
    expect([...placement.visible]).toEqual(["first"]);
  });

  it("draws labels that do not touch, and nothing off screen", () => {
    const arbiter = new LabelArbiter();
    const placement = arbiter.solve(
      [label("a", 100, 100), label("b", 400, 300), label("off", -500, 300)],
      VIEW,
      0,
    );
    expect(placement.visible).toEqual(new Set(["a", "b"]));
  });

  it("always draws a pinned label, even over a stronger one", () => {
    const arbiter = new LabelArbiter();
    const placement = arbiter.solve(
      [label("strong", 100, 100), label("chosen", 105, 100, true)],
      VIEW,
      0,
    );
    expect(placement.visible.has("chosen")).toBe(true);
  });

  it("decides the same way every time for the same input", () => {
    const labels = Array.from({ length: 60 }, (_, i) =>
      label(`u${String(i)}`, (i * 37) % 800, (i * 53) % 600),
    );
    const a = new LabelArbiter().solve(labels, VIEW, 0);
    const b = new LabelArbiter().solve(labels, VIEW, 0);
    expect([...a.visible]).toEqual([...b.visible]);
  });

  it("keeps a just-shown name in place briefly when a stronger one arrives", () => {
    const arbiter = new LabelArbiter();
    arbiter.solve([label("weak", 100, 100)], VIEW, 0);

    // A stronger name now overlaps it. Within the window, the weak one holds.
    const soon = arbiter.solve([label("strong", 105, 100), label("weak", 100, 100)], VIEW, 100);
    expect(soon.visible.has("weak")).toBe(true);

    // Once the window has passed, priority decides again.
    const later = arbiter.solve(
      [label("strong", 105, 100), label("weak", 100, 100)],
      VIEW,
      MIN_VISIBLE_MS + 100,
    );
    expect(later.visible.has("strong")).toBe(true);
    expect(later.visible.has("weak")).toBe(false);
    expect(later.hidden).toEqual(["weak"]);
  });

  it("makes a hidden name wait before it returns, so an edge does not flicker", () => {
    const arbiter = new LabelArbiter();
    arbiter.solve([label("a", 100, 100)], VIEW, 0);
    arbiter.solve([label("a", -500, 100)], VIEW, 10_000); // panned off: hidden at 10 s

    const tooSoon = arbiter.solve([label("a", 100, 100)], VIEW, 10_000 + COOLDOWN_MS / 2);
    expect(tooSoon.visible.has("a")).toBe(false);

    const afterwards = arbiter.solve([label("a", 100, 100)], VIEW, 10_000 + COOLDOWN_MS + 1);
    expect(afterwards.visible.has("a")).toBe(true);
    expect(afterwards.shown).toEqual(["a"]);
  });

  it("reports only changes, so the renderer writes only what changed", () => {
    const arbiter = new LabelArbiter();
    const first = arbiter.solve([label("a", 100, 100), label("b", 400, 300)], VIEW, 0);
    expect(first.shown).toEqual(["a", "b"]);
    const again = arbiter.solve([label("a", 101, 100), label("b", 401, 300)], VIEW, 16);
    expect(again.shown).toEqual([]);
    expect(again.hidden).toEqual([]);
  });

  it("forgets a label that is no longer offered", () => {
    const arbiter = new LabelArbiter();
    arbiter.solve([label("a", 100, 100)], VIEW, 0);
    arbiter.solve([label("b", 400, 300)], VIEW, 50);
    // "a" returns as a new label, not as one cooling down.
    const back = arbiter.solve([label("a", 100, 100)], VIEW, 60);
    expect(back.visible.has("a")).toBe(true);
  });

  it("places a village-scale label set without comparing every pair", () => {
    // 2,000 densely packed labels: the solve must stay well inside a frame budget.
    const labels = Array.from({ length: 2000 }, (_, i) =>
      label(`v${String(i)}`, (i % 50) * 16, Math.floor(i / 50) * 15),
    );
    const arbiter = new LabelArbiter();
    const started = performance.now();
    arbiter.solve(labels, VIEW, 0);
    expect(performance.now() - started).toBeLessThan(100);
  });
});
