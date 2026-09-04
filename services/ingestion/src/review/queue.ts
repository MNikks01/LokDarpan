import type { SqlClient } from "@lokdarpan/database";

import { displayTitle } from "@lokdarpan/domain";

import type { FactKind } from "../cag/facts";
import type { ReviewCandidate } from "./present";

export interface QueueFilter {
  readonly kind?: FactKind;
  readonly documentId?: number;
  /**
   * Exactly these facts, named by id.
   *
   * For acting on a set some other reading produced — the criterion-governed
   * figures the triage lists, say — where walking the queue and counting to
   * the right position would be both slow and a way to decide the wrong one.
   *
   * A caller passing these is naming facts, not sampling them, so it must also
   * raise `limit` to cover them. The default of 500 belongs to queue-walking;
   * applied to a named set it decides a prefix and reports success.
   */
  readonly ids?: readonly number[];
  /** Skip candidates the parser was least sure of, when triaging. */
  readonly minConfidence?: number;
  readonly limit?: number;
}

interface Row {
  readonly id: string;
  readonly document_id: string;
  readonly page_number: number;
  readonly kind: FactKind;
  readonly raw_text: string;
  readonly normalised_value: string | null;
  readonly extraction_confidence: string;
  readonly parser_version: string;
  readonly document_title: string;
  readonly source_url: string;
}

/**
 * The candidates awaiting a decision.
 *
 * Ordered by document and page rather than by confidence, so a reviewer works
 * through a report the way it was written. Context carries between adjacent
 * candidates - the sentence that names a contract value is usually beside the
 * one that names the firm - and confidence order would scatter those apart.
 *
 * Only `unverified` rows are returned. A decision already made is not offered
 * again, so a long session cannot quietly overwrite its own earlier judgements.
 */
export async function pendingReview(
  client: SqlClient,
  filter: QueueFilter = {},
): Promise<ReviewCandidate[]> {
  const where: string[] = ["f.verification_status = 'unverified'"];
  const params: unknown[] = [];

  if (filter.kind !== undefined) {
    params.push(filter.kind);
    where.push(`f.kind = $${String(params.length)}`);
  }
  if (filter.documentId !== undefined) {
    params.push(filter.documentId);
    where.push(`f.document_id = $${String(params.length)}`);
  }
  if (filter.ids !== undefined) {
    params.push(filter.ids);
    where.push(`f.id = ANY($${String(params.length)}::bigint[])`);
  }
  if (filter.minConfidence !== undefined) {
    params.push(filter.minConfidence);
    where.push(`f.extraction_confidence >= $${String(params.length)}`);
  }
  params.push(filter.limit ?? 500);

  const result = await client.query(
    `SELECT f.id, f.document_id, f.page_number, f.kind, f.raw_text, f.normalised_value,
            f.extraction_confidence, f.parser_version,
            d.title AS document_title, s.source_url
       FROM document_fact f
       JOIN document d        ON d.id = f.document_id
       JOIN source_artifact s ON s.sha256 = d.source_sha256
      WHERE ${where.join(" AND ")}
      ORDER BY f.document_id, f.page_number, f.id
      LIMIT $${String(params.length)}`,
    params,
  );

  return (result.rows as Row[]).map((r) => ({
    id: Number(r.id),
    documentId: Number(r.document_id),
    pageNumber: r.page_number,
    kind: r.kind,
    rawText: r.raw_text,
    normalisedValue: r.normalised_value,
    extractionConfidence: Number(r.extraction_confidence),
    parserVersion: r.parser_version,
    documentTitle: displayTitle(r.document_title),
    sourceUrl: r.source_url,
  }));
}

/**
 * Every monetary amount claimed by a fact, grouped by the page it sits on.
 *
 * Deliberately unfiltered by verification status. This is what lets the triage
 * tell window overlap apart from a genuine choice between readings, and a
 * sibling that has already been decided still accounts for its amount. Scoping
 * it to the queue would shrink the context as the reviewer worked, moving
 * candidates back into `ambiguous` behind them.
 */
export async function claimedAmountsByPage(
  client: SqlClient,
  filter: { documentId?: number } = {},
): Promise<Map<string, Set<string>>> {
  const params: unknown[] = [];
  let scope = "";
  if (filter.documentId !== undefined) {
    params.push(filter.documentId);
    scope = ` AND document_id = $${String(params.length)}`;
  }

  const result = await client.query(
    `SELECT document_id, page_number, normalised_value
       FROM document_fact
      WHERE kind = 'monetary_amount' AND normalised_value IS NOT NULL${scope}`,
    params,
  );

  const claimed = new Map<string, Set<string>>();
  for (const row of result.rows as {
    document_id: string;
    page_number: number;
    normalised_value: string;
  }[]) {
    const key = pageKeyOf(Number(row.document_id), row.page_number);
    const values = claimed.get(key) ?? new Set<string>();
    values.add(row.normalised_value);
    claimed.set(key, values);
  }
  return claimed;
}

/** The page identity the triage groups by. One shape, defined once. */
export function pageKeyOf(documentId: number, pageNumber: number): string {
  return `${String(documentId)}:${String(pageNumber)}`;
}

export interface ReviewProgress {
  readonly unverified: number;
  readonly verified: number;
  readonly rejected: number;
  readonly corrected: number;
}

/** What remains, so a reviewer can see the end of the queue from inside it. */
export async function reviewProgress(client: SqlClient): Promise<ReviewProgress> {
  const result = await client.query(
    `SELECT verification_status AS status, count(*)::int AS n
       FROM document_fact GROUP BY verification_status`,
  );
  const counts: Record<string, number> = {};
  for (const row of result.rows as { status: string; n: number }[]) {
    counts[row.status] = row.n;
  }
  return {
    unverified: counts["unverified"] ?? 0,
    verified: counts["verified"] ?? 0,
    rejected: counts["rejected"] ?? 0,
    corrected: counts["corrected"] ?? 0,
  };
}

/**
 * One decided fact, for revision.
 *
 * Only a decided one: revision must not become a way to make a first decision
 * outside the queue, where the ordering and the count of what remains are what
 * keep a reviewer honest about how much they have actually looked at.
 */
export async function factById(client: SqlClient, factId: number): Promise<ReviewCandidate | null> {
  const result = await client.query(
    `SELECT f.id, f.document_id, f.page_number, f.kind, f.raw_text, f.normalised_value,
            f.extraction_confidence, f.parser_version,
            d.title AS document_title, s.source_url
       FROM document_fact f
       JOIN document d        ON d.id = f.document_id
       JOIN source_artifact s ON s.sha256 = d.source_sha256
      WHERE f.id = $1 AND f.verification_status <> 'unverified'`,
    [factId],
  );
  const row = (result.rows as Row[])[0];
  if (row === undefined) return null;
  return {
    id: Number(row.id),
    documentId: Number(row.document_id),
    pageNumber: row.page_number,
    kind: row.kind,
    rawText: row.raw_text,
    normalisedValue: row.normalised_value,
    extractionConfidence: Number(row.extraction_confidence),
    parserVersion: row.parser_version,
    documentTitle: displayTitle(row.document_title),
    sourceUrl: row.source_url,
  };
}
