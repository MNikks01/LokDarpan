import type { SqlClient } from "@lokdarpan/database";

import type { FactKind } from "../cag/facts";
import type { ReviewCandidate } from "./present";

export interface QueueFilter {
  readonly kind?: FactKind;
  readonly documentId?: number;
  /** Skip candidates the parser was least sure of, when triaging. */
  readonly minConfidence?: number;
  readonly limit?: number;
}

interface Row {
  readonly id: string;
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
  if (filter.minConfidence !== undefined) {
    params.push(filter.minConfidence);
    where.push(`f.extraction_confidence >= $${String(params.length)}`);
  }
  params.push(filter.limit ?? 500);

  const result = await client.query(
    `SELECT f.id, f.page_number, f.kind, f.raw_text, f.normalised_value,
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
    pageNumber: r.page_number,
    kind: r.kind,
    rawText: r.raw_text,
    normalisedValue: r.normalised_value,
    extractionConfidence: Number(r.extraction_confidence),
    parserVersion: r.parser_version,
    documentTitle: r.document_title,
    sourceUrl: r.source_url,
  }));
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
