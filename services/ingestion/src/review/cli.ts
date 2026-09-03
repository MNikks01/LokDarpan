import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import pg from "pg";

import type { FactKind } from "../cag/facts";
import {
  ReviewError,
  assertReviewer,
  decisionForKey,
  priorDecisions,
  recordDecision,
  reviseDecision,
  type Decision,
} from "./decide";
import {
  BATCH_PROMPT,
  PROMPT,
  presentBatch,
  presentCandidate,
  type ReviewCandidate,
} from "./present";
import { factById, pendingReview, reviewProgress, type ReviewProgress } from "./queue";
import { selfCheck, type SelfCheck } from "./triage";

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

interface QueueOptions {
  readonly kind: FactKind | undefined;
  readonly limit: string | undefined;
  /**
   * The partition is applied in this process, so the database limit has to come
   * off first: limiting to 500 and then filtering showed "1 of 104" when 511
   * candidates matched, which understates the work and hides the rest of it
   * behind a number that looks complete.
   */
  readonly only: SelfCheck | undefined;
  /**
   * A reviewer works through one report in a sitting: it has one publisher, one
   * period and one set of conventions. Offering candidates from three reports
   * interleaved makes every answer a context switch.
   */
  readonly documentId: number | undefined;
}

/** Parsed queue filters, or null when `--document` is not a document id. */
function queueOptions(): QueueOptions | null {
  const documentArg = arg("document");
  const documentId = documentArg === undefined ? undefined : Number(documentArg);
  if (documentId !== undefined && !Number.isInteger(documentId)) return null;
  return {
    kind: arg("kind") as FactKind | undefined,
    limit: arg("limit"),
    only: arg("check") as SelfCheck | undefined,
    documentId,
  };
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

  // The note prompt costs a keystroke on every decision, and over a thousand
  // candidates that is the difference between a review that happens and one
  // that does not. It is asked where it carries weight - a correction has to
  // say what was corrected - and offered elsewhere behind --notes.
  const wantsNote = decision === "corrected" || process.argv.includes("--notes");
  const note = wantsNote ? await ask(rl, "  note: ") : "";
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

/**
 * Replaces one decision, named explicitly by fact id.
 *
 * Shows what the fact was decided to be before anything is changed, so a
 * reviewer replaces a decision they have read rather than one they assume.
 */
async function revise(
  client: pg.Client,
  rl: Interface,
  factId: number,
  reviewer: string,
): Promise<void> {
  const candidate = await factById(client, factId);
  if (candidate === null) {
    say(`No fact #${String(factId)}, or it has not been decided yet.`);
    return;
  }

  say(`\n${presentCandidate(candidate, 1, 1)}\n`);
  for (const prior of await priorDecisions(client, factId)) {
    say(`  previously ${prior.verificationStatus} by ${prior.verifiedBy ?? "unknown"}`);
  }

  const answer = await ask(rl, `  revising #${String(factId)}. ${PROMPT}`);
  if (answer === null || answer.toLowerCase() === "q") return;
  const decision = decisionForKey(answer);
  if (decision === null) {
    say("  unchanged.");
    return;
  }

  await applyRevision(client, rl, { factId, decision, reviewer });
}

/** Collects the new value and the required reason, then writes the revision. */
async function applyRevision(
  client: pg.Client,
  rl: Interface,
  base: { factId: number; decision: Decision; reviewer: string },
): Promise<void> {
  const correctedValue =
    base.decision === "corrected" ? await ask(rl, "  corrected value: ") : undefined;
  if (correctedValue === null) return;
  // Required, unlike a first decision: a published fact that changed must be
  // able to say why, or the change is itself an unaccountable claim.
  const note = await ask(rl, "  why is the earlier decision wrong: ");
  if (note === null) return;

  try {
    const applied = await reviseDecision(client, {
      ...base,
      note,
      ...(correctedValue === undefined ? {} : { correctedValue }),
    });
    say(applied ? `  revised: ${base.decision}` : "  nothing was decided here to revise");
  } catch (error) {
    say(`  not revised: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * The candidates to offer, in order.
 *
 * Working one partition at a time is most of the speed-up. "Does this sentence
 * state this amount?" and "what unit did the source mean?" are different
 * questions, and answering them alternately is what makes a thousand candidates
 * feel unreviewable.
 */
async function buildQueue(
  client: pg.Client,
  { kind, limit, only, documentId }: QueueOptions,
): Promise<ReviewCandidate[]> {
  const all = await pendingReview(client, {
    ...(kind === undefined ? {} : { kind }),
    ...(documentId === undefined ? {} : { documentId }),
    ...(only === undefined && limit === undefined
      ? {}
      : { limit: only === undefined ? Number(limit) : 100_000 }),
  });

  const matching =
    only === undefined
      ? all
      : all.filter(
          (c) =>
            selfCheck({ id: c.id, rawText: c.rawText, normalisedValue: c.normalisedValue })
              .check === only,
        );
  return limit === undefined ? matching : matching.slice(0, Number(limit));
}

/**
 * Review a page of candidates at once.
 *
 * WHY THIS IS SAFE HERE AND NOWHERE ELSE
 * Restricted to the `confirmed` partition by its caller, and that restriction
 * is the whole basis for it. A confirmed candidate's figure is stated by its
 * own evidence and by no other reading of it, so the question is "did the
 * parser take the right sentence" — which a line of evidence can answer.
 *
 * `ambiguous` asks which of several amounts on the page is the right one, and
 * `no value` asks the reviewer to supply a scale. Neither is a question a page
 * of ten lines can carry, and offering this mode for them would turn a
 * genuine judgement into a keystroke.
 *
 * Accepting a page still writes one attributed decision per fact. It is a
 * faster way to read, not a weaker kind of approval.
 */
async function reviewBatch(
  client: pg.Client,
  rl: Interface,
  page: readonly ReviewCandidate[],
  context: { offset: number; total: number; reviewer: string },
): Promise<{ outcome: "quit" | "next"; decided: number; flagged: ReviewCandidate[] }> {
  say(`\n${presentBatch(page, context.offset, context.total)}`);
  const answer = await ask(rl, BATCH_PROMPT);
  if (answer === null || answer.toLowerCase() === "q") {
    return { outcome: "quit", decided: 0, flagged: [] };
  }

  // A number pulls that one out for the full single-candidate screen, and the
  // rest of the page is left undecided — a reviewer who spotted one wrong
  // reading has reason to look at its neighbours again too.
  const flaggedIndex = /^[1-9]$/.test(answer) ? Number(answer) - 1 : -1;
  if (flaggedIndex >= 0 && flaggedIndex < page.length) {
    const candidate = page[flaggedIndex];
    return { outcome: "next", decided: 0, flagged: candidate === undefined ? [] : [candidate] };
  }

  if (answer.toLowerCase() !== "a") return { outcome: "next", decided: 0, flagged: [] };

  let decided = 0;
  for (const candidate of page) {
    const result = await apply(
      client,
      { factId: candidate.id, decision: "verified", reviewer: context.reviewer },
      undefined,
      "",
    );
    decided += result === "decided" ? 1 : 0;
  }
  say(`  recorded: ${String(decided)} verified`);
  return { outcome: "next", decided, flagged: [] };
}

/**
 * Walk the queue a page at a time, dropping into the single-candidate screen
 * for anything the reviewer flags.
 *
 * A flagged candidate leaves the rest of its page undecided on purpose: a
 * reviewer who has just found one wrong reading has reason to look again at
 * the ones beside it, and silently accepting them would be the opposite of
 * what flagging meant.
 */
async function runBatchQueue(
  client: pg.Client,
  rl: Interface,
  queue: readonly ReviewCandidate[],
  options: { batchSize: number; reviewer: string },
): Promise<number> {
  let decided = 0;
  for (let offset = 0; offset < queue.length; offset += options.batchSize) {
    const page = queue.slice(offset, offset + options.batchSize);
    const context = { offset, total: queue.length, reviewer: options.reviewer };

    const result = await reviewBatch(client, rl, page, context);
    decided += result.decided;
    if (result.outcome === "quit") return decided;

    const flagged = await reviewFlagged(client, rl, result.flagged, context);
    decided += flagged.decided;
    if (flagged.quit) return decided;
  }
  return decided;
}

/** The single-candidate screen, for candidates pulled out of a page. */
async function reviewFlagged(
  client: pg.Client,
  rl: Interface,
  flagged: readonly ReviewCandidate[],
  context: { offset: number; total: number; reviewer: string },
): Promise<{ decided: number; quit: boolean }> {
  let decided = 0;
  for (const candidate of flagged) {
    say(`\n${presentCandidate(candidate, context.offset + 1, context.total)}\n`);
    const outcome = await reviewOne(client, rl, candidate, context.reviewer);
    if (outcome === "quit") return { decided, quit: true };
    decided += outcome === "decided" ? 1 : 0;
  }
  return { decided, quit: false };
}

async function main(): Promise<void> {
  const { connectionString, reviewer } = requireConfig();

  const client = new pg.Client({ connectionString });
  await client.connect();
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const reviseId = arg("revise");
    if (reviseId !== undefined) {
      await revise(client, rl, Number(reviseId), reviewer);
      return;
    }

    const options = queueOptions();
    if (options === null) {
      say("--document must be a document id.");
      return;
    }
    const queue = await buildQueue(client, options);

    say(`\n${summarise(await reviewProgress(client))}`);
    if (queue.length === 0) {
      say("Nothing matches. Nothing published.\n");
      return;
    }
    say(`Reviewing as ${reviewer}. Nothing publishes until you say so.`);

    const batchSize = Number(arg("batch") ?? "0");
    if (batchSize > 0 && options.only !== "confirmed") {
      // The mode exists because a confirmed candidate can be judged from a
      // line. Nothing else can, so nothing else gets the fast path.
      say("--batch is only available with --check=confirmed.\n");
      return;
    }

    let decided = 0;

    if (batchSize > 0) {
      decided += await runBatchQueue(client, rl, queue, { batchSize, reviewer });
    } else
      for (const [index, candidate] of queue.entries()) {
        const checked = selfCheck({
          id: candidate.id,
          rawText: candidate.rawText,
          normalisedValue: candidate.normalisedValue,
        });
        say(`\n${presentCandidate(candidate, index + 1, queue.length, checked.check)}\n`);
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
