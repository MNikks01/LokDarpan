import type { SqlClient } from "@lokdarpan/database";

import { PARSER_VERSION, type FactCandidate } from "./facts";

export interface FactLoadResult {
  readonly inserted: number;
  readonly skippedAlreadyReviewed: number;
}

const EXTRACTION_METHOD = "regex over pdf text layer";

/**
 * Loads candidates, and never overwrites a human decision.
 *
 * Re-running the parser must be safe. If a reviewer has already verified,
 * rejected or corrected a candidate, a later parser run leaves it alone — a
 * re-extraction that silently reset review state would quietly republish
 * claims a person had already rejected.
 */
export async function loadFactCandidates(
  client: SqlClient,
  documentId: number,
  candidates: readonly FactCandidate[],
): Promise<FactLoadResult> {
  let inserted = 0;
  let skippedAlreadyReviewed = 0;

  for (const c of candidates) {
    const existing = await client.query(
      `SELECT id, verification_status FROM document_fact
        WHERE document_id = $1 AND page_number = $2 AND kind = $3 AND raw_text = $4
          AND coalesce(normalised_value,'') = coalesce($5,'')`,
      [documentId, c.pageNumber, c.kind, c.rawText, c.normalisedValue],
    );
    const row = existing.rows[0] as { verification_status: string } | undefined;

    if (row !== undefined) {
      if (row.verification_status !== "unverified") skippedAlreadyReviewed += 1;
      continue;
    }

    await client.query(
      `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                  extraction_method, parser_version, extraction_confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        documentId,
        c.pageNumber,
        c.kind,
        c.rawText,
        c.normalisedValue,
        EXTRACTION_METHOD,
        PARSER_VERSION,
        c.extractionConfidence,
      ],
    );
    inserted += 1;
  }

  return { inserted, skippedAlreadyReviewed };
}
