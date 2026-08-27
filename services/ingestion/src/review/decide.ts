import type { SqlClient } from "@lokdarpan/database";

/**
 * Recording a review decision.
 *
 * The database refuses most of what could go wrong here - migration 0008 gives
 * the reviewer UPDATE on five columns and nothing else, so a bug in this file
 * cannot rewrite what the parser read from the page. What is left to get right
 * is the part Postgres cannot judge: that a decision is attributed to someone,
 * that a correction actually carries a value, and that a decision already made
 * is not silently replaced.
 */

export type Decision = "verified" | "rejected" | "corrected";

/**
 * The keys a reviewer presses, and what each one means.
 *
 * Lives here rather than in the CLI so it can be tested without starting a
 * terminal session. Every key not in this map is a skip - see `decisionForKey`.
 */
const KEY_TO_DECISION: Readonly<Record<string, Decision>> = {
  v: "verified",
  r: "rejected",
  c: "corrected",
};

/**
 * `null` for anything unrecognised, which the caller treats as a skip.
 *
 * A mistyped key must never become a decision. Publishing a claim about a
 * named company because someone fumbled a keystroke is the specific accident
 * this whole review step exists to prevent, so the mapping is deliberately
 * closed: only three keys mean anything, and everything else means "not yet".
 */
export function decisionForKey(key: string): Decision | null {
  return KEY_TO_DECISION[key.trim().toLowerCase()] ?? null;
}

export interface ReviewInput {
  readonly factId: number;
  readonly decision: Decision;
  readonly reviewer: string;
  /** Required for `corrected`, refused otherwise. */
  readonly correctedValue?: string;
  readonly note?: string;
}

export class ReviewError extends Error {
  public override readonly name = "ReviewError";
}

/**
 * A reviewer identity that means something later.
 *
 * `verified_by` is the audit trail. "me", "admin" or an empty string names
 * nobody, and a decision nobody is accountable for is not a review - it is an
 * anonymous publication of a claim about a named company.
 */
export function assertReviewer(reviewer: string): void {
  const trimmed = reviewer.trim();
  if (trimmed.length < 3) {
    throw new ReviewError(
      "A reviewer identity is required. Set REVIEWER to something that identifies a person.",
    );
  }
  if (["me", "admin", "user", "test", "unknown", "none"].includes(trimmed.toLowerCase())) {
    throw new ReviewError(`"${trimmed}" does not identify anyone. Use a real identity.`);
  }
}

/**
 * Applies one decision, and only to a candidate nobody has decided yet.
 *
 * The `verification_status = 'unverified'` predicate is the concurrency guard.
 * Two reviewers on the same queue, or one reviewer with a stale list, would
 * otherwise overwrite each other's judgements with no record that it happened.
 * Losing the second decision is recoverable; losing the first silently is not.
 */
export async function recordDecision(client: SqlClient, input: ReviewInput): Promise<boolean> {
  assertReviewer(input.reviewer);

  const corrected = input.correctedValue?.trim() ?? "";
  if (input.decision === "corrected" && corrected === "") {
    throw new ReviewError("A correction needs the corrected value.");
  }
  if (input.decision !== "corrected" && corrected !== "") {
    // Recording a value beside "verified" would be ambiguous: is the published
    // figure the parser's or the reviewer's? `corrected` is how you say yours.
    throw new ReviewError("Only a correction may carry a corrected value.");
  }

  const result = await client.query(
    `UPDATE document_fact
        SET verification_status = $2,
            verified_by         = $3,
            verified_at         = now(),
            corrected_value     = $4,
            reviewer_note       = $5
      WHERE id = $1 AND verification_status = 'unverified'
      RETURNING id`,
    [
      input.factId,
      input.decision,
      input.reviewer.trim(),
      input.decision === "corrected" ? corrected : null,
      input.note?.trim() === "" ? null : (input.note?.trim() ?? null),
    ],
  );

  // RETURNING rather than a row count: SqlClient exposes only rows, and
  // widening a shared interface for one caller is the wrong trade.
  return result.rows.length > 0;
}
