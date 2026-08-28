import pg from "pg";

import { selfCheck, triage, type CheckInput } from "./triage";

/**
 * Reports how the money candidates divide, and lists the ones worth a person's
 * attention first. Reads only; decides nothing.
 */
async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL_REVIEWER"] ?? process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL_REVIEWER is not set.\n");
    process.exit(78);
  }

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const result = await db.query<{
      id: string;
      raw_text: string;
      normalised_value: string | null;
    }>(
      `SELECT id, raw_text, normalised_value FROM document_fact
        WHERE kind = 'monetary_amount' AND verification_status = 'unverified'
        ORDER BY id`,
    );
    const inputs: CheckInput[] = result.rows.map((r) => ({
      id: Number(r.id),
      rawText: r.raw_text,
      normalisedValue: r.normalised_value,
    }));

    const counts = triage(inputs);
    process.stdout.write(
      `\n${String(inputs.length)} money candidates awaiting review\n\n` +
        `  ${String(counts.mismatch)}\tmismatch   - the stored value appears nowhere in its own evidence\n` +
        `  ${String(counts.noValue)}\tno value   - the source stated no unit; a person must supply the scale\n` +
        `  ${String(counts.ambiguous)}\tambiguous  - the evidence states several amounts, including this one\n` +
        `  ${String(counts.confirmed)}\tconfirmed  - the evidence states exactly this amount, and only this one\n\n` +
        "Work them in that order. A stored value absent from its own evidence is a\n" +
        "defect; confirming a reading arithmetic already agrees with is where a\n" +
        "reviewer adds least.\n\n",
    );

    for (const checked of inputs
      .map(selfCheck)
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
