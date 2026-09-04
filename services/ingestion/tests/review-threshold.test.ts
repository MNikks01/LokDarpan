import { describe, expect, it } from "vitest";

import { thresholdPhrase } from "../src/review/threshold";

const CRORE_100 = "100000000000";
const CRORE_500 = "500000000000";
const RUPEES_1500 = "150000";

describe("thresholdPhrase", () => {
  // The case that started this: a table of contents line whose figure is the
  // cut-off for which grants the chapter covers, not money anyone spent.
  it("names the criterion when the figure bounds a set", () => {
    expect(
      thresholdPhrase("Grants with savings of more than ₹ 100 crore during 2024-25", CRORE_100),
    ).toBe("more than");
  });

  it("reads a criterion stated after the figure", () => {
    expect(thresholdPhrase("schemes of ₹ 500 crore or more were examined", CRORE_500)).toBe(
      "or more",
    );
  });

  // Half the corpus states its criterion in Devanagari, and the text layer
  // mangles the conjunct in अधिक to अचधक. Matching only the correct spelling
  // would find none of these on the pages they actually appear on.
  it("reads a Marathi criterion, including the mangled spelling of अधिक", () => {
    expect(
      thresholdPhrase("मोठ्या प्रमाणात बचत (₹ 100 कोटी पेक्षा अचधक) असलेली अनुदाने", CRORE_100),
    ).toContain("पेक्षा");
    expect(thresholdPhrase("प्रत्येक प्रकरणात ₹ 100 कोटी पेक्षा जास्त होती", CRORE_100)).toContain(
      "पेक्षा",
    );
  });

  // The asymmetry the module is built on. Rejecting a real figure deletes a
  // government statement from the ledger silently; missing one leaves a
  // candidate for a person to read.
  it("leaves a reported amount alone", () => {
    expect(
      thresholdPhrase("the fiscal deficit was ₹ 500 crore in that year", CRORE_500),
    ).toBeNull();
    expect(thresholdPhrase("महसुली तूट ₹ 100 कोटी होती", CRORE_100)).toBeNull();
  });

  // A cap on a real entitlement is not a criterion. "up to ₹1,500 per month"
  // is the scheme's actual rate, and rejecting it would delete a figure the
  // state genuinely published.
  it("does not treat a cap on an entitlement as a criterion", () => {
    expect(
      thresholdPhrase("a benefit of up to ₹ 1,500 per month to eligible women", RUPEES_1500),
    ).toBeNull();
    expect(thresholdPhrase("sanctioned an amount not exceeding ₹ 500 crore", CRORE_500)).toBeNull();
  });

  // The criterion has to govern *this* figure. A threshold sitting beside a
  // different amount in the same window says nothing about this one.
  it("ignores a criterion attached to some other amount in the window", () => {
    expect(
      thresholdPhrase("cases over ₹ 100 crore were listed; the deficit was ₹ 500 crore", CRORE_500),
    ).toBeNull();
  });

  it("says nothing about a candidate with no value to locate", () => {
    expect(thresholdPhrase("savings of more than ₹ 100 crore", null)).toBeNull();
  });

  it("says nothing when the amount is not derivable from the evidence", () => {
    expect(thresholdPhrase("the Department accepted the observation", CRORE_100)).toBeNull();
  });
});

describe("thresholdPhrase across the corpus's actual spellings", () => {
  // Fact #5972 was verified last session and is a criterion: the inflected
  // कोटींपेक्षा joins unit and criterion with an anusvara and no space, so a
  // pattern expecting whitespace between them saw a reported amount.
  it("reads a criterion joined to its unit by a combining mark", () => {
    expect(
      thresholdPhrase("प्रत्येक प्रकरणात ₹ 10 कोटींपेक्षा अधिक) दिला आहे", "10000000000"),
    ).toContain("पेक्षा");
  });
});
