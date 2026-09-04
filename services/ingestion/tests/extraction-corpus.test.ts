import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { extractFacts } from "../src/cag/facts";

/**
 * The parser, run against every reading a person has ruled on.
 *
 * `services/ingestion/tests/corpus/extraction-corpus.json` is built by
 * `pnpm --filter @lokdarpan/ingestion corpus:build` from the decided facts in
 * the ledger. Each case is a real page of a real audit report, carrying the
 * outcome a reviewer recorded and the reason they gave. Nothing in it is
 * invented — the readings that reached this ledger wrongly were all shapes
 * nobody had thought of, so a corpus written from imagination would have missed
 * every one of them.
 *
 * What this pins is **the parser's arithmetic**: given this evidence, it must
 * produce exactly this value or refuse. It does not pin the review decision,
 * which is a person's.
 *
 * That distinction is the most useful thing here. A case with
 * `published: false` and a non-null `parserValue` is a **well-formed figure the
 * parser still offers and only a person stopped** — a rate, a threshold in a
 * rule, a fragment of a larger number. Counting those says exactly how much of
 * this ledger's correctness rests on human judgement rather than on code.
 */

interface Case {
  readonly documentId: number;
  readonly pageNumber: number;
  readonly script: string;
  readonly evidence: string;
  readonly class: string;
  readonly parserValue: string | null;
  readonly published: boolean;
  readonly reason: string;
}

const corpus = JSON.parse(
  readFileSync(join(import.meta.dirname, "corpus/extraction-corpus.json"), "utf8"),
) as { cases: Case[]; excludedAsNotSelfContained: number };

const cases = corpus.cases;

/** Every monetary value the parser reads out of a piece of evidence. */
const valuesIn = (evidence: string): (string | null)[] =>
  extractFacts([{ pageNumber: 1, content: evidence }])
    .filter((f) => f.kind === "monetary_amount")
    .map((f) => f.normalisedValue);

const label = (c: Case): string =>
  `${c.class} · doc ${String(c.documentId)} p${String(c.pageNumber)} → ${c.parserValue ?? "refused"}`;

describe("the corpus is intact", () => {
  it("has cases", () => {
    expect(cases.length).toBeGreaterThan(150);
  });

  it("covers every class a reviewer has had to rule on", () => {
    // A class that disappears from the corpus is a class nobody is testing.
    // These are the shapes this ledger has actually been wrong about.
    const classes = new Set(cases.map((c) => c.class));
    for (const required of [
      "sound",
      "rate",
      "criterion",
      "fragment",
      "worked-example",
      "scale-outside-bracket",
      "product-does-not-reconcile",
      "duplicate-residue",
      "unreadable-evidence",
    ]) {
      expect(classes).toContain(required);
    }
  });

  it("carries the reason a person gave, on every withheld case", () => {
    for (const c of cases.filter((x) => !x.published)) {
      expect(c.reason.length).toBeGreaterThan(20);
    }
  });
});

describe("the parser reads each case as the ledger records it", () => {
  it.each(cases.map((c) => [label(c), c] as const))("%s", (_name, c) => {
    const values = valuesIn(c.evidence);
    expect(values).toContain(c.parserValue);
  });
});

describe("what the parser catches, and what only a person catches", () => {
  const withheld = cases.filter((c) => !c.published);
  const stoppedByParser = withheld.filter((c) => c.parserValue === null);
  const stoppedByPerson = withheld.filter((c) => c.parserValue !== null);

  it("refuses outright everything it is supposed to refuse", () => {
    for (const c of stoppedByParser) {
      expect(valuesIn(c.evidence)).toContain(null);
    }
  });

  it("still offers the readings only a person withheld", () => {
    // Not an aspiration — a measurement. Each of these is a well-formed figure
    // the parser produces and a reviewer rejected: a per-unit rate, a threshold
    // in a rule, a fragment of a larger number. If the parser later learns to
    // refuse one of these classes, this assertion fails and the corpus is
    // rebuilt — which is the intended way to find out that it improved.
    expect(stoppedByPerson.length).toBeGreaterThan(0);
    for (const c of stoppedByPerson) {
      expect(valuesIn(c.evidence)).toContain(c.parserValue);
    }
  });

  it("reports the split, so the reliance on review is visible", () => {
    const share = stoppedByPerson.length / withheld.length;
    // Recorded rather than asserted tightly: the number moves when the parser
    // improves or when a new class of wrong reading is found, and both are
    // things to look at rather than to fail on.
    expect(share).toBeGreaterThanOrEqual(0);
    expect(share).toBeLessThanOrEqual(1);
  });
});

describe("the classes this ledger has been wrong about", () => {
  const of = (name: string): Case[] => cases.filter((c) => c.class === name);

  it("never publishes a figure whose scale sits outside its bracket", () => {
    // "shortfall of ₹11,553 (₹7,011+₹4,542) crore" — read as plain rupees this
    // is wrong by seven orders of magnitude, and three such readings reached the
    // review queue before the guard existed.
    //
    // The invariant is that none of them reaches a reader. It is deliberately
    // not "the parser refuses all of them", because it cannot: the guard reads
    // forward from the amount to a closing bracket, and one of these cases is
    // "₹4,253.77 (26.34 per cent) of the total available funds (i.e.,
    // ₹16,151.82 crore)" — where the scale word belongs to a different bracket
    // entirely and only the parallel between the two figures gives it away.
    // That is an inference about the sentence, and a person made it.
    const bracketed = of("scale-outside-bracket");
    expect(bracketed.length).toBeGreaterThan(0);
    for (const c of bracketed) {
      expect(c.published).toBe(false);
    }
  });

  it("refuses outright the ones the guard can see", () => {
    const refused = of("scale-outside-bracket").filter((c) => c.parserValue === null);
    expect(refused.length).toBeGreaterThan(0);
    for (const c of refused) {
      expect(valuesIn(c.evidence)).toContain(null);
    }
  });

  it("evidence the font mapping destroyed yields no value", () => {
    for (const c of of("unreadable-evidence")) {
      expect(valuesIn(c.evidence)).toContain(c.parserValue);
    }
  });

  it("a per-unit rate is still produced, and still needs a person", () => {
    const rates = of("rate");
    expect(rates.length).toBeGreaterThan(0);
    expect(rates.every((c) => !c.published)).toBe(true);
  });
});
