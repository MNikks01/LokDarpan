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
  /** Undecided rows whose `parser_version` was brought up to date. */
  readonly refreshed: number;
  /** Facts that gained a bounding box they did not have. */
  readonly located: number;
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
/** What reconciling one already-loaded row against its candidate did. */
interface Reconciled {
  readonly located: boolean;
  readonly alreadyReviewed: boolean;
  readonly refreshed: boolean;
}

/**
 * Brings an existing row into step with the candidate the parser now produces,
 * without re-offering it or disturbing a decision.
 */
async function reconcile(
  client: SqlClient,
  row: {
    id: string;
    status: string;
    parserVersion: string;
    needsBox: boolean;
    validationState: string | null;
  },
  c: FactCandidate,
): Promise<Reconciled> {
  // The verdict is not part of identity: it is what the field's rules say about
  // a reading, not what the reading is. So it lands on rows already held,
  // whatever their status — a reviewer returning to a decided fact should see
  // what the rules now make of it, and a rule that changes should be visible on
  // every fact it touches rather than only on ones extracted since.
  if (row.validationState !== c.validation.state) {
    await client.query(
      `UPDATE document_fact SET validation_state = $2, validation_reason = $3 WHERE id = $1`,
      [row.id, c.validation.state, c.validation.reason === "" ? null : c.validation.reason],
    );
  }

  // Geometry first, and whatever the row's status. A box is not part of
  // identity and not part of what a person reviewed — it says where on the page
  // a figure the reviewer already saw is sitting. Gating it behind `unverified`,
  // as this first did, would leave every decided fact — the only ones a reader
  // can reach — as the ones with no region to show.
  let located = false;
  if (row.needsBox && c.box !== undefined) {
    await client.query(
      `UPDATE document_fact SET bbox_x0=$2, bbox_y0=$3, bbox_x1=$4, bbox_y1=$5 WHERE id = $1`,
      [row.id, c.box.x0, c.box.y0, c.box.x1, c.box.y1],
    );
    located = true;
  }

  if (row.status !== "unverified") {
    return { located, alreadyReviewed: true, refreshed: false };
  }

  // An undecided candidate's provenance is the parser that currently produces
  // it. Leaving the old version on the row would have it claim it was read by a
  // parser that no longer exists, which is a false statement about how a figure
  // was arrived at — and these rows are exactly the ones a reviewer is about to
  // publish.
  //
  // Decided rows are not touched: their version is part of what a person
  // reviewed, and the parser does not get to restate that.
  if (row.parserVersion !== PARSER_VERSION) {
    await client.query(`UPDATE document_fact SET parser_version = $2 WHERE id = $1`, [
      row.id,
      PARSER_VERSION,
    ]);
    return { located, alreadyReviewed: false, refreshed: true };
  }

  return { located, alreadyReviewed: false, refreshed: false };
}

/** The rows already held for a document, keyed by what makes a fact that fact. */
async function heldByIdentity(
  client: SqlClient,
  documentId: number,
): Promise<
  Map<
    string,
    {
      id: string;
      status: string;
      parserVersion: string;
      needsBox: boolean;
      validationState: string | null;
    }
  >
> {
  const held = await client.query(
    `SELECT id, page_number, kind, raw_text, normalised_value, verification_status,
            parser_version, bbox_x0, validation_state
       FROM document_fact WHERE document_id = $1`,
    [documentId],
  );

  const existing = new Map<
    string,
    {
      id: string;
      status: string;
      parserVersion: string;
      needsBox: boolean;
      validationState: string | null;
    }
  >();
  for (const row of held.rows as {
    id: string;
    page_number: number;
    kind: string;
    raw_text: string;
    normalised_value: string | null;
    verification_status: string;
    parser_version: string;
    bbox_x0: string | null;
    validation_state: string | null;
  }[]) {
    const key = identity({
      pageNumber: row.page_number,
      kind: row.kind,
      rawText: row.raw_text,
      normalisedValue: row.normalised_value,
    });
    existing.set(key, {
      id: row.id,
      status: row.verification_status,
      parserVersion: row.parser_version,
      needsBox: row.bbox_x0 === null,
      validationState: row.validation_state,
    });
  }
  return existing;
}

/** A candidate nobody has seen, offered for review with its region if it has one. */
async function insertCandidate(
  client: SqlClient,
  documentId: number,
  c: FactCandidate,
): Promise<void> {
  await client.query(
    `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                extraction_method, parser_version, extraction_confidence,
                                bbox_x0, bbox_y0, bbox_x1, bbox_y1,
                                validation_state, validation_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      documentId,
      c.pageNumber,
      c.kind,
      c.rawText,
      c.normalisedValue,
      EXTRACTION_METHOD,
      PARSER_VERSION,
      c.extractionConfidence,
      c.box?.x0 ?? null,
      c.box?.y0 ?? null,
      c.box?.x1 ?? null,
      c.box?.y1 ?? null,
      c.validation.state,
      c.validation.reason === "" ? null : c.validation.reason,
    ],
  );
}

export async function loadFactCandidates(
  client: SqlClient,
  documentId: number,
  candidates: readonly FactCandidate[],
): Promise<FactLoadResult> {
  const existing = await heldByIdentity(client, documentId);

  const produced = new Set(candidates.map(identity));
  let inserted = 0;
  let skippedAlreadyReviewed = 0;
  let refreshed = 0;
  let located = 0;

  for (const c of candidates) {
    const row = existing.get(identity(c));

    if (row !== undefined) {
      const outcome = await reconcile(client, row, c);
      located += outcome.located ? 1 : 0;
      skippedAlreadyReviewed += outcome.alreadyReviewed ? 1 : 0;
      refreshed += outcome.refreshed ? 1 : 0;
      continue;
    }

    await insertCandidate(client, documentId, c);
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
    refreshed,
    located,
    retired: retirable.length,
    strandedDecisions: stale.length - retirable.length,
  };
}
