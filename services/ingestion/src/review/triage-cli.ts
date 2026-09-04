import pg from "pg";

import { claimedAmountsByPage, pageKeyOf } from "./queue";
import { thresholdPhrase } from "./threshold";
import { contextFor, selfCheck, triage, type Triage, type TriageInput } from "./triage";

/**
 * Reports how the money candidates divide, and lists the ones worth a person's
 * attention first. Reads only; decides nothing.
 *
 * `--document=<id>` scopes the report to one report. A reviewer works through a
 * single audit report in a sitting — it has one publisher, one period and one
 * set of conventions — and a partition spanning every document held answers a
 * question nobody is asking.
 */
/** The partition report, kept out of `main` so the wording can be read at once. */
function report(counts: Triage, total: number, documentId: number | null): string {
  const scope =
    documentId === null ? "across every document held" : `in document ${String(documentId)}`;
  return (
    `\n${String(total)} money candidates awaiting review ${scope}\n\n` +
    `  ${String(counts.mismatch)}\tmismatch   - the stored value appears nowhere in its own evidence\n` +
    `  ${String(counts.noValue)}\tno value   - the source stated no unit; a person must supply the scale\n` +
    `  ${String(counts.ambiguous)}\tambiguous  - the evidence states an amount that no fact claims\n` +
    `  ${String(counts.confirmedInContext)}\tin context - several amounts, and every other one is a fact of its own\n` +
    `  ${String(counts.confirmed)}\tconfirmed  - the evidence states exactly this amount, and only this one\n\n` +
    "Work them in that order. A stored value absent from its own evidence is a\n" +
    "defect; confirming a reading arithmetic already agrees with is where a\n" +
    "reviewer adds least.\n\n"
  );
}

/**
 * The criterion-governed candidates, listed rather than counted.
 *
 * A criterion is a question about what a sentence does with its figure, which
 * the arithmetic partitions say nothing about. Every one of these needs a
 * person to read it — see `.docs/adr/025-a-criterion-is-not-a-fact.md`.
 */
function criterionReport(
  rows: readonly {
    id: string;
    document_id: string;
    page_number: number;
    raw_text: string;
    normalised_value: string | null;
  }[],
): string {
  const governed = rows.filter((r) => thresholdPhrase(r.raw_text, r.normalised_value) !== null);
  if (governed.length === 0) return "";

  const lines = governed
    .slice(0, 20)
    .map(
      (r) =>
        `  #${r.id} d${r.document_id} p${String(r.page_number)} governed by ` +
        `"${thresholdPhrase(r.raw_text, r.normalised_value) ?? ""}"`,
    );
  return (
    `${String(governed.length)} of these state a criterion rather than a reported amount.\n` +
    "A cut-off an auditor chose is not money anyone spent, and verifying one\n" +
    "puts a figure in the ledger that no government body reported.\n\n" +
    `${lines.join("\n")}\n\n`
  );
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL_REVIEWER"] ?? process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL_REVIEWER is not set.\n");
    process.exit(78);
  }

  const documentArg = process.argv.find((a) => a.startsWith("--document="))?.split("=")[1];
  const documentId = documentArg === undefined ? null : Number(documentArg);
  if (documentId !== null && !Number.isInteger(documentId)) {
    process.stderr.write("--document must be a document id.\n");
    process.exit(64);
  }

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const result = await db.query<{
      id: string;
      document_id: string;
      page_number: number;
      raw_text: string;
      normalised_value: string | null;
    }>(
      `SELECT id, document_id, page_number, raw_text, normalised_value FROM document_fact
        WHERE kind = 'monetary_amount' AND verification_status = 'unverified'
          AND ($1::bigint IS NULL OR document_id = $1)
        ORDER BY id`,
      [documentId],
    );
    const inputs: TriageInput[] = result.rows.map((r) => ({
      id: Number(r.id),
      rawText: r.raw_text,
      normalisedValue: r.normalised_value,
      pageKey: pageKeyOf(Number(r.document_id), r.page_number),
    }));

    // Every claim on every page these candidates sit on, decided or not, so
    // window overlap can be told apart from a real choice between readings.
    const claimed = await claimedAmountsByPage(db, documentId === null ? {} : { documentId });
    process.stdout.write(report(triage(inputs, claimed), inputs.length, documentId));

    process.stdout.write(criterionReport(result.rows));

    for (const checked of inputs
      .map((input) => selfCheck(input, contextFor(input, claimed)))
      .filter((c) => c.check === "mismatch")
      .slice(0, 10)) {
      const row = result.rows.find((r) => Number(r.id) === checked.id);
      process.stdout.write(
        `  #${String(checked.id)} stored ${row?.normalised_value ?? "null"}, ` +
          `evidence derives [${checked.amountsInEvidence.join(", ")}]\n`,
      );
    }
  } finally {
    await db.end();
  }
}

await main();
