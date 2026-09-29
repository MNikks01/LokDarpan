import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type pg from "pg";

import { openDatasetVersion, sealDatasetVersion } from "../lgd/load";
import { sha256Of, type RawStore } from "../raw-store";

/**
 * Copies the reviewed CAG ledger from one database to another.
 *
 * WHY A COPY AND NOT A RE-RUN
 * Every figure a reader may see was decided by a person, and those decisions
 * live only in the database the review was done against. Running the pipeline
 * again elsewhere would re-download and re-extract the reports and arrive with
 * every candidate unverified — none of it publishable. So the reviewed rows are
 * carried across, with who decided each one and when.
 *
 * WHAT IS NOT CARRIED
 * `document_text_item`: the position of every text run on every page, which
 * the extractor reads while finding figures. A published figure keeps its own
 * rectangle (`document_fact.bbox_*`), so a reader loses nothing, and the table
 * is 361 MB against a 512 MB database. Re-extraction happens where the review
 * happens, not in production.
 *
 * WHAT MUST HOLD FIRST
 * Both databases on the same migrations; every document's place present in the
 * target; the bytes of every report on hand and hashing to their address. Each
 * is checked before anything is written, and the copy is one transaction whose
 * counts are compared with the source before it commits.
 */

export interface PromoteOptions {
  readonly source: pg.Client;
  readonly target: pg.Client;
  readonly store: RawStore;
  /** Where the source's `storage_path` values resolve on this machine. */
  readonly rawRoot: string;
  /** Roll back instead of committing, after every check has run. */
  readonly dryRun: boolean;
  /** Restrict to these artefacts. Every CAG report in the source when absent. */
  readonly only?: readonly string[];
  /** Recorded on the dataset version, so the target says when this happened. */
  readonly now?: Date;
}

export interface PromoteResult {
  readonly datasetVersionId: number | null;
  readonly documents: number;
  readonly pages: number;
  readonly facts: number;
  readonly published: number;
  readonly history: number;
  /** Reports already in the target, by artefact hash. Left untouched. */
  readonly alreadyPresent: readonly string[];
  /** Same-figure links whose other half was not promoted in this run. */
  readonly linksNotCarried: number;
  readonly committed: boolean;
}

export class PromotionRefused extends Error {}

interface SourceDocument {
  readonly id: number;
  readonly sourceSha256: string;
  readonly storagePath: string;
  readonly contentType: string | null;
  readonly unitLevel: string | null;
  readonly unitLgdCode: string | null;
}

type Row = Record<string, unknown>;

async function migrationsOf(client: pg.Client): Promise<string> {
  const result = await client.query<{ id: string }>(`SELECT id FROM schema_migration ORDER BY id`);
  return result.rows.map((r) => r.id).join(",");
}

/** Rows as Postgres renders them: exact numerics, full timestamp precision. */
async function rowsAsJson(client: pg.Client, sql: string, params: unknown[]): Promise<Row[]> {
  const result = await client.query<{ rows: Row[] | null }>(
    `SELECT coalesce(json_agg(t), '[]'::json) AS rows FROM (${sql}) t`,
    params,
  );
  return result.rows[0]?.rows ?? [];
}

/** `n` ids from the target's own sequence, so no row is numbered by guesswork. */
async function reserveIds(client: pg.Client, table: string, n: number): Promise<number[]> {
  if (n === 0) return [];
  const result = await client.query<{ id: string }>(
    `SELECT nextval(pg_get_serial_sequence($1, 'id'))::text AS id FROM generate_series(1, $2)`,
    [table, n],
  );
  return result.rows.map((r) => Number(r.id));
}

type PromotedTable =
  "document" | "document_page" | "document_fact" | "document_fact_review_history";

async function insertRows(
  client: pg.Client,
  table: PromotedTable,
  rows: readonly Row[],
): Promise<void> {
  if (rows.length === 0) return;
  // `table` is one of four literals, never input.
  await client.query(
    `INSERT INTO ${table} OVERRIDING SYSTEM VALUE
     SELECT * FROM json_populate_recordset(NULL::${table}, $1::json)`,
    [JSON.stringify(rows)],
  );
}

/**
 * Every id a promoted figure carries, rewritten for the target.
 *
 * Pure, so the rewriting can be checked without two databases. A same-figure
 * link to a figure outside this run is dropped and counted, never pointed at
 * whatever happens to hold that number in the target.
 */
export function remapFacts(
  facts: readonly Row[],
  factIds: ReadonlyMap<number, number>,
  documentIds: ReadonlyMap<number, number>,
): { rows: Row[]; links: [number, number][]; dropped: number } {
  const links: [number, number][] = [];
  let dropped = 0;
  const rows = facts.map((fact) => {
    const from = Number(fact["id"]);
    const id = factIds.get(from);
    const documentId = documentIds.get(Number(fact["document_id"]));
    if (id === undefined || documentId === undefined) {
      throw new Error(`Figure ${String(from)} has no id reserved for it in the target.`);
    }
    const same = fact["same_figure_as"];
    if (same !== null && same !== undefined) {
      const to = factIds.get(Number(same));
      if (to === undefined) dropped++;
      else links.push([id, to]);
    }
    // The link is written after every figure exists: it may point forward.
    return { ...fact, id, document_id: documentId, same_figure_as: null };
  });
  return { rows, links, dropped };
}

async function sourceDocuments(
  source: pg.Client,
  only: readonly string[] | undefined,
): Promise<SourceDocument[]> {
  const result = await source.query<{
    id: string;
    source_sha256: string;
    storage_path: string;
    content_type: string | null;
    level: string | null;
    lgd_code: string | null;
  }>(
    `SELECT d.id, d.source_sha256, a.storage_path, a.content_type,
            u.level::text AS level, u.lgd_code
       FROM document d
       JOIN source_artifact a ON a.sha256 = d.source_sha256
       LEFT JOIN admin_unit u ON u.id = d.admin_unit_id
      WHERE a.source_id = 'cag'
        AND ($1::text[] IS NULL OR d.source_sha256 = ANY($1))
      ORDER BY d.id`,
    [only === undefined ? null : [...only]],
  );
  return result.rows.map((r) => ({
    id: Number(r.id),
    sourceSha256: r.source_sha256,
    storagePath: r.storage_path,
    contentType: r.content_type,
    unitLevel: r.level,
    unitLgdCode: r.lgd_code,
  }));
}

/** The target's id for each document's place, found by LGD code, never by number. */
async function placesInTarget(
  target: pg.Client,
  documents: readonly SourceDocument[],
): Promise<Map<number, number | null>> {
  const places = new Map<number, number | null>();
  for (const doc of documents) {
    if (doc.unitLgdCode === null || doc.unitLevel === null) {
      places.set(doc.id, null);
      continue;
    }
    const found = await target.query<{ id: string }>(
      `SELECT id FROM admin_unit WHERE lgd_code = $1 AND level = $2::admin_unit_level`,
      [doc.unitLgdCode, doc.unitLevel],
    );
    const id = found.rows[0]?.id;
    if (id === undefined) {
      throw new PromotionRefused(
        `Document ${String(doc.id)} is attributed to ${doc.unitLevel} ${doc.unitLgdCode}, ` +
          `which the target does not hold. Load that geography first; a report is not filed under a guess.`,
      );
    }
    places.set(doc.id, Number(id));
  }
  return places;
}

/** Reads a report's bytes and checks them before anything is written. */
async function bytesOf(rawRoot: string, doc: SourceDocument): Promise<Buffer> {
  let bytes: Buffer;
  try {
    bytes = await readFile(join(rawRoot, doc.storagePath));
  } catch {
    throw new PromotionRefused(
      `The bytes of document ${String(doc.id)} are not at ${doc.storagePath}; nothing was written.`,
    );
  }
  if (sha256Of(bytes) !== doc.sourceSha256) {
    throw new PromotionRefused(
      `${doc.storagePath} does not hash to the artefact it is filed under; nothing was written.`,
    );
  }
  return bytes;
}

interface Counts {
  readonly documents: number;
  readonly pages: number;
  readonly facts: number;
  readonly published: number;
  readonly history: number;
}

async function countsIn(client: pg.Client, shas: readonly string[]): Promise<Counts> {
  const result = await client.query<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM document WHERE source_sha256 = ANY($1)) AS documents,
       (SELECT count(*) FROM document_page p JOIN document d ON d.id = p.document_id
         WHERE d.source_sha256 = ANY($1)) AS pages,
       (SELECT count(*) FROM document_fact f JOIN document d ON d.id = f.document_id
         WHERE d.source_sha256 = ANY($1)) AS facts,
       (SELECT count(*) FROM published_fact p JOIN document d ON d.id = p.document_id
         WHERE d.source_sha256 = ANY($1)) AS published,
       (SELECT count(*) FROM document_fact_review_history h
          JOIN document_fact f ON f.id = h.document_fact_id
          JOIN document d ON d.id = f.document_id
         WHERE d.source_sha256 = ANY($1)) AS history`,
    [[...shas]],
  );
  const row = result.rows[0] ?? {};
  return {
    documents: Number(row["documents"]),
    pages: Number(row["pages"]),
    facts: Number(row["facts"]),
    published: Number(row["published"]),
    history: Number(row["history"]),
  };
}

async function copyArtifacts(
  source: pg.Client,
  target: pg.Client,
  shas: readonly string[],
  storedIn: string,
): Promise<void> {
  const artifacts = await rowsAsJson(
    source,
    `SELECT * FROM source_artifact WHERE sha256 = ANY($1)`,
    [[...shas]],
  );
  for (const a of artifacts) {
    await target.query(
      `INSERT INTO source_artifact
         (sha256, source_id, source_url, retrieved_at, http_status, content_type, byte_size,
          storage_path, stored_in)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (sha256) DO NOTHING`,
      [
        a["sha256"],
        a["source_id"],
        a["source_url"],
        a["retrieved_at"],
        a["http_status"],
        a["content_type"],
        a["byte_size"],
        a["storage_path"],
        storedIn,
      ],
    );
  }
}

/** Documents, pages, figures and history, in one open transaction. */
async function copyLedger(
  options: PromoteOptions,
  documents: readonly SourceDocument[],
  places: ReadonlyMap<number, number | null>,
  datasetVersionId: number,
): Promise<number> {
  const { source, target } = options;
  const sourceIds = documents.map((d) => d.id);

  const documentIds = new Map<number, number>();
  const reservedDocuments = await reserveIds(target, "document", documents.length);
  documents.forEach((doc, i) => {
    const id = reservedDocuments[i];
    if (id !== undefined) documentIds.set(doc.id, id);
  });
  const documentRows = (
    await rowsAsJson(source, `SELECT * FROM document WHERE id = ANY($1) ORDER BY id`, [sourceIds])
  ).map((row) => {
    const from = Number(row["id"]);
    return {
      ...row,
      id: documentIds.get(from),
      dataset_version_id: datasetVersionId,
      admin_unit_id: places.get(from) ?? null,
    };
  });
  await insertRows(target, "document", documentRows);

  for (const doc of documents) {
    const pages = await rowsAsJson(
      source,
      `SELECT * FROM document_page WHERE document_id = $1 ORDER BY page_number`,
      [doc.id],
    );
    const pageIds = await reserveIds(target, "document_page", pages.length);
    await insertRows(
      target,
      "document_page",
      pages.map((page, i) => ({ ...page, id: pageIds[i], document_id: documentIds.get(doc.id) })),
    );
  }

  const facts = await rowsAsJson(
    source,
    `SELECT * FROM document_fact WHERE document_id = ANY($1) ORDER BY id`,
    [sourceIds],
  );
  const reservedFacts = await reserveIds(target, "document_fact", facts.length);
  const factIds = new Map<number, number>();
  facts.forEach((fact, i) => {
    const id = reservedFacts[i];
    if (id !== undefined) factIds.set(Number(fact["id"]), id);
  });
  const { rows: factRows, links, dropped } = remapFacts(facts, factIds, documentIds);
  for (let i = 0; i < factRows.length; i += 2_000) {
    await insertRows(target, "document_fact", factRows.slice(i, i + 2_000));
  }
  if (links.length > 0) {
    // Only `same_figure_as` changes, which the review trigger ignores: this
    // writes no history row.
    await target.query(
      `UPDATE document_fact f SET same_figure_as = l.to_id
         FROM json_to_recordset($1::json) AS l(from_id bigint, to_id bigint)
        WHERE f.id = l.from_id`,
      [JSON.stringify(links.map(([fromId, toId]) => ({ from_id: fromId, to_id: toId })))],
    );
  }

  const history = await rowsAsJson(
    source,
    `SELECT h.* FROM document_fact_review_history h
       JOIN document_fact f ON f.id = h.document_fact_id
      WHERE f.document_id = ANY($1) ORDER BY h.id`,
    [sourceIds],
  );
  const historyIds = await reserveIds(target, "document_fact_review_history", history.length);
  await insertRows(
    target,
    "document_fact_review_history",
    history.map((row, i) => ({
      ...row,
      id: historyIds[i],
      document_fact_id: factIds.get(Number(row["document_fact_id"])),
    })),
  );

  return dropped;
}

export async function promoteCag(options: PromoteOptions): Promise<PromoteResult> {
  const { source, target, store } = options;

  if ((await migrationsOf(source)) !== (await migrationsOf(target))) {
    throw new PromotionRefused(
      "The two databases are not on the same migrations. Migrate the one that is behind first.",
    );
  }

  const all = await sourceDocuments(source, options.only);
  const present = await target.query<{ source_sha256: string }>(
    `SELECT source_sha256 FROM document WHERE source_sha256 = ANY($1)`,
    [all.map((d) => d.sourceSha256)],
  );
  const alreadyPresent = present.rows.map((r) => r.source_sha256);
  const documents = all.filter((d) => !alreadyPresent.includes(d.sourceSha256));
  if (documents.length === 0) {
    return {
      datasetVersionId: null,
      documents: 0,
      pages: 0,
      facts: 0,
      published: 0,
      history: 0,
      alreadyPresent,
      linksNotCarried: 0,
      committed: false,
    };
  }

  // Everything that could refuse is checked before the first write.
  const places = await placesInTarget(target, documents);
  const bytes = new Map<number, Buffer>();
  for (const doc of documents) bytes.set(doc.id, await bytesOf(options.rawRoot, doc));

  // The bytes go first and outside the transaction: the store is append-only
  // and content-addressed, so a rolled-back run leaves nothing a later run
  // would disagree with.
  for (const doc of documents) {
    const body = bytes.get(doc.id);
    if (body !== undefined)
      await store.put(doc.storagePath, body, doc.sourceSha256, doc.contentType);
  }

  const shas = documents.map((d) => d.sourceSha256);
  const expected = await countsIn(source, shas);

  await target.query("BEGIN");
  try {
    const when = (options.now ?? new Date()).toISOString().slice(0, 10);
    const datasetVersionId = await openDatasetVersion(
      target,
      `CAG corpus promoted from the reviewed ledger on ${when}: ${String(documents.length)} ` +
        `report(s) with their pages, figures and review history. Page text-item geometry is ` +
        `not carried; each figure keeps its own rectangle.`,
    );
    await copyArtifacts(source, target, shas, store.location);
    const linksNotCarried = await copyLedger(options, documents, places, datasetVersionId);
    await sealDatasetVersion(target, datasetVersionId);

    // The figures a reader will see must be exactly the ones reviewed.
    const actual = await countsIn(target, shas);
    for (const key of ["documents", "pages", "facts", "published", "history"] as const) {
      if (actual[key] !== expected[key]) {
        throw new Error(
          `Promotion disagrees with its source on ${key}: ${String(actual[key])} written, ` +
            `${String(expected[key])} expected. Nothing was committed.`,
        );
      }
    }

    await target.query(options.dryRun ? "ROLLBACK" : "COMMIT");
    return {
      datasetVersionId: options.dryRun ? null : datasetVersionId,
      ...actual,
      alreadyPresent,
      linksNotCarried,
      committed: !options.dryRun,
    };
  } catch (error) {
    await target.query("ROLLBACK");
    throw error;
  }
}
