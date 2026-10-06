import type pg from "pg";

import type { TextItem } from "../cag/extract";
import type { FactCandidate } from "../cag/facts";

/**
 * Facts read from a scanned page's OCR reading, by a parser written for text
 * layers (ADR-071, ADR-072).
 *
 * A reading's words are stored in the shape a text layer's items are — a
 * character span and a box in PDF points — so a parser that locates a figure
 * from items locates it from a reading unchanged. What changes is what the
 * result is: an engine's guess at the ink, not the publisher's text. Each
 * candidate is turned into the different claim it is here, in one place, so no
 * parser can forget part of it.
 */

/** A reading's word: a text item, with the engine's confidence in it. */
export interface ReadingWord extends TextItem {
  readonly confidence: number;
}

/** One engine's reading of a page that has no text layer. */
export interface ScanReading {
  readonly id: number;
  readonly pageNumber: number;
  readonly engine: string;
  readonly engineVersion: string;
  readonly content: string;
  readonly words: readonly ReadingWord[];
}

/** Every reading of a document's pages that have no text of their own. */
export async function readingsOfScannedPages(
  db: pg.ClientBase,
  documentId: number,
): Promise<ScanReading[]> {
  const readings = await db.query<{
    id: string;
    page_number: number;
    engine: string;
    engine_version: string;
    content: string;
  }>(
    `SELECT r.id, r.page_number, r.engine, r.engine_version, r.content
       FROM page_reading r
       JOIN document_page p ON p.document_id = r.document_id AND p.page_number = r.page_number
      WHERE r.document_id = $1 AND p.content IS NULL AND r.refusal IS NULL
      ORDER BY r.page_number, r.id`,
    [documentId],
  );
  if (readings.rows.length === 0) return [];
  const words = await db.query<{
    reading_id: string;
    seq: number;
    char_start: number;
    char_end: number;
    x0: string;
    y0: string;
    x1: string;
    y1: string;
    confidence: string;
  }>(
    `SELECT reading_id, seq, char_start, char_end, x0, y0, x1, y1, confidence
       FROM page_reading_item WHERE reading_id = ANY($1::bigint[]) ORDER BY reading_id, seq`,
    [readings.rows.map((r) => r.id)],
  );
  const byReading = new Map<string, ReadingWord[]>();
  for (const w of words.rows) {
    const list = byReading.get(w.reading_id) ?? [];
    list.push({
      seq: w.seq,
      charStart: w.char_start,
      charEnd: w.char_end,
      x0: Number(w.x0),
      y0: Number(w.y0),
      x1: Number(w.x1),
      y1: Number(w.y1),
      confidence: Number(w.confidence),
    });
    byReading.set(w.reading_id, list);
  }
  return readings.rows.map((r) => ({
    id: Number(r.id),
    pageNumber: r.page_number,
    engine: r.engine,
    engineVersion: r.engine_version,
    content: r.content,
    words: byReading.get(r.id) ?? [],
  }));
}

/** Whether two boxes in PDF points share any area. */
function overlaps(
  a: { x0: number; y0: number; x1: number; y1: number },
  b: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/**
 * A candidate a parser read from a reading, made into a scan fact.
 *
 * It names the reading and the engine, is always marked for review, and its
 * legibility is the engine's least confidence among the words inside the
 * figure's box — the figure, as the parser located it, not the sentence round
 * it. Its extraction confidence is scaled by the same. A candidate the parser
 * could not give a box has no legibility measured, and a scan fact without one
 * is never published (migration 0044).
 */
export function asScanFact(candidate: FactCandidate, reading: ScanReading): FactCandidate {
  const box = candidate.box;
  const under = box === undefined ? [] : reading.words.filter((w) => overlaps(w, box));
  const weakest = under.reduce((least, w) => Math.min(least, w.confidence), 1);
  const engine = `${reading.engine} ${reading.engineVersion}`;
  const reason = [
    `read from an OCR reading (${engine}); check it against the page image`,
    candidate.validation.reason,
  ]
    .filter((part) => part !== "")
    .join("; ");
  return {
    ...candidate,
    extractionConfidence:
      under.length === 0
        ? candidate.extractionConfidence
        : Math.round(candidate.extractionConfidence * weakest * 1000) / 1000,
    validation: { state: "needs_review", reason },
    pageReadingId: reading.id,
    extractionMethod: `regex over OCR reading (${engine})`,
    ...(under.length === 0 ? {} : { readingConfidence: weakest }),
  };
}
