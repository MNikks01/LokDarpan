import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { extractFacts } from "./facts";

/**
 * Builds the extraction regression corpus from decisions a person has made.
 *
 * Every case is a real page of a real audit report, with the outcome a reviewer
 * recorded and the reason they gave. Nothing here is invented, which is the
 * point: a corpus written from imagination tests the shapes its author thought
 * of, and the readings that reached this ledger wrongly were all shapes nobody
 * had thought of.
 *
 * **A case must be self-contained.** Some of the parser's judgements are
 * page-scoped — whether a caption declares a scale, whether the font mapping
 * dropped the rupee glyph — so a fact whose evidence window cannot reproduce its
 * own reading is not a test case; it is a page. Those are counted and excluded
 * rather than propped up with synthetic context, which would test the prop.
 *
 * Only monetary facts are taken. Contractor and officer readings are never
 * published (ADR-033), and a fixture is a poor place to keep a name.
 */

const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/corpus/extraction-corpus.json",
);

/**
 * What the reviewer's note says the reading was.
 *
 * Classified from the note rather than guessed from the text: the note is the
 * reason a person gave at the time, and it is the only record of why a
 * well-formed figure was withheld.
 */
const CLASSES: readonly { readonly name: string; readonly match: RegExp }[] = [
  { name: "unreadable-evidence", match: /evidence stored for this fact is unreadable/iu },
  { name: "scale-outside-bracket", match: /scale word (?:sits )?outside/iu },
  { name: "worked-example", match: /worked example|formula/iu },
  { name: "fragment", match: /fragment of a figure|no amount could be established/iu },
  {
    name: "rate",
    match:
      /per-unit rate|a rate, not an amount|rate rather than an amount|per-meal cost|\ba rate\b/iu,
  },
  { name: "criterion", match: /criterion|threshold in a rule|policy ceiling|retention limit/iu },
  {
    name: "product-does-not-reconcile",
    match: /does not equal its own printed multiplicand|two halves state different totals/iu,
  },
  // Four candidates the broken sentence splitter produced twice, differing from
  // an already-decided row only by a trailing full stop. Named because it is a
  // defect this repository caused and would not otherwise recognise again.
  { name: "duplicate-residue", match: /residue of a bad extraction run/iu },
  { name: "not-a-figure", match: /not a monetary figure at all|serial number|series code/iu },
];

/** How many of each class to keep. Enough to pin the shape, few enough to read. */
const PER_CLASS = 24;
const SOUND_PER_SCRIPT = 30;

interface Case {
  readonly documentId: number;
  readonly pageNumber: number;
  readonly script: string;
  readonly evidence: string;
  readonly class: string;
  /** What the parser must produce for this figure — `null` means it must refuse. */
  readonly parserValue: string | null;
  /** Whether the figure reached a reader. `false` where only a person stopped it. */
  readonly published: boolean;
  readonly reason: string;
}

interface Row {
  id: string;
  document_id: string;
  page_number: number;
  script: string;
  raw_text: string;
  normalised_value: string | null;
  corrected_value: string | null;
  verification_status: string;
  reviewer_note: string | null;
}

/** Whether the parser reproduces this reading from the evidence window alone. */
function reproduces(row: Row): boolean {
  const produced = extractFacts([{ pageNumber: 1, content: row.raw_text }])
    .filter((f) => f.kind === "monetary_amount")
    .map((f) => f.normalisedValue);
  return produced.includes(row.normalised_value);
}

function classify(row: Row): string {
  if (row.verification_status !== "rejected") return "sound";
  const note = row.reviewer_note ?? "";
  return CLASSES.find((c) => c.match.test(note))?.name ?? "withheld-other";
}

function toCase(row: Row, className: string): Case {
  return {
    documentId: Number(row.document_id),
    pageNumber: row.page_number,
    script: row.script,
    evidence: row.raw_text,
    class: className,
    parserValue: row.normalised_value,
    published: row.verification_status !== "rejected",
    reason: (row.reviewer_note ?? "").replace(/\s+/gu, " ").slice(0, 240),
  };
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL_READONLY"] ?? process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }

  const db = new pg.Client({ connectionString });
  await db.connect();

  try {
    // Ordered by a hash of the fact's identity rather than at random, so
    // regenerating picks the same cases and a change in the file is a change in
    // the corpus rather than a reshuffle.
    const rows = (
      await db.query<Row>(
        `SELECT f.id, f.document_id, f.page_number, p.script, f.raw_text,
                f.normalised_value, f.corrected_value, f.verification_status, f.reviewer_note
           FROM document_fact f
           JOIN document_page p
             ON p.document_id = f.document_id AND p.page_number = f.page_number
          WHERE f.kind = 'monetary_amount'
            AND f.verification_status <> 'unverified'
          ORDER BY md5(f.id::text)`,
      )
    ).rows;

    const kept = new Map<string, Case[]>();
    let excluded = 0;

    for (const row of rows) {
      if (!reproduces(row)) {
        excluded += 1;
        continue;
      }
      const className = classify(row);
      const key = className === "sound" ? `sound:${row.script}` : className;
      const bucket = kept.get(key) ?? [];
      const cap = className === "sound" ? SOUND_PER_SCRIPT : PER_CLASS;
      if (bucket.length >= cap) continue;
      bucket.push(toCase(row, className));
      kept.set(key, bucket);
    }

    const cases = [...kept.values()]
      .flat()
      .sort((a, b) =>
        a.class === b.class
          ? a.documentId - b.documentId || a.pageNumber - b.pageNumber
          : a.class.localeCompare(b.class),
      );

    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(
      OUT,
      `${JSON.stringify({ generatedFrom: `${String(rows.length)} decided monetary facts`, excludedAsNotSelfContained: excluded, cases }, null, 2)}\n`,
      "utf8",
    );

    const byClass = new Map<string, number>();
    for (const c of cases) byClass.set(c.class, (byClass.get(c.class) ?? 0) + 1);
    process.stdout.write(
      `${String(cases.length)} cases from ${String(rows.length)} decisions ` +
        `(${String(excluded)} excluded as not self-contained)\n` +
        [...byClass]
          .sort()
          .map(([k, n]) => `  ${k.padEnd(28)} ${String(n)}`)
          .join("\n") +
        `\nwritten to ${OUT}\n`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
