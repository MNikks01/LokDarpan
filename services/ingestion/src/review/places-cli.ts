import { stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";

import pg from "pg";

import { assertReviewer, recordDecision, ReviewError } from "./decide";
import { groupByPlace, placeDecisionNote, type PlaceGroup } from "./places";
import { pendingReview } from "./queue";

/**
 * Review place names one place at a time (ADR-077).
 *
 *   REVIEWER='Jane Doe' pnpm --filter @lokdarpan/ingestion review:places -- --state=27
 *
 * For each place: its pages and reports, and one sentence from every report
 * that names it. [v] confirms every page of it, [r] rejects every page, [o]
 * prints the command to go through its pages one at a time, [enter] skips.
 *
 * Connects as DATABASE_URL_REVIEWER, as `review` does, and records each page's
 * decision through the same function, so the reviewer role's column grant and
 * the history trigger apply exactly as they do to figures.
 */

const EXIT_USAGE = 64;
const EXIT_MISCONFIGURED = 78;
const PROMPT =
  "[v] confirm all pages   [r] reject all   [o] one by one   [enter] skip   [q] quit  ";

function say(line: string): void {
  stdout.write(`${line}\n`);
}

async function ask(rl: Interface, prompt: string): Promise<string | null> {
  try {
    return (await rl.question(prompt)).trim().toLowerCase();
  } catch {
    return null;
  }
}

function present(group: PlaceGroup, index: number, total: number): string {
  const lines = [
    `\n${String(index)} of ${String(total)}  ${group.value}  -  ${String(group.pages)} page${group.pages === 1 ? "" : "s"} in ${String(group.examples.length)} report${group.examples.length === 1 ? "" : "s"}`,
  ];
  for (const e of group.examples) {
    lines.push(`\n  ${e.documentTitle}, page ${String(e.pageNumber)}`, `    ${e.rawText}`);
  }
  return lines.join("\n");
}

async function decideAll(
  client: pg.Client,
  group: PlaceGroup,
  decision: "verified" | "rejected",
  reviewer: string,
): Promise<number> {
  const note = placeDecisionNote(group);
  let recorded = 0;
  for (const factId of group.factIds) {
    if (await recordDecision(client, { factId, decision, reviewer, note })) recorded += 1;
  }
  return recorded;
}

function config(): { connectionString: string; reviewer: string; state: string } {
  const connectionString = process.env["DATABASE_URL_REVIEWER"] ?? "";
  if (connectionString === "") {
    process.stderr.write(
      "DATABASE_URL_REVIEWER is not set. Review connects as the reviewer role.\n",
    );
    process.exit(EXIT_MISCONFIGURED);
  }
  const reviewer = process.env["REVIEWER"] ?? "";
  try {
    assertReviewer(reviewer);
  } catch (error) {
    process.stderr.write(`${error instanceof ReviewError ? error.message : String(error)}\n`);
    process.exit(EXIT_MISCONFIGURED);
  }
  const state = process.argv.find((a) => a.startsWith("--state="))?.slice("--state=".length);
  if (state === undefined || state === "") {
    process.stderr.write("--state=<LGD code> is required, for example --state=27.\n");
    process.exit(EXIT_USAGE);
  }
  return { connectionString, reviewer, state };
}

async function main(): Promise<void> {
  const { connectionString, reviewer, state } = config();
  const client = new pg.Client({ connectionString });
  await client.connect();
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const candidates = await pendingReview(client, {
      kind: "place_reference",
      stateLgdCode: state,
      limit: 100_000,
    });
    const groups = groupByPlace(
      candidates.map((c) => ({
        id: c.id,
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        pageNumber: c.pageNumber,
        rawText: c.rawText,
        value: c.normalisedValue ?? "",
      })),
    );
    say(`${String(candidates.length)} pages name ${String(groups.length)} places awaiting review.`);

    let decided = 0;
    for (const [i, group] of groups.entries()) {
      say(present(group, i + 1, groups.length));
      const answer = await ask(rl, `\n  ${PROMPT}`);
      if (answer === null || answer === "q") break;
      if (answer === "v" || answer === "r") {
        const n = await decideAll(
          client,
          group,
          answer === "v" ? "verified" : "rejected",
          reviewer,
        );
        decided += n;
        say(
          `  ${answer === "v" ? "confirmed" : "rejected"} on ${String(n)} page${n === 1 ? "" : "s"}`,
        );
      } else if (answer === "o") {
        say(
          `  To go through its pages one at a time:\n` +
            `  pnpm --filter @lokdarpan/ingestion review -- --ids=${group.factIds.join(",")}`,
        );
      }
    }
    say(`\n${String(decided)} page decisions recorded this session.`);
  } finally {
    rl.close();
    await client.end();
  }
}

void main();
