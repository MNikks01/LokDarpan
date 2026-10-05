import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { extractNotices, type ExtractCounts } from "../src/maharashtra/documents";
import { recordArtifact, recordSighting } from "../src/maharashtra/load";
import { MSIDC, MSIDC_SOURCE_ID } from "../src/maharashtra/msidc";
import { readNoticeFacts, type NoticeFactCounts } from "../src/maharashtra/notice-facts";
import { FileRawStore, putArtifact, storagePathFor } from "../src/raw-store";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * A held notice becomes a document, read back from the raw store.
 *
 * Inside a rolled-back transaction. Uses a real MSIDC notice (born-digital,
 * two pages) so the claim is about the extractor's actual output, and a file
 * whose stored bytes were altered, which must not be read as a document.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "agency notices made into documents (integration)",
  { timeout: 60_000 },
  () => {
    let pool: pg.Pool | undefined;
    let db: pg.PoolClient | undefined;
    let rawDir = "";
    let counts: ExtractCounts | undefined;
    let again: ExtractCounts | undefined;
    let facts: NoticeFactCounts | undefined;
    let factsAgain: NoticeFactCounts | undefined;
    let noticeSha = "";
    const listingSha = "a".repeat(64);

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
      const client = await pool.connect();
      db = client;
      await client.query("BEGIN");
      // A real local run may already hold MSIDC notices and their documents; this test
      // is about its own two, so those are cleared inside the transaction.
      await client.query(
        `DELETE FROM document WHERE source_sha256 IN
           (SELECT sha256 FROM source_artifact WHERE source_id = $1)`,
        [MSIDC_SOURCE_ID],
      );
      await client.query(`DELETE FROM artifact_sighting WHERE source_id = $1`, [MSIDC_SOURCE_ID]);
      rawDir = mkdtempSync(join(tmpdir(), "notice-docs-"));
      const store = new FileRawStore(rawDir);
      const retrievedAt = new Date("2026-10-01T02:00:00Z");

      // The listing page every sighting cites.
      await client.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, http_status,
                                      content_type, byte_size, storage_path, stored_in)
         VALUES ($1, $2, 'https://msidc.org/tenders/', $3, 200, 'text/html', 1, 'x', 'file')
         ON CONFLICT (sha256) DO NOTHING`,
        [listingSha, MSIDC_SOURCE_ID, retrievedAt],
      );

      const hold = async (bytes: Buffer, url: string, work: string): Promise<string> => {
        const artifact = await putArtifact(store, bytes, {
          sourceId: MSIDC_SOURCE_ID,
          sourceUrl: url,
          retrievedAt,
          httpStatus: 200,
          contentType: "application/pdf",
        });
        await recordArtifact(client, artifact);
        await recordSighting(client, {
          sha256: artifact.sha256,
          sourceId: MSIDC_SOURCE_ID,
          sourceUrl: url,
          discoveredFrom: "https://msidc.org/tenders/",
          discoveredFromSha256: listingSha,
          listingFacts: { serial: "1", name_of_work: work, published_on: "2026-07-06" },
          seenAt: retrievedAt,
          httpStatus: 200,
          etag: null,
          lastModified: null,
        });
        return artifact.sha256;
      };

      noticeSha = await hold(
        readFileSync(join(__dirname, "fixtures", "msidc-tender-notice-09-2026-27.pdf")),
        "https://msidc.org/wp-content/uploads/2026/07/TenderNotice09.pdf",
        "Architectural Consultancy Services for a High Security Prison at Madh Island",
      );
      const alteredSha = await hold(
        Buffer.from("%PDF-1.4 bytes that will be altered"),
        "https://msidc.org/wp-content/uploads/2026/07/Altered.pdf",
        "A notice whose stored bytes no longer match",
      );
      writeFileSync(join(rawDir, storagePathFor(MSIDC_SOURCE_ID, alteredSha)), "changed");

      counts = await extractNotices(MSIDC, client, store);
      again = await extractNotices(MSIDC, client, store);
      facts = await readNoticeFacts(client, MSIDC_SOURCE_ID);
      factsAgain = await readNoticeFacts(client, MSIDC_SOURCE_ID);
    });

    afterAll(async () => {
      await db?.query("ROLLBACK");
      db?.release();
      await pool?.end();
      rmSync(rawDir, { recursive: true, force: true });
    });

    it("makes a document of the held notice, from its listing row", async () => {
      expect(counts).toMatchObject({ documents: 1, withText: 1, scanned: 0, failed: 1 });
      const doc = await db?.query<{
        doc_type: string;
        title: string;
        issuing_authority: string;
        published_on: string;
        page_count: number;
        pages_without_text: number;
      }>(
        `SELECT doc_type::text AS doc_type, title, issuing_authority,
                published_on::text AS published_on, page_count, pages_without_text
           FROM document WHERE source_sha256 = $1`,
        [noticeSha],
      );
      expect(doc?.rows[0]).toEqual({
        doc_type: "tender_notice",
        title: "Architectural Consultancy Services for a High Security Prison at Madh Island",
        issuing_authority: "Maharashtra State Infrastructure Development Corporation Ltd (MSIDC)",
        published_on: "2026-07-06",
        page_count: 2,
        pages_without_text: 0,
      });
    });

    it("keeps the notice's own text, page by page", async () => {
      const page = await db?.query<{ content: string; script: string }>(
        `SELECT p.content, p.script::text AS script FROM document_page p
           JOIN document d ON d.id = p.document_id
          WHERE d.source_sha256 = $1 AND p.page_number = 1`,
        [noticeSha],
      );
      expect(page?.rows[0]?.script).toBe("latin");
      expect(page?.rows[0]?.content).toContain("E-Tender Notice No. 09 (2026-2027)");
    });

    it("makes nothing of bytes that no longer match their address", async () => {
      const docs = await db?.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM document d
           JOIN source_artifact a ON a.sha256 = d.source_sha256
          WHERE a.source_id = $1`,
        [MSIDC_SOURCE_ID],
      );
      expect(Number(docs?.rows[0]?.n)).toBe(1);
    });

    it("reads the notice's facts, each naming its field and page", async () => {
      expect(facts).toMatchObject({ documents: 1, withFacts: 1, retired: 0 });
      const rows = await db?.query<{
        field: string;
        kind: string;
        page_number: number;
        normalised_value: string;
        parser_version: string;
        verification_status: string;
      }>(
        `SELECT f.field, f.kind::text AS kind, f.page_number, f.normalised_value,
                f.parser_version, f.verification_status::text AS verification_status
           FROM document_fact f JOIN document d ON d.id = f.document_id
          WHERE d.source_sha256 = $1
          ORDER BY f.page_number, f.field`,
        [noticeSha],
      );
      const byField = Object.fromEntries((rows?.rows ?? []).map((r) => [r.field, r]));
      expect(byField["notice_number"]).toMatchObject({
        kind: "tender_identifier",
        page_number: 1,
        normalised_value: "09 (2026-2027)",
      });
      expect(byField["emd"]).toMatchObject({
        kind: "monetary_amount",
        page_number: 1,
        normalised_value: "60000000",
      });
      expect(byField["bid_submission_end"]).toMatchObject({
        kind: "tender_date",
        page_number: 2,
        normalised_value: "2026-07-17T17:00+05:30",
      });
      // Candidates, every one: nothing read from a notice is published unreviewed.
      expect(new Set(rows?.rows.map((r) => r.verification_status))).toEqual(
        new Set(["unverified"]),
      );
      expect(new Set(rows?.rows.map((r) => r.parser_version))).toEqual(
        new Set(["mh-notice-facts/1"]),
      );
    });

    it("does not offer the same facts twice", () => {
      expect(factsAgain).toMatchObject({ inserted: 0, retired: 0 });
      expect(facts?.inserted).toBeGreaterThan(0);
    });

    it("does not make a document twice", () => {
      // The altered file is tried again, and fails again; the good one is not re-read.
      expect(again).toMatchObject({ documents: 0, failed: 1 });
    });
  },
);
