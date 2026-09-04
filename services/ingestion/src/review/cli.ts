import { readFile } from "node:fs/promises";
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
import {
  claimedAmountsByPage,
  factById,
  pageKeyOf,
  pendingReview,
  reviewProgress,
  type ReviewProgress,
} from "./queue";
import { CorrectionError, prepareCorrections } from "./corrections";
import { thresholdPhrase } from "./threshold";
import { selfCheck, type ClaimedByPage, type SelfCheck } from "./triage";

/**
 * `--check=criterion`: the candidates whose figure states a cut-off.
 *
 * Not a `SelfCheck`. The arithmetic partitions answer "does this sentence
 * contain this figure"; this answers "is this figure an amount anyone
 * reported", which is a question about words. Keeping it a separate axis is
 * what lets it *subtract* from the arithmetic partitions rather than compete
 * with them — see `.docs/adr/025-a-criterion-is-not-a-fact.md`.
 */
const CRITERION = "criterion";

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

/**
 * The partitions the page-at-a-time mode is offered for.
 *
 * Both are partitions where arithmetic has already accounted for every amount
 * in the window. Adding to this set means arguing that a new partition's
 * question fits on one line — see `presentBatch`.
 */
const BATCHABLE: ReadonlySet<SelfCheck> = new Set<SelfCheck>(["confirmed", "confirmed_in_context"]);

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
  readonly only: SelfCheck | typeof CRITERION | undefined;
  /**
   * A reviewer works through one report in a sitting: it has one publisher, one
   * period and one set of conventions. Offering candidates from three reports
   * interleaved makes every answer a context switch.
   */
  readonly documentId: number | undefined;
  /** `--ids=5733,5734`, for acting on a named set rather than a partition. */
  readonly ids: readonly number[] | undefined;
}

/** Parsed queue filters, or null when `--document` is not a document id. */
function queueOptions(): QueueOptions | null {
  const documentArg = arg("document");
  const documentId = documentArg === undefined ? undefined : Number(documentArg);
  if (documentId !== undefined && !Number.isInteger(documentId)) return null;

  const idsArg = arg("ids");
  const ids = idsArg === undefined ? undefined : idsArg.split(",").map(Number);
  // One unparseable id would silently shrink the set, and a reviewer would
  // never learn which candidate they meant to act on was left behind.
  if (ids !== undefined && !ids.every(Number.isInteger)) return null;

  return {
    kind: arg("kind") as FactKind | undefined,
    limit: arg("limit"),
    only: arg("check") as SelfCheck | typeof CRITERION | undefined,
    documentId,
    ids,
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
  { kind, limit, only, documentId, ids }: QueueOptions,
  claimed: ClaimedByPage,
): Promise<ReviewCandidate[]> {
  const all = await pendingReview(client, {
    ...(kind === undefined ? {} : { kind }),
    ...(documentId === undefined ? {} : { documentId }),
    ...(ids === undefined ? {} : { ids }),
    // Naming facts explicitly must never be truncated. `pendingReview` defaults
    // to 500, which is right for walking a queue and wrong for a set someone
    // listed: asking for 824 named facts decided the first 500 and reported
    // success, and only the count betrayed it. A partition is likewise filtered
    // in this process, so its limit has to come off the database query first.
    ...(ids !== undefined
      ? { limit: ids.length }
      : only === undefined && limit === undefined
        ? {}
        : { limit: only === undefined ? Number(limit) : 100_000 }),
  });

  const governed = (c: ReviewCandidate): boolean =>
    thresholdPhrase(c.rawText, c.normalisedValue) !== null;

  const matching =
    only === undefined
      ? all
      : only === CRITERION
        ? all.filter(governed)
        : all.filter(
            (c) =>
              checkOf(c, claimed).check === only &&
              // A criterion-governed candidate never enters a partition a page
              // of ten lines can be accepted from. Its question is not the one
              // that partition asks, and the fast path would answer it wrongly
              // at ten candidates a keystroke.
              !(BATCHABLE.has(only) && governed(c)),
          );
  return limit === undefined ? matching : matching.slice(0, Number(limit));
}

/** One candidate's verdict, judged against what else its page accounts for. */
function checkOf(c: ReviewCandidate, claimed: ClaimedByPage) {
  return selfCheck(
    { id: c.id, rawText: c.rawText, normalisedValue: c.normalisedValue },
    claimed.get(pageKeyOf(c.documentId, c.pageNumber)),
  );
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
  context: { offset: number; total: number; reviewer: string; partition: SelfCheck },
): Promise<{ outcome: "quit" | "next"; decided: number; flagged: ReviewCandidate[] }> {
  say(`\n${presentBatch(page, context.offset, context.total, context.partition)}`);
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
 * The `--corrections` branch: values a person supplies, one fact at a time.
 *
 * Each is recorded as a `corrected` decision carrying its own reason, which is
 * what `corrected` is for — the parser could not read the figure and a person
 * says what it is. Refused as a set by `--decide` for exactly this reason: one
 * flag cannot honestly supply a value per fact, and a file can.
 */
async function runCorrections(client: pg.Client, reviewer: string): Promise<boolean> {
  const path = arg("corrections");
  if (path === undefined) return false;

  let prepared;
  try {
    prepared = prepareCorrections(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    // Nothing is applied if any entry is wrong. A partly-applied corrections
    // file is worse than none: it leaves no single state anyone reasoned about.
    say(
      `Nothing applied. ${error instanceof CorrectionError || error instanceof Error ? error.message : String(error)}`,
    );
    return true;
  }

  say(`\nApplying ${String(prepared.length)} corrections, each with its own reason.\n`);
  let applied = 0;
  for (const c of prepared) {
    const result = await apply(
      client,
      { factId: c.id, decision: "corrected", reviewer },
      c.paise,
      `${c.note} [read as ${c.amount} ${c.unit}]`,
    );
    applied += result === "decided" ? 1 : 0;
  }
  say(`\n${String(applied)} corrected.`);
  return true;
}

/**
 * The `--revise` branch, or false when the caller did not ask for one.
 *
 * Kept whole and out of `main` because its refusals are the interesting part:
 * every one of them is a way of revising that would leave the audit trail
 * unable to explain itself.
 */
async function runRevise(client: pg.Client, rl: Interface, reviewer: string): Promise<boolean> {
  const reviseArg = arg("revise");
  if (reviseArg === undefined) return false;

  const ids = reviseArg.split(",").map(Number);
  if (!ids.every(Number.isInteger)) {
    say("--revise takes one fact id, or a comma-separated list of them.");
    return true;
  }

  const decision = arg("decide");
  if (decision === undefined) {
    // The interactive screen shows one fact and its prior decisions, which is
    // the only honest way to revise something you have not otherwise read.
    const only = ids.length === 1 ? ids[0] : undefined;
    if (only === undefined) say("Revising more than one fact at a time needs --decide and --note.");
    else await revise(client, rl, only, reviewer);
    return true;
  }
  if (decision !== "verified" && decision !== "rejected") {
    say('--decide takes "verified" or "rejected".');
    return true;
  }

  const note = arg("note")?.trim() ?? "";
  if (note === "") {
    say("--revise with --decide requires --note: a replaced decision has to say why.");
    return true;
  }

  await reviseAll(client, ids, { decision, note, reviewer });
  return true;
}

/**
 * Replaces the decision on a named set of facts, with the reason on each.
 *
 * Only ever reachable through `--revise`, which names the facts explicitly:
 * revision stays something a reviewer chooses rather than something a queue
 * walks them into. The reason is required by `reviseDecision` itself, and
 * migration 0009's trigger keeps every superseded decision, so a reader can
 * see both what a fact used to be and why it stopped being that.
 */
async function reviseAll(
  client: pg.Client,
  ids: readonly number[],
  options: { decision: Decision; note: string; reviewer: string },
): Promise<number> {
  say(
    `\nReplacing the decision on ${String(ids.length)} facts with ${options.decision}.\n` +
      `  reason: ${options.note}\n`,
  );

  let revised = 0;
  for (const factId of ids) {
    try {
      const applied = await reviseDecision(client, {
        factId,
        decision: options.decision,
        reviewer: options.reviewer,
        note: options.note,
      });
      say(applied ? `  #${String(factId)} revised` : `  #${String(factId)} was never decided`);
      revised += applied ? 1 : 0;
    } catch (error) {
      say(`  #${String(factId)} not revised: ${error instanceof Error ? error.message : ""}`);
    }
  }
  return revised;
}

/**
 * Applies one decision to every candidate in a scoped queue, with no prompt.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT SIMPLY A FASTER REVIEW
 * Some decisions are reached by a rule rather than by reading a page. The
 * criterion-governed figures `thresholdPhrase` finds are rejected because of
 * what their sentence does with the number, and that reasoning is identical
 * for every one of them. The alternative — feeding synthetic keystrokes to the
 * interactive prompt — would write an audit trail claiming a person read each
 * page one at a time. Saying plainly what happened is better than a trail that
 * misrepresents it.
 *
 * The guards are the substance of it:
 *
 * - **A note is required and may not be blank**, and it is recorded against
 *   every fact decided. A decision reached by a rule has to state the rule, or
 *   nobody can later tell whether it was applied to the right candidates.
 * - **The queue must be scoped** by `--ids` or `--check`. "Decide everything
 *   still outstanding" is deliberately not expressible.
 * - **`corrected` is refused.** A correction carries a per-fact value, and one
 *   flag cannot honestly supply it for a set.
 */
async function decideAll(
  client: pg.Client,
  queue: readonly ReviewCandidate[],
  options: { decision: Decision; note: string; reviewer: string },
): Promise<number> {
  say(
    `\nRecording ${options.decision} against ${String(queue.length)} candidates, ` +
      `with the reason stored on each.\n  reason: ${options.note}\n`,
  );

  let decided = 0;
  for (const candidate of queue) {
    const result = await apply(
      client,
      { factId: candidate.id, decision: options.decision, reviewer: options.reviewer },
      undefined,
      options.note,
    );
    decided += result === "decided" ? 1 : 0;
  }
  return decided;
}

/**
 * The partition `--batch` may run over, a refusal, or null for no batching.
 *
 * An absent `--check` counts as not batchable: a page at a time over an
 * unfiltered queue would mix back in the partitions a page cannot carry. The
 * mode exists because these candidates can be judged from a line — every
 * amount in the window is accounted for, so the question is whether the parser
 * took the right sentence. `ambiguous` asks which of several unexplained
 * amounts is meant, and `no value` asks the reviewer to supply a scale;
 * neither fits on a line, so neither gets the fast path.
 */
function batchPartition(
  options: QueueOptions,
  batchSize: number,
): SelfCheck | { refusal: string } | null {
  if (batchSize <= 0) return null;
  const partition = options.only;
  if (partition === undefined || partition === CRITERION || !BATCHABLE.has(partition)) {
    return {
      refusal: "--batch is only available with --check=confirmed or --check=confirmed_in_context.",
    };
  }
  return partition;
}

/**
 * The non-interactive decision, validated, or a refusal to state.
 *
 * Returns a message rather than throwing so `main` can print it and stop
 * without a stack trace: every one of these is a misuse the caller can fix.
 */
function bulkDecision(
  options: QueueOptions,
): { decision: Decision; note: string } | { refusal: string } | null {
  const raw = arg("decide");
  if (raw === undefined) return null;

  if (raw !== "verified" && raw !== "rejected") {
    return {
      refusal:
        `--decide takes "verified" or "rejected". A correction carries a value ` +
        `per fact, which one flag cannot supply for a set.`,
    };
  }
  const note = arg("note")?.trim() ?? "";
  if (note === "") {
    return {
      refusal:
        "--decide requires --note. A decision reached by a rule has to state the rule, " +
        "or nobody can tell later whether it was applied to the right candidates.",
    };
  }
  if (options.ids === undefined && options.only === undefined) {
    return {
      refusal: "--decide needs --ids or --check. Deciding the whole queue at once is not offered.",
    };
  }
  return { decision: raw, note };
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
  options: { batchSize: number; reviewer: string; partition: SelfCheck },
): Promise<number> {
  let decided = 0;
  for (let offset = 0; offset < queue.length; offset += options.batchSize) {
    const page = queue.slice(offset, offset + options.batchSize);
    const context = {
      offset,
      total: queue.length,
      reviewer: options.reviewer,
      partition: options.partition,
    };

    const result = await reviewBatch(client, rl, page, context);
    decided += result.decided;
    if (result.outcome === "quit") return decided;

    const flagged = await reviewFlagged(client, rl, result.flagged, context);
    decided += flagged.decided;
    if (flagged.quit) return decided;
  }
  return decided;
}

/**
 * The whole queue, one candidate at a time.
 *
 * The unaccelerated path, and the only one offered for the partitions that ask
 * a reviewer a question a line cannot carry. Each candidate is shown with the
 * verdict its page context produced, so the screen says why it is being asked.
 */
async function runSingleQueue(
  client: pg.Client,
  rl: Interface,
  queue: readonly ReviewCandidate[],
  { claimed, reviewer }: { claimed: ClaimedByPage; reviewer: string },
): Promise<number> {
  let decided = 0;
  for (const [index, candidate] of queue.entries()) {
    const checked = checkOf(candidate, claimed);
    say(`\n${presentCandidate(candidate, index + 1, queue.length, checked.check)}\n`);
    const outcome = await reviewOne(client, rl, candidate, reviewer);
    if (outcome === "quit") break;
    decided += outcome === "decided" ? 1 : 0;
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

/**
 * The modes that name their facts explicitly instead of walking the queue.
 *
 * Kept together because that is what they have in common, and it is the
 * property that makes them safe: neither can decide a fact nobody asked about.
 */
async function runNamedFactMode(
  client: pg.Client,
  rl: Interface,
  reviewer: string,
): Promise<boolean> {
  if (await runRevise(client, rl, reviewer)) return true;
  return runCorrections(client, reviewer);
}

async function main(): Promise<void> {
  const { connectionString, reviewer } = requireConfig();

  const client = new pg.Client({ connectionString });
  await client.connect();
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    if (await runNamedFactMode(client, rl, reviewer)) return;

    const options = queueOptions();
    if (options === null) {
      say("--document must be a document id.");
      return;
    }
    const claimed = await claimedAmountsByPage(
      client,
      options.documentId === undefined ? {} : { documentId: options.documentId },
    );
    const queue = await buildQueue(client, options, claimed);

    say(`\n${summarise(await reviewProgress(client))}`);
    if (queue.length === 0) {
      say("Nothing matches. Nothing published.\n");
      return;
    }
    say(`Reviewing as ${reviewer}. Nothing publishes until you say so.`);

    const bulk = bulkDecision(options);
    if (bulk !== null && "refusal" in bulk) {
      say(`${bulk.refusal}\n`);
      return;
    }

    const batchSize = Number(arg("batch") ?? "0");
    const batch = batchPartition(options, batchSize);
    if (batch !== null && typeof batch === "object") {
      say(`${batch.refusal}\n`);
      return;
    }

    const decided =
      bulk !== null
        ? await decideAll(client, queue, { ...bulk, reviewer })
        : batch !== null
          ? await runBatchQueue(client, rl, queue, { batchSize, reviewer, partition: batch })
          : await runSingleQueue(client, rl, queue, { claimed, reviewer });

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
