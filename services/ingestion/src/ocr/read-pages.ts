import type pg from "pg";

import type { OcrPageReading, OcrReadRequest, OcrReadResponse } from "@lokdarpan/contracts";

import { openDatasetVersion, sealDatasetVersion } from "../lgd/load";
import type { ReadableRawStore } from "../raw-store";
import type { OcrClient } from "./client";

/**
 * Pages with no text layer, read by the OCR service and stored beside the page
 * (ADR-071).
 *
 * The page's own text is never touched. A scan's `document_page.content`
 * stays NULL, because that is what the file states; an engine's reading goes in
 * `page_reading`, naming the engine, its version, the languages it read and the
 * render it read from. Two engines are two readings and nothing is merged
 * (ADR-038).
 *
 * The bytes are read back from the raw store and verified against their hash
 * before they are sent, and the service verifies them again: a reading is filed
 * only against the document whose bytes it read.
 *
 * The service is optional infrastructure (`client.ts`). If it is down, or no
 * engine is installed, that is reported and nothing is written — a page nobody
 * could read stays a page with no reading, which is a true statement.
 */

/** Both self-hosted engines the service knows. Each that is installed reads every page. */
export const DEFAULT_ENGINES: readonly string[] = ["tesseract", "paddleocr"];
/** MHADA and DGIPR notices mix English and Marathi. Engines that cannot read Marathi say so. */
export const DEFAULT_LANGUAGES: readonly string[] = ["eng", "mar"];
const DEFAULT_DPI = 300;

export interface ReadPagesOptions {
  readonly engines?: readonly string[];
  readonly languages?: readonly string[];
  readonly dpi?: number;
  readonly log?: (line: string) => void;
}

export interface ReadPagesCounts {
  /** Documents with at least one page an installed engine had not read. */
  documents: number;
  /** Pages sent, counted once however many engines read them. */
  pages: number;
  readings: number;
  /** Readings in which the engine found no text at all. */
  empty: number;
  refusals: number;
  /** Documents the service could not be asked about, with nothing written. */
  unavailable: number;
  /** Engines asked for that the service does not have installed. */
  enginesMissing: string[];
}

interface Awaiting {
  readonly document_id: string;
  readonly sha256: string;
  readonly storage_path: string;
  readonly stored_in: string | null;
  readonly pages: number[];
}

interface StoreContext {
  readonly documentId: number;
  readonly contract: string;
  readonly version: number;
}

/**
 * Pages of a source's documents with no text layer that some engine has not
 * read. A refusal does not count as read: the next run asks again.
 */
async function pagesAwaiting(
  db: pg.ClientBase,
  sourceId: string,
  engines: readonly string[],
): Promise<readonly Awaiting[]> {
  const result = await db.query<Awaiting>(
    `SELECT p.document_id, a.sha256, a.storage_path, a.stored_in,
            array_agg(p.page_number ORDER BY p.page_number) AS pages
       FROM document_page p
       JOIN document d ON d.id = p.document_id
       JOIN source_artifact a ON a.sha256 = d.source_sha256
      WHERE a.source_id = $1
        AND p.content IS NULL
        AND EXISTS (
          SELECT 1 FROM unnest($2::text[]) AS e(engine)
           WHERE NOT EXISTS (
             SELECT 1 FROM page_reading r
              WHERE r.document_id = p.document_id AND r.page_number = p.page_number
                AND r.engine = e.engine AND r.refusal IS NULL))
      GROUP BY p.document_id, a.sha256, a.storage_path, a.stored_in
      ORDER BY p.document_id`,
    [sourceId, engines],
  );
  return result.rows;
}

/** A standing refusal for a page and engine, withdrawn. */
async function withdrawRefusal(
  db: pg.ClientBase,
  documentId: number,
  page: number,
  engine: string,
): Promise<void> {
  await db.query(
    `DELETE FROM page_reading
      WHERE document_id = $1 AND page_number = $2 AND engine = $3 AND refusal IS NOT NULL`,
    [documentId, page, engine],
  );
}

/** One reading and its words. False if the same reading is already held. */
async function storeReading(
  db: pg.ClientBase,
  context: StoreContext,
  reading: OcrPageReading,
): Promise<boolean> {
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO page_reading (document_id, page_number, contract_version, engine, engine_version,
                               model_versions, languages, dpi, raster_width, raster_height,
                               page_width, page_height, rotation, content, dataset_version_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (document_id, page_number, engine, engine_version, languages, dpi)
       WHERE refusal IS NULL DO NOTHING
     RETURNING id`,
    [
      context.documentId,
      reading.page_number,
      context.contract,
      reading.engine.name,
      reading.engine.version,
      JSON.stringify(reading.engine.model_versions),
      reading.engine.languages,
      reading.render.dpi,
      reading.render.raster_width,
      reading.render.raster_height,
      reading.render.page_width,
      reading.render.page_height,
      reading.render.rotation,
      reading.content,
      context.version,
    ],
  );
  const id = inserted.rows[0]?.id;
  if (id === undefined) return false;

  for (const item of reading.items) {
    await db.query(
      `INSERT INTO page_reading_item (reading_id, seq, char_start, char_end, x0, y0, x1, y1, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        item.seq,
        item.char_start,
        item.char_end,
        item.x0,
        item.y0,
        item.x1,
        item.y1,
        item.confidence,
      ],
    );
  }
  // The engine has now read the page; an earlier refusal no longer stands.
  await withdrawRefusal(db, context.documentId, reading.page_number, reading.engine.name);
  return true;
}

/** A refusal, stated against each page it covers, replacing any earlier one. */
async function storeRefusal(
  db: pg.ClientBase,
  context: StoreContext,
  refusal: { readonly engine: string; readonly reason: string; readonly pages: readonly number[] },
): Promise<number> {
  for (const page of refusal.pages) {
    await withdrawRefusal(db, context.documentId, page, refusal.engine);
    await db.query(
      `INSERT INTO page_reading (document_id, page_number, contract_version, engine, refusal,
                                 dataset_version_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [context.documentId, page, context.contract, refusal.engine, refusal.reason, context.version],
    );
  }
  return refusal.pages.length;
}

/** Everything one response states, stored. A whole-document refusal covers every page asked for. */
export async function storeResponse(
  db: pg.ClientBase,
  context: { readonly documentId: number; readonly version: number },
  request: OcrReadRequest,
  response: OcrReadResponse,
): Promise<{ readings: number; empty: number; refusals: number }> {
  const stored: StoreContext = { ...context, contract: response.contract_version };
  const counts = { readings: 0, empty: 0, refusals: 0 };
  for (const reading of response.readings) {
    if (await storeReading(db, stored, reading)) {
      counts.readings += 1;
      counts.empty += reading.content.trim() === "" ? 1 : 0;
    }
  }
  for (const refusal of response.refusals) {
    const pages = refusal.page_number === null ? request.page_numbers : [refusal.page_number];
    counts.refusals += await storeRefusal(db, stored, { ...refusal, pages });
  }
  return counts;
}

/** The engines asked for that the service has installed, and those it has not. */
async function installedEngines(
  client: OcrClient,
  wanted: readonly string[],
): Promise<{ installed: string[]; missing: string[] } | { unavailable: string }> {
  const capabilities = await client.capabilities();
  if (!capabilities.ok) return { unavailable: capabilities.unavailable };
  const available = new Set(
    capabilities.value.engines.filter((e) => e.available).map((e) => e.name),
  );
  return {
    installed: wanted.filter((e) => available.has(e)),
    missing: wanted.filter((e) => !available.has(e)),
  };
}

function emptyCounts(): ReadPagesCounts {
  return {
    documents: 0,
    pages: 0,
    readings: 0,
    empty: 0,
    refusals: 0,
    unavailable: 0,
    enginesMissing: [],
  };
}

/** Send every page of a source that lacks a reading to the OCR service, and store what comes back. */
export async function readUnreadPages(
  sourceId: string,
  context: {
    readonly db: pg.ClientBase;
    readonly store: ReadableRawStore;
    readonly client: OcrClient;
  },
  options: ReadPagesOptions = {},
): Promise<ReadPagesCounts> {
  const { db, store, client } = context;
  const log = options.log ?? ((): void => undefined);
  const counts = emptyCounts();

  const engines = await installedEngines(client, options.engines ?? DEFAULT_ENGINES);
  if ("unavailable" in engines) {
    log(`OCR service not available: ${engines.unavailable}`);
    counts.unavailable = 1;
    return counts;
  }
  counts.enginesMissing = engines.missing;
  if (engines.installed.length === 0) return counts;

  const awaiting = await pagesAwaiting(db, sourceId, engines.installed);
  if (awaiting.length === 0) return counts;

  const version = await openDatasetVersion(
    db,
    `${sourceId} pages read by OCR ${new Date().toISOString()}`,
  );
  for (const document of awaiting) {
    if (document.stored_in !== store.location) {
      log(`not read ${document.sha256.slice(0, 12)}: held in ${String(document.stored_in)}`);
      counts.unavailable += 1;
      continue;
    }
    const request: OcrReadRequest = {
      contract_version: "ocr/1",
      document_sha256: document.sha256,
      page_numbers: document.pages,
      engines: engines.installed,
      languages: [...(options.languages ?? DEFAULT_LANGUAGES)],
      dpi: options.dpi ?? DEFAULT_DPI,
    };
    const bytes = await store.get(document.storage_path, document.sha256);
    const outcome = await client.read(request, bytes);
    if (!outcome.ok) {
      log(`not read ${document.sha256.slice(0, 12)}: ${outcome.unavailable}`);
      counts.unavailable += 1;
      continue;
    }
    const stored = await storeResponse(
      db,
      { documentId: Number(document.document_id), version },
      request,
      outcome.value,
    );
    counts.documents += 1;
    counts.pages += document.pages.length;
    counts.readings += stored.readings;
    counts.empty += stored.empty;
    counts.refusals += stored.refusals;
  }
  await sealDatasetVersion(db, version);
  return counts;
}
