/**
 * Rule B: reader-facing sentences are not written inside components (ADR-059).
 *
 * Neutral wording is reviewed in one place, `apps/web/src/copy/`, so a sentence
 * that makes a claim about a government is written where it is reviewed, not
 * wherever it happens to render. This finds prose in JSX: a run of text with at
 * least `MIN_WORDS` words. Labels, headings and button text are shorter and are
 * not counted.
 *
 * The existing prose is a ratchet, not a failure. `copy-baseline.json` records
 * how many sentences each file held when the rule began; a file may hold that
 * many or fewer, never more. The count can only go down.
 */
import ts from "typescript";

/** A sentence, not a label: six words or more of JSX text. */
export const MIN_WORDS = 6;

const SCOPE = ["apps/web/src/components/", "apps/web/src/app/"];
const OUT_OF_SCOPE = /(\.test\.|\/tests?\/|\/copy\/)/;

export interface Sentence {
  readonly line: number;
  readonly text: string;
}

export function sentencesIn(path: string, source: string): readonly Sentence[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Sentence[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      const words = text.split(" ").filter((word) => /[a-z]/i.test(word));
      if (words.length >= MIN_WORDS) {
        const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
        found.push({ line: line + 1, text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

export type Baseline = Readonly<Record<string, number>>;

export interface CopyViolation {
  readonly file: string;
  readonly allowed: number;
  readonly sentences: readonly Sentence[];
}

export interface CopyResult {
  readonly violations: readonly CopyViolation[];
  /** Files now holding fewer sentences than their baseline: lower it. */
  readonly improved: readonly {
    readonly file: string;
    readonly allowed: number;
    readonly now: number;
  }[];
  /** The counts as they stand, to write as the new baseline. */
  readonly counts: Baseline;
}

export function checkCopy(
  paths: readonly string[],
  read: (path: string) => string,
  baseline: Baseline,
): CopyResult {
  const violations: CopyViolation[] = [];
  const improved: { file: string; allowed: number; now: number }[] = [];
  const counts: Record<string, number> = {};
  for (const file of paths) {
    if (!file.endsWith(".tsx") || OUT_OF_SCOPE.test(file)) continue;
    if (!SCOPE.some((prefix) => file.startsWith(prefix))) continue;
    const sentences = sentencesIn(file, read(file));
    if (sentences.length > 0) counts[file] = sentences.length;
    const allowed = baseline[file] ?? 0;
    if (sentences.length > allowed) violations.push({ file, allowed, sentences });
    else if (sentences.length < allowed) improved.push({ file, allowed, now: sentences.length });
  }
  return { violations, improved, counts };
}
