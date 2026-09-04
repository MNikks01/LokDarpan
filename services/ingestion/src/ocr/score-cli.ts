import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AMOUNT_IN, amountToPaise, extractFacts } from "../cag/facts";

/**
 * Scores OCR readings against the text layer of the same page.
 *
 * The headline number is not character accuracy. For this project a **false
 * numerical extraction is worse than an omission**: a figure the extractor
 * invents from a misread digit arrives with a page citation and a source link
 * attached, and looks exactly like a figure that is correct. A figure that was
 * missed shows up as a gap, which a person can see.
 *
 * So the measure that matters is what the real parser does with the OCR text,
 * compared with what the same parser does with the text the file itself states.
 * `extractFacts` here is the production extractor, not a reimplementation of
 * it — a scorer that models the parser would be scoring the model.
 *
 * Two caveats are reported rather than hidden:
 *
 * - Not every text layer can serve as truth. On some pages the layer itself
 *   substitutes a backtick for ₹ and mangles कोटी, so the parser reads nothing
 *   from it while the engine reads the figure correctly — scoring those pages
 *   would count a right answer as a wrong one. They are excluded and counted,
 *   because "the ground truth was wrong" is a result, not an inconvenience.
 * - Ground truth is the PDF text layer, which is exact but *digitally born*.
 *   A page an engine can read cleanly here may still be a page it would
 *   struggle with as a scan, so these numbers are an upper bound.
 * - Reading order differs between a text layer and an engine's line grouping,
 *   so character error rate is inflated by layout alone. The token and figure
 *   measures are order-insensitive and are the ones to read.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/benchmarks");

interface Reading {
  readonly documentId: number;
  readonly pageNumber: number;
  readonly script?: string;
  readonly engine: string;
  readonly engineVersion?: string;
  readonly seconds?: number;
  readonly content?: string;
  readonly expectedText?: string | null;
  readonly refusal?: string;
  readonly confidences?: number[];
}

/**
 * Whether a page's text layer can stand as truth.
 *
 * A layer that writes a backtick where the document prints ₹, or `कोट(` where
 * it prints कोटी, is mojibake the `glyph_substitution` ratio does not catch —
 * that ratio looks for Latin letters wedged into Devanagari, and a backtick
 * before a digit is neither. Six of the ten figures that first looked like OCR
 * errors were the engine reading a figure the broken layer had lost.
 */
const layerIsBroken = (text: string): boolean =>
  /[`´'"]\s?\d[\d,]*\.\d/u.test(text) || /कोट[^ीि]/u.test(text);

/** Multiset comparison: how much of `truth` is in `found`, and vice versa. */
function overlap(truth: string[], found: string[]): { recall: number; precision: number } {
  const remaining = new Map<string, number>();
  for (const token of truth) remaining.set(token, (remaining.get(token) ?? 0) + 1);

  let matched = 0;
  for (const token of found) {
    const left = remaining.get(token) ?? 0;
    if (left > 0) {
      matched += 1;
      remaining.set(token, left - 1);
    }
  }
  return {
    recall: truth.length === 0 ? 1 : matched / truth.length,
    precision: found.length === 0 ? 1 : matched / found.length,
  };
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.,]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter((t) => t !== "");

/** Digit groups as written, commas kept: "1,53,427" is one token, not three. */
const numerals = (text: string): string[] => text.match(/\d[\d,]*(?:\.\d+)?/gu) ?? [];

/** Every amount the production parser reads out of a page, in paise. */
function figures(text: string): string[] {
  const out: string[] = [];
  for (const fact of extractFacts([{ pageNumber: 1, content: text }])) {
    if (fact.kind !== "monetary_amount") continue;
    const value = fact.normalisedValue;
    if (value !== null) out.push(value);
  }
  return out;
}

/** Amounts stated with a scale word, which are the ones that carry magnitude. */
function scaledFigures(text: string): string[] {
  const out: string[] = [];
  AMOUNT_IN.lastIndex = 0;
  for (const m of text.matchAll(AMOUNT_IN)) {
    if (m[2] === undefined) continue;
    const paise = amountToPaise(m[1] ?? "", m[2]);
    if (paise !== null) out.push(paise.toString());
  }
  return out;
}

interface Tally {
  pages: number;
  seconds: number;
  wordRecall: number;
  wordPrecision: number;
  numeralRecall: number;
  numeralPrecision: number;
  figureTruth: number;
  figureFound: number;
  figureMatched: number;
  scaledTruth: number;
  scaledFound: number;
  scaledMatched: number;
  confidence: number;
  confidenceCount: number;
}

const emptyTally = (): Tally => ({
  pages: 0,
  seconds: 0,
  wordRecall: 0,
  wordPrecision: 0,
  numeralRecall: 0,
  numeralPrecision: 0,
  figureTruth: 0,
  figureFound: 0,
  figureMatched: 0,
  scaledTruth: 0,
  scaledFound: 0,
  scaledMatched: 0,
  confidence: 0,
  confidenceCount: 0,
});

function countMatched(truth: string[], found: string[]): number {
  const remaining = new Map<string, number>();
  for (const v of truth) remaining.set(v, (remaining.get(v) ?? 0) + 1);
  let matched = 0;
  for (const v of found) {
    const left = remaining.get(v) ?? 0;
    if (left > 0) {
      matched += 1;
      remaining.set(v, left - 1);
    }
  }
  return matched;
}

/** Folds one reading's measurements into a running tally. */
function accumulate(tally: Tally, reading: Reading, expected: string, content: string): void {
  const w = overlap(words(expected), words(content));
  const n = overlap(numerals(expected), numerals(content));
  const truthFigures = figures(expected);
  const foundFigures = figures(content);
  const truthScaled = scaledFigures(expected);
  const foundScaled = scaledFigures(content);

  tally.pages += 1;
  tally.seconds += reading.seconds ?? 0;
  tally.wordRecall += w.recall;
  tally.wordPrecision += w.precision;
  tally.numeralRecall += n.recall;
  tally.numeralPrecision += n.precision;
  tally.figureTruth += truthFigures.length;
  tally.figureFound += foundFigures.length;
  tally.figureMatched += countMatched(truthFigures, foundFigures);
  tally.scaledTruth += truthScaled.length;
  tally.scaledFound += foundScaled.length;
  tally.scaledMatched += countMatched(truthScaled, foundScaled);
  for (const c of reading.confidences ?? []) {
    tally.confidence += c;
    tally.confidenceCount += 1;
  }
}

function score(readings: Reading[]): { tallies: Map<string, Tally>; untrusted: number } {
  const tallies = new Map<string, Tally>();
  let untrusted = 0;

  for (const reading of readings) {
    const expected = reading.expectedText;
    if (reading.refusal !== undefined || reading.content === undefined) continue;
    if (expected === undefined || expected === null) continue;
    if (layerIsBroken(expected)) {
      untrusted += 1;
      continue;
    }

    for (const key of [reading.engine, `${reading.engine} · ${reading.script ?? "?"}`]) {
      const tally = tallies.get(key) ?? emptyTally();
      accumulate(tally, reading, expected, reading.content);
      tallies.set(key, tally);
    }
  }
  return { tallies, untrusted };
}

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

function main(): void {
  const files = readdirSync(ROOT).filter((f) => f.startsWith("readings-") && f.endsWith(".jsonl"));
  const readings: Reading[] = [];
  for (const file of files) {
    for (const line of readFileSync(join(ROOT, file), "utf8").split("\n")) {
      if (line.trim() === "") continue;
      readings.push(JSON.parse(line) as Reading);
    }
  }

  const refusals = readings.filter((r) => r.refusal !== undefined);
  const { tallies: scored, untrusted } = score(readings);

  process.stdout.write(
    `readings: ${String(readings.length - refusals.length)}   refusals: ${String(refusals.length)}\n` +
      `files:    ${files.join(", ")}\n` +
      `pages excluded because the text layer is itself broken: ${String(untrusted)}\n\n`,
  );

  const rows = [...scored].sort(([a], [b]) => a.localeCompare(b));
  process.stdout.write(
    "engine · script".padEnd(28) +
      ["pages", "s/page", "word R", "word P", "num R", "num P"].map((h) => h.padStart(8)).join("") +
      "\n",
  );
  for (const [key, t] of rows) {
    process.stdout.write(
      key.padEnd(28) +
        [
          String(t.pages),
          (t.seconds / t.pages).toFixed(1),
          pct(t.wordRecall / t.pages),
          pct(t.wordPrecision / t.pages),
          pct(t.numeralRecall / t.pages),
          pct(t.numeralPrecision / t.pages),
        ]
          .map((v) => v.padStart(8))
          .join("") +
        "\n",
    );
  }

  process.stdout.write(
    "\nWhat the production parser does with the text — the measure that matters.\n" +
      "A figure found in OCR text that is not in the page is a FALSE FIGURE: it would\n" +
      "reach a reader with a citation attached, looking exactly like a correct one.\n\n" +
      "engine · script".padEnd(28) +
      ["truth", "found", "right", "wrong", "recall", "prec"].map((h) => h.padStart(8)).join("") +
      "\n",
  );
  for (const [key, t] of rows) {
    const wrong = t.figureFound - t.figureMatched;
    process.stdout.write(
      key.padEnd(28) +
        [
          String(t.figureTruth),
          String(t.figureFound),
          String(t.figureMatched),
          String(wrong),
          t.figureTruth === 0 ? "—" : pct(t.figureMatched / t.figureTruth),
          t.figureFound === 0 ? "—" : pct(t.figureMatched / t.figureFound),
        ]
          .map((v) => v.padStart(8))
          .join("") +
        "\n",
    );
  }

  process.stdout.write(
    "\nAmounts stated with a scale word (crore, lakh, कोटी) — the ones that carry\n" +
      "magnitude, and where an error is an error of orders.\n\n" +
      "engine · script".padEnd(28) +
      ["truth", "found", "right", "wrong", "recall", "prec"].map((h) => h.padStart(8)).join("") +
      "\n",
  );
  for (const [key, t] of rows) {
    process.stdout.write(
      key.padEnd(28) +
        [
          String(t.scaledTruth),
          String(t.scaledFound),
          String(t.scaledMatched),
          String(t.scaledFound - t.scaledMatched),
          t.scaledTruth === 0 ? "—" : pct(t.scaledMatched / t.scaledTruth),
          t.scaledFound === 0 ? "—" : pct(t.scaledMatched / t.scaledFound),
        ]
          .map((v) => v.padStart(8))
          .join("") +
        "\n",
    );
  }
}

main();
