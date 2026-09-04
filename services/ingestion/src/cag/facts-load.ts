import type { SqlClient } from "@lokdarpan/database";

import { PARSER_VERSION, type FactCandidate } from "./facts";

export interface FactLoadResult {
  readonly inserted: number;
  readonly skippedAlreadyReviewed: number;
  /**
   * Undecided candidates this parser version no longer produces, removed.
   *
   * A candidate is the parser's current reading, not a historical record of
   * one. When a fix changes what a sentence yields — `₹ 20 ,564.71 कोटी` read
   * as unqualified before the digit group tolerated the text layer's injected
   * space, and as ₹20,564.71 crore after — the superseded row would otherwise
   * sit in the review queue forever beside its own replacement, and a reviewer
   * would be asked to supply a scale for a figure whose scale is printed on
   * the page.
   */
  readonly retired: number;
  /**
   * Decided facts this parser version no longer produces.
   *
   * Never touched, only counted. A person's decision is not the parser's to
   * withdraw, and silently removing one would destroy the audit trail that
   * makes review mean anything. Reported so someone can revise them.
   */
  readonly strandedDecisions: number;
}

/**
 * What makes two candidates the same candidate.
 *
 * Not a database key. `(document, page, kind, raw_text)` is not unique — 70
 * evidence windows in this corpus carry more than one figure, because a short
 * sentence yields the same window for every amount in it — so the value has to
 * be part of the identity or two distinct facts would collapse into one.
 *
 * Encoded rather than joined on a separator: evidence windows are prose and
 * contain every punctuation character these reports use, so any separator
 * chosen would be one that two different windows could be spelled to collide on.
 */
function identity(c: {
  pageNumber: number;
  kind: string;
  rawText: string;
  normalisedValue: string | null;
}): string {
  return JSON.stringify([c.pageNumber, c.kind, c.rawText, c.normalisedValue]);
}

const EXTRACTION_METHOD = "regex over pdf text layer";

/**
 * Reconciles a document's candidates to what this parser version produces.
 *
 * Re-running the parser must be safe in both directions. If a reviewer has
 * already verified, rejected or corrected a candidate, a later run leaves it
 * alone — a re-extraction that silently reset review state would quietly
 * republish claims a person had already rejected. And an undecided candidate
 * the parser has stopped producing is removed, so a fix to how a sentence is
 * read replaces the old reading instead of accumulating beside it.
 *
 * The asymmetry is the point: undecided rows belong to the parser, and decided
 * ones belong to the person who decided them.
 */
export async function loadFactCandidates(
  client: SqlClient,
  documentId: number,
  candidates: readonly FactCandidate[],
): Promise<FactLoadResult> {
  const held = await client.query(
    `SELECT id, page_number, kind, raw_text, normalised_value, verification_status
       FROM document_fact WHERE document_id = $1`,
    [documentId],
  );
  const existing = new Map<string, { id: string; status: string }>();
  for (const row of held.rows as {
    id: string;
    page_number: number;
    kind: string;
    raw_text: string;
    normalised_value: string | null;
    verification_status: string;
  }[]) {
    const key = identity({
      pageNumber: row.page_number,
      kind: row.kind,
      rawText: row.raw_text,
      normalisedValue: row.normalised_value,
    });
    existing.set(key, { id: row.id, status: row.verification_status });
  }

  const produced = new Set(candidates.map(identity));
  let inserted = 0;
  let skippedAlreadyReviewed = 0;

  for (const c of candidates) {
    const row = existing.get(identity(c));

    if (row !== undefined) {
      if (row.status !== "unverified") skippedAlreadyReviewed += 1;
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

  // Only undecided rows, and only ones this parser version stopped producing.
  const stale = [...existing].filter(([key]) => !produced.has(key));
  const retirable = stale.filter(([, row]) => row.status === "unverified").map(([, row]) => row.id);
  if (retirable.length > 0) {
    await client.query(`DELETE FROM document_fact WHERE id = ANY($1::bigint[])`, [retirable]);
  }

  return {
    inserted,
    skippedAlreadyReviewed,
    retired: retirable.length,
    strandedDecisions: stale.length - retirable.length,
  };
}
