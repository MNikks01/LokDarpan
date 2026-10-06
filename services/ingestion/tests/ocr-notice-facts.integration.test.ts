import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readNoticeFacts, type NoticeFactCounts } from "../src/maharashtra/notice-facts";

const DATABASE_URL = process.env["DATABASE_URL"];
const SOURCE = "test-ocr-notice-facts";
const SHA = "ab".repeat(32);

/**
 * Facts read from a scan's OCR reading, stored as the different claim they are
 * (ADR-072).
 *
 * One notice of two pages: page 1 has a text layer, page 2 is a scan with one
 * Tesseract reading. Everything happens inside a rolled-back transaction.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "facts read from a scan's OCR reading (integration)",
  { timeout: 60_000 },
  () => {
    let pool: pg.Pool | undefined;
    let db: pg.PoolClient | undefined;
    let documentId = 0;
    let readingId = 0;
    let first: NoticeFactCounts | undefined;
    let again: NoticeFactCounts | undefined;

    /** The transaction every test runs in, opened by `beforeAll`. */
    const sql = (): pg.PoolClient => {
      if (db === undefined) throw new Error("the test transaction was not opened");
      return db;
    };

    const facts = async (): Promise<
      { field: string; page_number: number; page_reading_id: string | null; status: string }[]
    > =>
      (
        await sql().query<{
          field: string;
          page_number: number;
          page_reading_id: string | null;
          status: string;
        }>(
          `SELECT field, page_number, page_reading_id, verification_status AS status
             FROM document_fact WHERE document_id = $1 ORDER BY page_number, field`,
          [documentId],
        )
      ).rows;

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
      const client = await pool.connect();
      db = client;
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, http_status,
                                      content_type, byte_size, storage_path, stored_in)
         VALUES ($1, $2, 'https://example.invalid/notice.pdf', now(), 200, 'application/pdf',
                 1, 'test/notice.pdf', 'file')`,
        [SHA, SOURCE],
      );
      const version = await client.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('ocr notice facts test') RETURNING id`,
      );
      const versionId = Number(version.rows[0]?.id);
      const document = await client.query<{ id: string }>(
        `INSERT INTO document (doc_type, title, issuing_authority, source_sha256, dataset_version_id,
                               mime_type, page_count, pages_without_text, extraction_method)
         VALUES ('tender_notice', 'A notice, half scanned', 'An agency', $1, $2,
                 'application/pdf', 2, 1, 'test fixture')
         RETURNING id`,
        [SHA, versionId],
      );
      documentId = Number(document.rows[0]?.id);
      await client.query(
        `INSERT INTO document_page (document_id, page_number, content, script)
         VALUES ($1, 1, 'Pre-Bid Meeting: 07/08/2024', 'latin'),
                ($1, 2, NULL, 'none')`,
        [documentId],
      );

      const content = "जाहिरात दिनांक २९.०९.२०२६";
      const reading = await client.query<{ id: string }>(
        `INSERT INTO page_reading (document_id, page_number, contract_version, engine,
                                   engine_version, model_versions, languages, dpi,
                                   raster_width, raster_height, page_width, page_height,
                                   rotation, content, dataset_version_id)
         VALUES ($1, 2, 'ocr/1', 'tesseract', '5.5.3', '{}', '{eng,mar}', 300,
                 2480, 3508, 595.276, 841.89, 0, $2, $3)
         RETURNING id`,
        [documentId, content, versionId],
      );
      readingId = Number(reading.rows[0]?.id);
      const date = content.indexOf("२९");
      await client.query(
        `INSERT INTO page_reading_item (reading_id, seq, char_start, char_end, x0, y0, x1, y1, confidence)
         VALUES ($1, 0, 0, $2, 10, 700, 80, 712, 0.9),
                ($1, 1, $3, $4, 90, 700, 150, 712, 0.8)`,
        [readingId, date - 1, date, content.length],
      );

      first = await readNoticeFacts(client, SOURCE);
      again = await readNoticeFacts(client, SOURCE);
    });

    afterAll(async () => {
      await db?.query("ROLLBACK");
      db?.release();
      await pool?.end();
    });

    it("reads the text layer and the scan's reading in one pass", async () => {
      expect(first).toMatchObject({ documents: 1, withFacts: 1, inserted: 2 });
      expect(await facts()).toEqual([
        { field: "pre_bid_meeting", page_number: 1, page_reading_id: null, status: "unverified" },
        {
          field: "publish",
          page_number: 2,
          page_reading_id: String(readingId),
          status: "unverified",
        },
      ]);
    });

    it("re-reads without the two retiring each other", () => {
      expect(again).toMatchObject({ inserted: 0, retired: 0 });
    });

    it("records the engine and the figures' box on the scan's fact", async () => {
      const row = await sql().query<{
        extraction_method: string;
        extraction_confidence: string;
        validation_state: string;
        bbox_x0: string;
        bbox_x1: string;
      }>(
        `SELECT extraction_method, extraction_confidence, validation_state, bbox_x0, bbox_x1
           FROM document_fact WHERE page_reading_id = $1`,
        [readingId],
      );
      expect(row.rows[0]).toMatchObject({
        extraction_method: "labelled fields over OCR reading (tesseract 5.5.3)",
        extraction_confidence: "0.680",
        validation_state: "needs_review",
        bbox_x0: "90.000",
        bbox_x1: "150.000",
      });
    });

    it("withholds a verified fact read from a scan, and publishes the text layer's", async () => {
      await sql().query(
        `UPDATE document_fact
            SET verification_status = 'verified', verified_by = 'a reviewer', verified_at = now()
          WHERE document_id = $1`,
        [documentId],
      );
      const published = await sql().query<{ page_number: number }>(
        `SELECT page_number FROM published_fact WHERE document_id = $1`,
        [documentId],
      );
      expect(published.rows.map((r) => r.page_number)).toEqual([1]);
    });

    it("refuses a fact that cites a reading of another page", async () => {
      await sql().query("SAVEPOINT wrong_page");
      await expect(
        sql().query(
          `INSERT INTO document_fact (document_id, page_number, kind, raw_text, extraction_method,
                                      parser_version, extraction_confidence, page_reading_id)
           VALUES ($1, 1, 'tender_date', 'x', 'test', 'test', 0.5, $2)`,
          [documentId, readingId],
        ),
      ).rejects.toThrow(/document_fact_read_from_its_page_reading/u);
      await sql().query("ROLLBACK TO SAVEPOINT wrong_page");
    });

    it("takes a reading's facts with it, decided or not", async () => {
      await sql().query(`DELETE FROM page_reading WHERE id = $1`, [readingId]);
      expect((await facts()).map((f) => f.page_number)).toEqual([1]);
    });
  },
);
