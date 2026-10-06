import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readingsOfScannedPages } from "../src/ocr/scan-facts";

const DATABASE_URL = process.env["DATABASE_URL"];
const SHA = "cd".repeat(32);

/** A scanned page's readings read back for its parser, in a rolled-back transaction. */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "reading a scanned page's readings back (integration)",
  { timeout: 60_000 },
  () => {
    let pool: pg.Pool | undefined;
    let db: pg.PoolClient | undefined;
    let documentId = 0;

    const sql = (): pg.PoolClient => {
      if (db === undefined) throw new Error("the test transaction was not opened");
      return db;
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
      db = await pool.connect();
      await db.query("BEGIN");
      await db.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, http_status,
                                      content_type, byte_size, storage_path, stored_in)
         VALUES ($1, 'test-scan-facts', 'https://example.invalid/r.pdf', now(), 200,
                 'application/pdf', 1, 'test/r.pdf', 'file')`,
        [SHA],
      );
      const version = await db.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('scan facts test') RETURNING id`,
      );
      const document = await db.query<{ id: string }>(
        `INSERT INTO document (doc_type, title, issuing_authority, source_sha256, dataset_version_id,
                               mime_type, page_count, pages_without_text, extraction_method)
         VALUES ('audit_report', 'A report with a scanned annexure', 'An auditor', $1, $2,
                 'application/pdf', 2, 1, 'test fixture')
         RETURNING id`,
        [SHA, Number(version.rows[0]?.id)],
      );
      documentId = Number(document.rows[0]?.id);
      await db.query(
        `INSERT INTO document_page (document_id, page_number, content, script)
         VALUES ($1, 1, 'typed text', 'latin'), ($1, 2, NULL, 'none')`,
        [documentId],
      );
      // Both pages have a reading; only the scanned one is read back.
      for (const page of [1, 2]) {
        const reading = await db.query<{ id: string }>(
          `INSERT INTO page_reading (document_id, page_number, contract_version, engine,
                                     engine_version, model_versions, languages, dpi,
                                     raster_width, raster_height, page_width, page_height,
                                     rotation, content, dataset_version_id)
           VALUES ($1, $2, 'ocr/1', 'tesseract', '5.5.3', '{}', '{eng}', 300,
                   2480, 3508, 595.276, 841.89, 0, '₹ 15.14 crore', $3)
           RETURNING id`,
          [documentId, page, Number(version.rows[0]?.id)],
        );
        await db.query(
          `INSERT INTO page_reading_item (reading_id, seq, char_start, char_end, x0, y0, x1, y1, confidence)
           VALUES ($1, 0, 0, 13, 90, 700, 150, 712, 0.8)`,
          [Number(reading.rows[0]?.id)],
        );
      }
    });

    afterAll(async () => {
      await db?.query("ROLLBACK");
      db?.release();
      await pool?.end();
    });

    it("reads back the readings of scanned pages only, with their words", async () => {
      const readings = await readingsOfScannedPages(sql(), documentId);
      expect(readings.map((r) => r.pageNumber)).toEqual([2]);
      expect(readings[0]).toMatchObject({
        engine: "tesseract",
        engineVersion: "5.5.3",
        content: "₹ 15.14 crore",
      });
      expect(readings[0]?.words).toEqual([
        { seq: 0, charStart: 0, charEnd: 13, x0: 90, y0: 700, x1: 150, y1: 712, confidence: 0.8 },
      ]);
    });

    it("reads nothing back for a document with no readings", async () => {
      expect(await readingsOfScannedPages(sql(), -1)).toEqual([]);
    });
  },
);
