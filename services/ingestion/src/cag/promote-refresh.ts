import type pg from "pg";

import { openDatasetVersion, sealDatasetVersion } from "../lgd/load";
import { PromotionRefused } from "./promote";

/**
 * Carries review work done after promotion into the target (#190).
 *
 * `promoteCag` copies reports the target does not hold, and leaves a report it
 * already holds alone. Review does not stop at promotion: a newer parser adds
 * candidates to reports already promoted (`body_reference` from cag-facts/24,
 * ADR-074), and a reviewer decides them, or revises an earlier decision. This
 * makes the target agree with the source for reports both hold.
 *
 * HOW A FIGURE IN ONE DATABASE IS FOUND IN THE OTHER
 * The two number their rows independently. A figure is matched by the identity
 * the fact loader already reconciles on (ADR-026): its page, kind, the words it
 * was read from, its value and the field it fills, within one report.
 *
 * That identity is not always unique: on 7 October the local ledger held 23
 * groups of figures identical in all five (a sentence stating the same amount
 * twice). Within such a group the n-th figure on one side is matched to the
 * n-th on the other, in id order. Promotion reserves the target's ids in the
 * source's id order, and later additions take later ids on both sides, so the
 * order is the same; and figures that share an identity differ, at most, in
 * where on the page they sit.
 *
 * WHAT IT DOES TO EACH MATCHED REPORT
 *   a candidate the target lacks       inserted, with its decision and history
 *   a decision that differs            copied, with the history the source kept
 *   an undecided candidate the source
 *     no longer produces               removed, as the source removed it
 *   a decided figure the source
 *     no longer produces               kept and counted; a decision is never deleted
 *
 * The target's review-history trigger is disabled while decisions are copied,
 * inside the transaction: the history is the source's, copied row for row, and
 * the trigger would add a transition that never happened.
 *
 * WHAT IT DOES NOT CARRY
 * Figures read from a scan (`page_reading_id`): page readings are not promoted,
 * so such a figure would cite a row the target does not have. They are counted
 * and left for a later decision about promoting readings.
 */

type Row = Record<string, unknown>;

/** The columns a figure's identity is made of (ADR-026), minus the reading. */
export function identityOf(fact: Row): string {
  return JSON.stringify([
    Number(fact["page_number"]),
    fact["kind"],
    fact["raw_text"],
    fact["normalised_value"] ?? null,
    fact["field"] ?? null,
  ]);
}

/** What a reviewer decided, and what the parser last said about the reading. */
const CARRIED_COLUMNS = [
  "verification_status",
  "verified_by",
  "verified_at",
  "corrected_value",
  "reviewer_note",
  "parser_version",
  "extraction_confidence",
  "extraction_method",
  "validation_state",
  "validation_reason",
  "per_unit",
  "bbox_x0",
  "bbox_y0",
  "bbox_x1",
  "bbox_y1",
] as const;

/** Columns an inserted figure takes from the source, as written. */
const INSERTED_COLUMNS = [
  "page_number",
  "kind",
  "raw_text",
  "normalised_value",
  "field",
  ...CARRIED_COLUMNS,
];

const DECIDED = new Set(["verified", "corrected", "rejected"]);

/** One history row's identity within its figure. */
function historyKey(h: Row): string {
  return JSON.stringify([
    h["verification_status"],
    h["verified_by"] ?? null,
    h["verified_at"] ?? null,
    h["corrected_value"] ?? null,
    h["reviewer_note"] ?? null,
  ]);
}

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const fromScan = (f: Row): boolean =>
  f["page_reading_id"] !== null && f["page_reading_id"] !== undefined;

export interface RefreshPlan {
  /** Source figures the target lacks. */
  readonly insert: readonly Row[];
  /** Target figure id, and the columns to set on it. */
  readonly update: readonly { readonly targetId: number; readonly set: Row }[];
  /** Undecided target figures the source no longer has. */
  readonly retire: readonly number[];
  /** Decided target figures the source no longer has: kept, counted. */
  readonly stranded: number;
  /** Source history rows the target lacks, with their figure's identity. */
  readonly history: readonly { readonly identity: string; readonly row: Row }[];
  /** `[figure, the figure it is the same as, or null]` wherever the link differs. */
  readonly links: readonly (readonly [string, string | null])[];
  /** Source figures read from a scan, not carried. */
  readonly scanSkipped: number;
}

export interface FactSide {
  readonly facts: readonly Row[];
  readonly history: readonly Row[];
}

/**
 * Each figure's key: its identity, and its place among figures sharing that
 * identity, in id order (see the module comment).
 */
export function keysOf(facts: readonly Row[]): Map<number, string> {
  const seen = new Map<string, number>();
  const keys = new Map<number, string>();
  for (const f of [...facts].sort((a, b) => Number(a["id"]) - Number(b["id"]))) {
    const identity = identityOf(f);
    const n = seen.get(identity) ?? 0;
    seen.set(identity, n + 1);
    keys.set(Number(f["id"]), `${identity}#${String(n)}`);
  }
  return keys;
}

function indexByKey(facts: readonly Row[], keys: ReadonlyMap<number, string>): Map<string, Row> {
  return new Map(facts.map((f) => [keys.get(Number(f["id"])) ?? "", f]));
}

/** The identity of the figure a figure is the same as, or null. */
function linkOf(fact: Row | undefined, identityById: ReadonlyMap<number, string>): string | null {
  const to = fact?.["same_figure_as"];
  if (to === null || to === undefined) return null;
  return identityById.get(Number(to)) ?? null;
}

interface Indexed {
  readonly src: ReadonlyMap<string, Row>;
  readonly tgt: ReadonlyMap<string, Row>;
  readonly sourceIds: ReadonlyMap<number, string>;
  readonly targetIds: ReadonlyMap<number, string>;
}

/** Source figures the target lacks or holds differently, and links that differ. */
function matched({
  src,
  tgt,
  sourceIds,
  targetIds,
}: Indexed): Pick<RefreshPlan, "insert" | "update" | "links"> {
  const insert: Row[] = [];
  const update: { targetId: number; set: Row }[] = [];
  const links: [string, string | null][] = [];
  for (const [key, s] of src) {
    const t = tgt.get(key);
    if (t === undefined) {
      insert.push(s);
    } else {
      const set: Row = {};
      for (const column of CARRIED_COLUMNS) {
        if (!same(s[column], t[column])) set[column] = s[column] ?? null;
      }
      if (Object.keys(set).length > 0) update.push({ targetId: Number(t["id"]), set });
    }
    const wanted = linkOf(s, sourceIds);
    if (wanted !== linkOf(t, targetIds)) links.push([key, wanted]);
  }
  return { insert, update, links };
}

/** Target figures the source no longer has: undecided ones go, decided ones stay. */
function unmatched({ src, tgt }: Indexed): Pick<RefreshPlan, "retire" | "stranded"> {
  const retire: number[] = [];
  let stranded = 0;
  for (const [key, t] of tgt) {
    if (src.has(key)) continue;
    if (DECIDED.has(String(t["verification_status"]))) stranded++;
    else retire.push(Number(t["id"]));
  }
  return { retire, stranded };
}

/** Source history rows the target lacks. */
function missingHistory(
  source: FactSide,
  target: FactSide,
  { sourceIds, targetIds }: Indexed,
): RefreshPlan["history"] {
  const held = new Set(
    target.history.map(
      (h) => `${targetIds.get(Number(h["document_fact_id"])) ?? ""}|${historyKey(h)}`,
    ),
  );
  const history: { identity: string; row: Row }[] = [];
  for (const h of source.history) {
    const identity = sourceIds.get(Number(h["document_fact_id"]));
    // History of a figure read from a scan stays behind with its figure.
    if (identity !== undefined && !held.has(`${identity}|${historyKey(h)}`)) {
      history.push({ identity, row: h });
    }
  }
  return history;
}

/**
 * What it takes to make the target's report agree with the source's.
 *
 * Pure: two sets of rows in, a plan out.
 */
export function planRefresh(source: FactSide, target: FactSide): RefreshPlan {
  const sourceText = source.facts.filter((f) => !fromScan(f));
  const sourceIds = keysOf(sourceText);
  const targetIds = keysOf(target.facts);
  const indexed: Indexed = {
    src: indexByKey(sourceText, sourceIds),
    tgt: indexByKey(target.facts, targetIds),
    sourceIds,
    targetIds,
  };
  return {
    ...matched(indexed),
    ...unmatched(indexed),
    history: missingHistory(source, target, indexed),
    scanSkipped: source.facts.length - sourceText.length,
  };
}

/** Whether a plan has nothing left to do. */
export function isSettled(plan: RefreshPlan): boolean {
  return (
    plan.insert.length === 0 &&
    plan.update.length === 0 &&
    plan.retire.length === 0 &&
    plan.history.length === 0 &&
    plan.links.length === 0
  );
}

export interface RefreshResult {
  readonly datasetVersionId: number | null;
  /** Reports that differed. */
  readonly reports: number;
  readonly inserted: number;
  readonly updated: number;
  readonly retired: number;
  readonly stranded: number;
  readonly history: number;
  readonly links: number;
  readonly scanSkipped: number;
  readonly committed: boolean;
}

interface Pair {
  readonly sha: string;
  readonly sourceId: number;
  readonly targetId: number;
}

async function rowsAsJson(client: pg.Client, sql: string, params: unknown[]): Promise<Row[]> {
  const result = await client.query<{ rows: Row[] | null }>(
    `SELECT coalesce(json_agg(t), '[]'::json) AS rows FROM (${sql}) t`,
    params,
  );
  return result.rows[0]?.rows ?? [];
}

async function sideOf(client: pg.Client, documentId: number): Promise<FactSide> {
  return {
    facts: await rowsAsJson(
      client,
      `SELECT * FROM document_fact WHERE document_id = $1 ORDER BY id`,
      [documentId],
    ),
    history: await rowsAsJson(
      client,
      `SELECT h.* FROM document_fact_review_history h
         JOIN document_fact f ON f.id = h.document_fact_id
        WHERE f.document_id = $1 ORDER BY h.id`,
      [documentId],
    ),
  };
}

/** Write one report's plan into the target, inside the caller's transaction. */
async function apply(target: pg.Client, documentId: number, plan: RefreshPlan): Promise<void> {
  for (const id of plan.retire) {
    await target.query(
      `DELETE FROM document_fact WHERE id = $1 AND verification_status = 'unverified'`,
      [id],
    );
  }

  const columns = INSERTED_COLUMNS.join(", ");
  const fromRecord = INSERTED_COLUMNS.map((c) => `r.${c}`).join(", ");
  for (const fact of plan.insert) {
    await target.query(
      `INSERT INTO document_fact (document_id, ${columns})
       SELECT $1, ${fromRecord} FROM json_populate_record(NULL::document_fact, $2::json) AS r`,
      [documentId, JSON.stringify(fact)],
    );
  }

  for (const { targetId, set } of plan.update) {
    const assignments = Object.keys(set)
      .map((c) => `${c} = r.${c}`)
      .join(", ");
    await target.query(
      `UPDATE document_fact f SET ${assignments}
         FROM json_populate_record(NULL::document_fact, $2::json) AS r
        WHERE f.id = $1`,
      [targetId, JSON.stringify(set)],
    );
  }

  // Ids by identity, now that every figure exists.
  const now = await rowsAsJson(target, `SELECT * FROM document_fact WHERE document_id = $1`, [
    documentId,
  ]);
  const idOf = new Map([...keysOf(now)].map(([id, key]) => [key, id]));
  const idFor = (identity: string): number => {
    const id = idOf.get(identity);
    if (id === undefined) throw new Error(`The target holds no figure ${identity}.`);
    return id;
  };

  for (const { identity, row } of plan.history) {
    await target.query(
      `INSERT INTO document_fact_review_history
         (document_fact_id, verification_status, verified_by, verified_at, corrected_value,
          reviewer_note, superseded_at)
       SELECT $1, r.verification_status, r.verified_by, r.verified_at, r.corrected_value,
              r.reviewer_note, r.superseded_at
         FROM json_populate_record(NULL::document_fact_review_history, $2::json) AS r`,
      [idFor(identity), JSON.stringify(row)],
    );
  }

  for (const [from, to] of plan.links) {
    await target.query(`UPDATE document_fact SET same_figure_as = $2 WHERE id = $1`, [
      idFor(from),
      to === null ? null : idFor(to),
    ]);
  }
}

export interface RefreshOptions {
  readonly source: pg.Client;
  readonly target: pg.Client;
  readonly dryRun: boolean;
  /** Restrict to these artefacts. Every CAG report both hold when absent. */
  readonly only?: readonly string[];
  readonly now?: Date;
}

async function migrationsOf(client: pg.Client): Promise<string> {
  const r = await client.query<{ id: string }>(`SELECT id FROM schema_migration ORDER BY id`);
  return r.rows.map((m) => m.id).join(",");
}

/** CAG reports both databases hold, each by its id on either side. */
async function heldByBoth(options: RefreshOptions): Promise<Pair[]> {
  const inSource = await options.source.query<{ id: string; sha: string; pages: number }>(
    `SELECT d.id, d.source_sha256 AS sha, d.page_count AS pages
       FROM document d JOIN source_artifact a ON a.sha256 = d.source_sha256
      WHERE a.source_id = 'cag' AND ($1::text[] IS NULL OR d.source_sha256 = ANY($1))
      ORDER BY d.id`,
    [options.only === undefined ? null : [...options.only]],
  );
  const pairs: Pair[] = [];
  for (const s of inSource.rows) {
    const t = await options.target.query<{ id: string; pages: number }>(
      `SELECT id, page_count AS pages FROM document WHERE source_sha256 = $1`,
      [s.sha],
    );
    const row = t.rows[0];
    if (row === undefined) continue; // not promoted yet: that is promote:cag's job
    if (row.pages !== s.pages) {
      throw new PromotionRefused(
        `Report ${s.sha} has ${String(s.pages)} pages in the source and ${String(row.pages)} ` +
          `in the target; it was re-read, and needs promoting again rather than refreshing.`,
      );
    }
    pairs.push({ sha: s.sha, sourceId: Number(s.id), targetId: Number(row.id) });
  }
  return pairs;
}

/** Make the target agree with the source for every CAG report both hold. */
export async function refreshCag(options: RefreshOptions): Promise<RefreshResult> {
  const { source, target } = options;
  if ((await migrationsOf(source)) !== (await migrationsOf(target))) {
    throw new PromotionRefused(
      "The two databases are not on the same migrations. Migrate the one that is behind first.",
    );
  }

  const plans: { pair: Pair; plan: RefreshPlan }[] = [];
  for (const pair of await heldByBoth(options)) {
    const plan = planRefresh(
      await sideOf(source, pair.sourceId),
      await sideOf(target, pair.targetId),
    );
    plans.push({ pair, plan });
  }
  const total = (pick: (p: RefreshPlan) => number): number =>
    plans.reduce((n, { plan }) => n + pick(plan), 0);
  const summary = {
    reports: plans.filter(({ plan }) => !isSettled(plan)).length,
    inserted: total((p) => p.insert.length),
    updated: total((p) => p.update.length),
    retired: total((p) => p.retire.length),
    stranded: total((p) => p.stranded),
    history: total((p) => p.history.length),
    links: total((p) => p.links.length),
    scanSkipped: total((p) => p.scanSkipped),
  };
  if (summary.reports === 0) return { datasetVersionId: null, ...summary, committed: false };

  await target.query("BEGIN");
  try {
    const when = (options.now ?? new Date()).toISOString().slice(0, 10);
    const datasetVersionId = await openDatasetVersion(
      target,
      `CAG review carried from the reviewed ledger on ${when}: ${String(summary.reports)} ` +
        `report(s), ${String(summary.inserted)} figure(s) added, ${String(summary.updated)} ` +
        `updated, ${String(summary.retired)} retired, ${String(summary.history)} history row(s).`,
    );
    // The history is the source's, row for row (see the module comment).
    await target.query(
      `ALTER TABLE document_fact DISABLE TRIGGER document_fact_review_supersession`,
    );
    for (const { pair, plan } of plans) {
      if (!isSettled(plan)) await apply(target, pair.targetId, plan);
    }
    await target.query(
      `ALTER TABLE document_fact ENABLE TRIGGER document_fact_review_supersession`,
    );

    // Done means nothing is left to do: the same plan, made again, is empty.
    for (const { pair } of plans) {
      const again = planRefresh(
        await sideOf(source, pair.sourceId),
        await sideOf(target, pair.targetId),
      );
      if (!isSettled(again)) {
        throw new Error(
          `Report ${pair.sha} still differs after the refresh. Nothing was committed.`,
        );
      }
    }
    await sealDatasetVersion(target, datasetVersionId);
    await target.query(options.dryRun ? "ROLLBACK" : "COMMIT");
    return {
      datasetVersionId: options.dryRun ? null : datasetVersionId,
      ...summary,
      committed: !options.dryRun,
    };
  } catch (error) {
    await target.query("ROLLBACK");
    throw error;
  }
}
