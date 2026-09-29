import { describe, expect, it } from "vitest";

import { remapFacts } from "../src/cag/promote";

describe("remapFacts", () => {
  const documentIds = new Map([[10, 900]]);

  it("gives every figure its reserved id and its document's new id", () => {
    const { rows } = remapFacts(
      [{ id: 1, document_id: 10, same_figure_as: null, raw_text: "₹ 5 crore" }],
      new Map([[1, 501]]),
      documentIds,
    );
    expect(rows).toEqual([
      { id: 501, document_id: 900, same_figure_as: null, raw_text: "₹ 5 crore" },
    ]);
  });

  // The Hindi and English editions of a report state the same figure, and the
  // link may point at a figure that comes later in the list.
  it("carries a same-figure link to the promoted counterpart, written afterwards", () => {
    const { rows, links, dropped } = remapFacts(
      [
        { id: 1, document_id: 10, same_figure_as: 2 },
        { id: 2, document_id: 10, same_figure_as: null },
      ],
      new Map([
        [1, 501],
        [2, 502],
      ]),
      documentIds,
    );
    expect(rows.every((r) => r["same_figure_as"] === null)).toBe(true);
    expect(links).toEqual([[501, 502]]);
    expect(dropped).toBe(0);
  });

  // Pointing it at whatever holds id 3 in the target would link two unrelated
  // figures and tell a reader they are the same number.
  it("drops and counts a link to a figure outside the run, never guessing a target", () => {
    const { links, dropped } = remapFacts(
      [{ id: 1, document_id: 10, same_figure_as: 3 }],
      new Map([[1, 501]]),
      documentIds,
    );
    expect(links).toEqual([]);
    expect(dropped).toBe(1);
  });

  it("refuses a figure with no id reserved for it", () => {
    expect(() =>
      remapFacts([{ id: 7, document_id: 10, same_figure_as: null }], new Map(), documentIds),
    ).toThrow(/no id reserved/);
  });
});
