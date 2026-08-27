import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import pg from "pg";

import type { FactKind } from "../cag/facts";
import {
  ReviewError,
  assertReviewer,
  decisionForKey,
  recordDecision,
  type Decision,
} from "./decide";
import { PROMPT, presentCandidate, type ReviewCandidate } from "./present";
import { pendingReview, reviewProgress, type ReviewProgress } from "./queue";

/**
 * The review terminal.
 *
 * Deliberately a local command and not a web page. Publishing a claim about a
 * named company is the most consequential write this system performs, no
 * authentication layer exists yet, and a write endpoint on a public deployment
 * would let anyone perform it. A CLI cannot be deployed by accident.
 * See `.docs/adr/021-review-is-a-local-tool.md`.
 *
 * It connects as DATABASE_URL_REVIEWER rather than the owner on purpose. The
 * column-scoped grant in migration 0008 is only a real constraint if the tool
 * runs under it; connecting as the owner would leave the protection in the
 * schema and absent from practice.
 */

const EXIT_MISCONFIGURED = 78;
const EXIT_NO_REVIEWER = 2;

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

function summarise(p: ReviewProgress): string {
  return (
    `${String(p.unverified)} awaiting review - ${String(p.verified)} verified, ` +
    `${String(p.corrected)} corrected, ${String(p.rejected)} rejected.`
  );
}

/**
 * One candidate. Returns whether a decision was recorded, or `"quit"`.
 *
 * Anything unrecognised is a skip: a mistyped key must never become a decision,
 * and the candidate is simply offered again on the next run.
 */
/**
 * Asks, treating a closed input as a decision to stop.
 *
 * Ctrl-D, or a piped input that runs out, closes readline; asking again throws
 * ERR_USE_AFTER_CLOSE. Ending the session is the right reading of "no more
 * input" anyway - the alternative is a crash in the middle of a review, which
 * loses the reviewer's place in a 1,825-item queue.
 */
async function ask(rl: Interface, prompt: string): Promise<string | null> {
  try {
    return (await rl.question(prompt)).trim();
  } catch {
    return null;
  }
}

async function reviewOne(
  client: pg.Client,
  rl: Interface,
  candidate: ReviewCandidate,
  reviewer: string,
): Promise<"quit" | "skipped" | "decided"> {
  const answer = await ask(rl, PROMPT);
  if (answer === null) return "quit";
  if (answer.toLowerCase() === "q") return "quit";

  const decision = decisionForKey(answer);
  if (decision === null) return "skipped";

  // A correction with no value, or an abandoned prompt, must not be recorded
  // as a decision. Stopping here leaves the candidate for next time.
  const correctedValue =
    decision === "corrected" ? await ask(rl, "  corrected value: ") : undefined;
  if (correctedValue === null) return "quit";
  const note = await ask(rl, "  note (optional): ");
  if (note === null) return "quit";

  return apply(client, { factId: candidate.id, decision, reviewer }, correctedValue, note);
}

/** Writes the decision, reporting whichever way it went. */
async function apply(
  client: pg.Client,
  base: { factId: number; decision: Decision; reviewer: string },
  correctedValue: string | undefined,
  note: string,
): Promise<"skipped" | "decided"> {
  try {
    const applied = await recordDecision(client, {
      ...base,
      ...(correctedValue === undefined ? {} : { correctedValue }),
      ...(note === "" ? {} : { note }),
    });
    say(applied ? `  recorded: ${base.decision}` : "  already decided elsewhere - left as it was");
    return applied ? "decided" : "skipped";
  } catch (error) {
    // A refused decision leaves the candidate untouched, so the reviewer meets
    // it again rather than losing it to a typo.
    say(`  not recorded: ${error instanceof Error ? error.message : String(error)}`);
    return "skipped";
  }
}

function requireConfig(): { connectionString: string; reviewer: string } {
  const connectionString = process.env["DATABASE_URL_REVIEWER"] ?? "";
  if (connectionString === "") {
    process.stderr.write(
      "DATABASE_URL_REVIEWER is not set. Review connects as the reviewer role,\n" +
        "not the owner, so a defect here cannot rewrite what the parser read.\n" +
        "Create it with database/scripts/create-local-reviewer-user.sql\n",
    );
    process.exit(EXIT_MISCONFIGURED);
  }

  const reviewer = process.env["REVIEWER"] ?? "";
  try {
    assertReviewer(reviewer);
  } catch (error) {
    process.stderr.write(`${error instanceof ReviewError ? error.message : String(error)}\n`);
    process.stderr.write("  REVIEWER='Jane Doe' pnpm --filter @lokdarpan/ingestion review\n");
    process.exit(EXIT_NO_REVIEWER);
  }
  return { connectionString, reviewer };
}

async function main(): Promise<void> {
  const { connectionString, reviewer } = requireConfig();

  const client = new pg.Client({ connectionString });
  await client.connect();
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const kind = arg("kind") as FactKind | undefined;
    const limit = arg("limit");
    const queue = await pendingReview(client, {
      ...(kind === undefined ? {} : { kind }),
      ...(limit === undefined ? {} : { limit: Number(limit) }),
    });

    say(`\n${summarise(await reviewProgress(client))}`);
    if (queue.length === 0) {
      say("Nothing matches. Nothing published.\n");
      return;
    }
    say(`Reviewing as ${reviewer}. Nothing publishes until you say so.`);

    let decided = 0;
    for (const [index, candidate] of queue.entries()) {
      say(`\n${presentCandidate(candidate, index + 1, queue.length)}\n`);
      const outcome = await reviewOne(client, rl, candidate, reviewer);
      if (outcome === "quit") break;
      decided += outcome === "decided" ? 1 : 0;
    }

    const after = await reviewProgress(client);
    say(
      `\n${String(decided)} decided this session. ` +
        `${String(after.verified + after.corrected)} facts are now publishable, ` +
        `${String(after.unverified)} still await review.\n`,
    );
  } finally {
    rl.close();
    await client.end();
  }
}

await main();
