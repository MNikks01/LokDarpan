import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { OcrClient } from "../src/ocr/client";
import { readUnreadPages, type ReadPagesCounts } from "../src/ocr/read-pages";
import { FileRawStore, putArtifact } from "../src/raw-store";

const DATABASE_URL = process.env["DATABASE_URL"];
const SOURCE = "test-ocr-scans";

/**
 * Scanned pages read by the OCR service and stored beside the page.
 *
 * The service is replaced by a fetch that answers in the contract's shape, so
 * this runs without Python: one engine reads page 1 and finds nothing on page
 * 2, and the other is refused for the whole document, as an engine that is not
 * installed would be. Everything happens inside a rolled-back transaction.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "OCR readings stored beside the page (integration)",
  { timeout: 60_000 },
  () => {
    let pool: pg.Pool | undefined;
    let db: pg.PoolClient | undefined;
    let rawDir = "";
    let documentId = 0;
    let first: ReadPagesCounts | undefined;
    let again: ReadPagesCounts | undefined;
    let sha = "";
    const requests: unknown[] = [];

    const answer = (body: unknown): Response =>
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

    const render = {
      dpi: 300,
      raster_width: 2480,
      raster_height: 3508,
      page_width: 596,
      page_height: 844,
      rotation: 0,
    };
    const engine = {
      name: "tesseract",
      version: "5.5.3",
      model_versions: {},
      languages: ["eng", "mar"],
    };
    const box = { y0: 700, y1: 709 };

    const fakeFetch: typeof globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
      if (url.endsWith("/capabilities")) {
        return Promise.resolve(
          answer({
            contract_version: "ocr/1",
            engines: [
              { name: "tesseract", available: true, version: "5.5.3", detail: null },
              { name: "paddleocr", available: true, version: "3.7.0", detail: null },
            ],
          }),
        );
      }
      const form = init?.body as FormData;
      requests.push(JSON.parse(form.get("request") as string));
      return Promise.resolve(
        answer({
          contract_version: "ocr/1",
          document_sha256: sha,
          readings: [
            {
              page_number: 1,
              engine,
              render,
              content: "Bid Submission end 07/10/2026",
              items: [
                { seq: 0, char_start: 0, char_end: 3, x0: 72, x1: 90, ...box, confidence: 0.96 },
                {
                  seq: 1,
                  char_start: 19,
                  char_end: 29,
                  x0: 200,
                  x1: 260,
                  ...box,
                  confidence: 0.81,
                },
              ],
            },
            { page_number: 2, engine, render, content: "", items: [] },
          ],
          refusals: [
            { page_number: null, engine: "paddleocr", reason: "paddleocr is not installed" },
          ],
        }),
      );
    };

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
      const client = await pool.connect();
      db = client;
      await client.query("BEGIN");
      rawDir = mkdtempSync(join(tmpdir(), "ocr-pages-"));
      const store = new FileRawStore(rawDir);

      const artifact = await putArtifact(store, Buffer.from("%PDF-1.4 a scanned notice"), {
        sourceId: SOURCE,
        sourceUrl: "https://example.invalid/scan.pdf",
        retrievedAt: new Date("2026-10-05T02:00:00Z"),
        httpStatus: 200,
        contentType: "application/pdf",
      });
      sha = artifact.sha256;
      await client.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, http_status,
                                      content_type, byte_size, storage_path, stored_in)
         VALUES ($1, $2, 'https://example.invalid/scan.pdf', now(), 200, 'application/pdf', $3, $4, $5)`,
        [sha, SOURCE, artifact.byteSize, artifact.storagePath, store.location],
      );
      const version = await client.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('ocr test') RETURNING id`,
      );
      const document = await client.query<{ id: string }>(
        `INSERT INTO document (doc_type, title, issuing_authority, source_sha256, dataset_version_id,
                               mime_type, page_count, pages_without_text, extraction_method)
         VALUES ('tender_notice', 'A scanned notice', 'An agency', $1, $2,
                 'application/pdf', 2, 2, 'test fixture')
         RETURNING id`,
        [sha, Number(version.rows[0]?.id)],
      );
      documentId = Number(document.rows[0]?.id);
      for (const page of [1, 2]) {
        await client.query(
          `INSERT INTO document_page (document_id, page_number, content, script)
           VALUES ($1, $2, NULL, 'none')`,
          [documentId, page],
        );
      }

      const ocr = new OcrClient({ baseUrl: "http://ocr.invalid", fetch: fakeFetch });
      first = await readUnreadPages(SOURCE, { db: client, store, client: ocr });
      again = await readUnreadPages(SOURCE, { db: client, store, client: ocr });
    });

    afterAll(async () => {
      await db?.query("ROLLBACK");
      db?.release();
      await pool?.end();
      rmSync(rawDir, { recursive: true, force: true });
    });

    it("sends every page with no text layer, and stores what each engine saw", () => {
      expect(first).toMatchObject({ documents: 1, pages: 2, readings: 2, empty: 1, refusals: 2 });
      expect(requests[0]).toMatchObject({
        page_numbers: [1, 2],
        engines: ["tesseract", "paddleocr"],
        languages: ["eng", "mar"],
      });
    });

    it("keeps the reading beside the page, and the page as the file states it", async () => {
      const pages = await db?.query<{ content: string | null }>(
        `SELECT content FROM document_page WHERE document_id = $1 ORDER BY page_number`,
        [documentId],
      );
      expect(pages?.rows.map((r) => r.content)).toEqual([null, null]);

      const reading = await db?.query<{
        engine: string;
        engine_version: string;
        languages: string[];
        dpi: number;
        content: string;
      }>(
        `SELECT engine, engine_version, languages, dpi, content FROM page_reading
          WHERE document_id = $1 AND page_number = 1 AND refusal IS NULL`,
        [documentId],
      );
      expect(reading?.rows).toEqual([
        {
          engine: "tesseract",
          engine_version: "5.5.3",
          languages: ["eng", "mar"],
          dpi: 300,
          content: "Bid Submission end 07/10/2026",
        },
      ]);
    });

    it("keeps each word's box and the engine's confidence in it", async () => {
      const items = await db?.query<{ seq: number; confidence: string }>(
        `SELECT i.seq, i.confidence::text AS confidence FROM page_reading_item i
           JOIN page_reading r ON r.id = i.reading_id
          WHERE r.document_id = $1 ORDER BY i.seq`,
        [documentId],
      );
      expect(items?.rows).toEqual([
        { seq: 0, confidence: "0.960" },
        { seq: 1, confidence: "0.810" },
      ]);
    });

    it("states a refusal against every page it covers, with its reason", async () => {
      const refused = await db?.query<{ page_number: number; refusal: string }>(
        `SELECT page_number, refusal FROM page_reading
          WHERE document_id = $1 AND engine = 'paddleocr' ORDER BY page_number`,
        [documentId],
      );
      expect(refused?.rows).toEqual([
        { page_number: 1, refusal: "paddleocr is not installed" },
        { page_number: 2, refusal: "paddleocr is not installed" },
      ]);
    });

    it("does not store a reading twice, and asks again only where an engine refused", async () => {
      // Tesseract's readings are held, so the second run stores none. Paddle was
      // refused, so its pages are asked for again and the refusal restated once.
      expect(again).toMatchObject({ readings: 0, refusals: 2 });
      const rows = await db?.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM page_reading WHERE document_id = $1`,
        [documentId],
      );
      expect(Number(rows?.rows[0]?.n)).toBe(4);
    });
  },
);
