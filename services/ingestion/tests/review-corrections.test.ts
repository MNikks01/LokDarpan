import { describe, expect, it } from "vitest";

import { CorrectionError, prepareCorrections } from "../src/review/corrections";

const entry = {
  id: 6213,
  amount: "145",
  unit: "crore",
  note: "the source misspells crore as core",
};

describe("prepareCorrections", () => {
  // The amount is written the way the page writes it and converted by the
  // parser's own money path, so there is one money conversion to get wrong.
  it("converts an amount stated in its own unit to exact paise", () => {
    expect(prepareCorrections([entry])[0]?.paise).toBe("145000000000");
  });

  it("reads a figure written out in full as rupees", () => {
    const [c] = prepareCorrections([{ ...entry, amount: "1,500", unit: "rupees" }]);
    expect(c?.paise).toBe("150000");
  });

  it("converts a Devanagari unit the same way", () => {
    const [c] = prepareCorrections([{ ...entry, amount: "13,782.36", unit: "कोटी" }]);
    expect(c?.paise).toBe("13782360000000");
  });

  // A correction is a published figure that came from a person rather than the
  // page. It has to be able to say why, or it is an unaccountable claim.
  it("refuses an entry with no reason", () => {
    expect(() => prepareCorrections([{ ...entry, note: "  " }])).toThrow(CorrectionError);
  });

  it("refuses a unit it cannot convert rather than guessing", () => {
    expect(() => prepareCorrections([{ ...entry, unit: "core" }])).toThrow(
      /not an amount this codebase can represent/,
    );
  });

  it("refuses a malformed entry, naming which one", () => {
    expect(() => prepareCorrections([{ ...entry, id: "6213" }])).toThrow(/entry 1/);
    expect(() => prepareCorrections([entry, { ...entry, amount: "" }])).toThrow(/#6213/);
    expect(() => prepareCorrections({})).toThrow(/JSON array/);
  });
});
