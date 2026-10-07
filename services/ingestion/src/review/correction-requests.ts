import type { SqlClient } from "@lokdarpan/database";

/**
 * Reports of data errors from the public, as a reviewer works through them
 * (ADR-075).
 *
 * Deciding a report changes no figure. A report is a request to re-read a
 * source; if the ledger is wrong, the fix goes through the fact review tools
 * (`review`), which keep their own history. This records what the reviewer
 * found, so the reader's reference has an answer.
 */

export const OPEN_STATUSES = ["received", "reviewing"] as const;
export const DECISIONS = ["reviewing", "corrected", "no_change", "not_actionable"] as const;
export type Decision = (typeof DECISIONS)[number];

export interface CorrectionRequestRow {
  readonly reference: string;
  readonly receivedAt: string;
  readonly subject: string;
  readonly category: string;
  readonly description: string;
  readonly evidenceUrl: string | null;
  readonly status: string;
}

export async function openRequests(client: SqlClient): Promise<CorrectionRequestRow[]> {
  const r = await client.query(
    `SELECT reference, received_at::text, subject, category::text, description, evidence_url, status::text
       FROM correction_request
      WHERE status = ANY($1::correction_status[])
      ORDER BY received_at`,
    [OPEN_STATUSES],
  );
  return (
    r.rows as {
      reference: string;
      received_at: string;
      subject: string;
      category: string;
      description: string;
      evidence_url: string | null;
      status: string;
    }[]
  ).map((row) => ({
    reference: row.reference,
    receivedAt: row.received_at,
    subject: row.subject,
    category: row.category,
    description: row.description,
    evidenceUrl: row.evidence_url,
    status: row.status,
  }));
}

/**
 * Record a decision on one report. A final decision needs a note: the reader's
 * reference must lead to a reason, not only a status.
 */
export async function decideRequest(
  client: SqlClient,
  decision: { reference: string; status: Decision; reviewer: string; note: string | null },
): Promise<boolean> {
  if (decision.reviewer.trim() === "") throw new Error("A decision names its reviewer.");
  const final = decision.status !== "reviewing";
  if (final && (decision.note === null || decision.note.trim() === "")) {
    throw new Error("A final decision states what the source was found to say.");
  }
  const r = await client.query(
    `UPDATE correction_request
        SET status = $2::correction_status,
            decided_by = CASE WHEN $3 THEN $4 ELSE decided_by END,
            decided_at = CASE WHEN $3 THEN now() ELSE decided_at END,
            resolution_note = COALESCE($5, resolution_note)
      WHERE reference = $1
      RETURNING reference`,
    [decision.reference, decision.status, final, decision.reviewer, decision.note],
  );
  return r.rows.length === 1;
}
