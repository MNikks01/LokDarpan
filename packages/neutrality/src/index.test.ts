import { describe, it, expect } from "vitest";
import { scan, isNeutral, asServerText } from "./index";

describe("forbidden terms (docs/15 §Allowed vs forbidden language)", () => {
  it("flags the exact forbidden examples from docs/15", () => {
    const forbidden = [
      "Money was stolen.",
      "This is corruption.",
      "Funds were diverted.",
      "The contractor overcharged.",
      "This official is guilty.",
      "They hid the money.",
      "This contractor stole money.",
    ];
    for (const text of forbidden) {
      expect(isNeutral(text), `should flag: ${text}`).toBe(false);
    }
  });

  it("permits the neutral phrasings docs/15 prescribes", () => {
    const allowed = [
      "Budget mismatch detected.",
      "Data inconsistency found.",
      "Unexplained variance exists.",
      "Utilization percentage differs from the district median.",
      "Budget deviation detected.",
      "Records are missing for this period.",
      "Reported cost per km is 35% above the district median.",
      "Utilized amount is 11.1% below released amount.",
      "Sub-unit allocations sum to 8% more than the parent's recorded allocation.",
    ];
    for (const text of allowed) {
      const found = scan(text);
      expect(found, `should allow: ${text} (got ${JSON.stringify(found)})`).toHaveLength(0);
    }
  });

  it("catches causal constructions built from otherwise-permitted words", () => {
    expect(isNeutral("The gap exists because the contractor delayed work.")).toBe(false);
    expect(isNeutral("Variance arose due to misuse of funds.")).toBe(false);
    expect(isNeutral("This should be investigated.")).toBe(false);
  });

  it("scans Devanagari terms", () => {
    expect(isNeutral("हा भ्रष्टाचार आहे.")).toBe(false);   // Marathi
    expect(isNeutral("यह घोटाला है.")).toBe(false);        // Hindi
    expect(isNeutral("पुणे जिल्ह्यातील खर्च.")).toBe(true); // neutral Marathi
  });

  it("is case-insensitive and reports every occurrence", () => {
    const found = scan("Corruption and corruption and CORRUPTION");
    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  it("suggests the neutral alternative where docs/15 gives one", () => {
    const [first] = scan("The contractor overcharged.");
    expect(first?.kind).toBe("pattern");
    const term = scan("This is corrupt.").find((v) => v.kind === "term");
    expect(term?.suggestion).toBeDefined();
  });
});

describe("ServerText brand", () => {
  it("mints only from the api boundary", () => {
    expect(asServerText("Utilized is 11.1% below released.", "api")).toBe(
      "Utilized is 11.1% below released.",
    );
    // @ts-expect-error — origin is a closed union; only "api" is permitted.
    expect(() => asServerText("x", "component")).toThrow();
  });

  it("a plain string is not assignable to ServerText", () => {
    // Compile-time proof: this must be an error, which is what makes
    // <Observation text="..."> impossible to write with a literal.
    // @ts-expect-error — string is not ServerText
    const _bad: import("./index.js").ServerText = "This contractor overcharged";
    expect(typeof _bad).toBe("string");
  });
});

describe("inflection coverage (regression: 'stole' once slipped through)", () => {
  it("catches irregular and inflected forms of the same offence", () => {
    const forms = [
      "He stole the funds.",
      "They were stealing money.",
      "The amount was embezzled.",
      "Officials colluded on the tender.",
      "The process was rigged.",
      "Funds may have been diverted.",
      "He defrauded the department.",
      "This is nepotism.",
    ];
    for (const text of forms) {
      expect(isNeutral(text), `should flag: ${text}`).toBe(false);
    }
  });

  it("still permits neutral text containing no forbidden stem", () => {
    expect(isNeutral("Released ₹9.00 crore; utilized ₹8.00 crore; deviation 11.1%.")).toBe(true);
  });
});
