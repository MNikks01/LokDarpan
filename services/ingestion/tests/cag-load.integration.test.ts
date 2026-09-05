import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { loadDocument } from "../src/cag/load";
import type { ExtractedDocument } from "../src/cag/extract";
import type { RawArtifact } from "../src/raw-store";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const ARTIFACT = "e".repeat(64);

const artifact: RawArtifact = {
  sha256: ARTIFACT,
  sourceId: "cag",
  sourceUrl: "https://cag.gov.in/webroot/uploads/download_audit_report/2026/x.pdf",
  retrievedAt: new Date("2026-08-26T00:00:00Z"),
  httpStatus: 200,
  contentType: "application/pdf",
  byteSize: 10,
  storagePath: "cag/ee/ee/x",
};

const extracted: ExtractedDocument = {
  pageCount: 3,
  pagesWithoutText: 1,
  extractionMethod: "unpdf/pdfjs text layer",
  pages: [
    {
      pageNumber: 1,
      content: "अनुपालन लेखापरीक्षा",
      script: "devanagari",
      glyphSubstitution: 0,
      width: 595.32,
      height: 841.92,
      rotation: 0,
      substitutedCurrencyMarks: 0,
      items: [],
    },
    {
      pageNumber: 2,
      content: "Executive Engineer awarded ₹15.14 crore",
      script: "latin",
      glyphSubstitution: null,
      width: 595.32,
      height: 841.92,
      rotation: 270,
      substitutedCurrencyMarks: 0,
      items: [
        { seq: 0, charStart: 0, charEnd: 26, x0: 72, y0: 700, x1: 210, y1: 709 },
        { seq: 1, charStart: 26, charEnd: 39, x0: 210, y0: 700, x1: 268, y1: 709 },
      ],
    },
    {
      pageNumber: 3,
      content: null,
      script: "none",
      glyphSubstitution: null,
      width: 595.32,
      height: 841.92,
      rotation: 0,
      substitutedCurrencyMarks: 0,
      items: [],
    },
  ],
};

describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "loadDocument (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let versionId = 0;

    beforeAll(async () => {
      const c = new pg.Client({ connectionString: DATABASE_URL });
      await c.connect();
      await ensureMigrationTable(c);
      for (const m of pendingMigrations(
        await loadMigrations(MIGRATIONS_DIR),
        await readApplied(c),
      )) {
        await applyMigration(c, m);
      }
      client = c;
    }, 60_000);

    afterAll(async () => {
      await client?.end();
    });

    beforeEach(async () => {
      await db().query("BEGIN");
      // TRUNCATE rather than DELETE, and inside the transaction the afterEach
      // rolls back, so the real ledger is untouched.
      //
      // The assertions below count rows without naming a document, so the
      // tables have to start empty. DELETE walked every row to do that, and
      // `document_text_item` now holds 924,707 of them — the hook began timing
      // out at ten seconds, and would have kept getting slower with each
      // document ingested. A test whose setup cost grows with the corpus is a
      // test that eventually fails for a reason that has nothing to do with
      // what it checks.
      await db().query(
        "TRUNCATE document, document_page, document_text_item, document_fact CASCADE",
      );
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
       VALUES ($1,'cag',$2, now(), 10, 'cag/t') ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT, artifact.sourceUrl],
      );
      const v = await db().query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('cag test') RETURNING id`,
      );
      versionId = Number(v.rows[0]?.id);
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const meta = {
      docType: "audit_report" as const,
      title: "Nagpur Report No. 4 of 2026",
      issuingAuthority: "Comptroller and Auditor General of India",
      publishedOn: null,
      adminUnitId: null,
    };

    const load = (): ReturnType<typeof loadDocument> =>
      loadDocument(db(), { artifact, extracted, meta, datasetVersionId: versionId });

    it("stores the document and every page", async () => {
      const r = await load();
      expect(r).toMatchObject({ pages: 3, pagesWithoutText: 1 });
    });

    // A citation is a page number. Merged text cannot say which page a sentence
    // came from, which is the difference between evidence and an assertion.
    it("keeps pages individually addressable by number", async () => {
      await load();
      const r = await db().query<{ content: string }>(
        `SELECT content FROM document_page WHERE page_number = 2`,
      );
      expect(r.rows[0]?.content).toContain("₹15.14 crore");
    });

    it("records an unreadable page as null, not as blank", async () => {
      await load();
      const r = await db().query<{ content: string | null; script: string }>(
        `SELECT content, script FROM document_page WHERE page_number = 3`,
      );
      expect(r.rows[0]?.content).toBeNull();
      expect(r.rows[0]?.script).toBe("none");
    });

    it("records which script each page is in", async () => {
      await load();
      const r = await db().query<{ script: string }>(
        `SELECT script FROM document_page ORDER BY page_number`,
      );
      expect(r.rows.map((x) => x.script)).toEqual(["devanagari", "latin", "none"]);
    });

    it("is idempotent — the artefact is the document's identity", async () => {
      await load();
      await load();
      const r = await db().query<{ count: string }>(`SELECT count(*) FROM document`);
      expect(Number(r.rows[0]?.count)).toBe(1);
    });

    // Geometry is what turns a page citation into a region a reader can be
    // shown. It is stored per item, so the check is that every item survives
    // with the span and box it was given — an item dropped or renumbered
    // silently moves a highlight onto a different figure.
    it("stores the geometry a figure is located by", async () => {
      await load();
      const r = await db().query<{
        seq: number;
        char_start: number;
        char_end: number;
        x0: string;
        x1: string;
      }>(
        `SELECT seq, char_start, char_end, x0, x1 FROM document_text_item
          WHERE page_number = 2 ORDER BY seq`,
      );
      expect(r.rows).toHaveLength(2);
      expect(r.rows[0]).toMatchObject({ seq: 0, char_start: 0, char_end: 26 });
      expect(Number(r.rows[1]?.x0)).toBe(210);
      expect(Number(r.rows[1]?.x1)).toBe(268);
    });

    it("records the page box in the space the coordinates are in", async () => {
      await load();
      const r = await db().query<{ width: string; height: string; rotation: number }>(
        `SELECT width, height, rotation FROM document_page WHERE page_number = 2`,
      );
      // The rotation is recorded rather than applied: a reader turns the page,
      // and a box that had been rotated to match an upright view would fall
      // outside the very page it belongs to.
      expect(r.rows[0]?.rotation).toBe(270);
      expect(Number(r.rows[0]?.width)).toBeCloseTo(595.32, 2);
    });

    it("leaves a page with no text layer with no items, rather than an empty box", async () => {
      await load();
      const r = await db().query(
        `SELECT count(*)::int AS n FROM document_text_item WHERE page_number = 3`,
      );
      expect((r.rows[0] as { n: number }).n).toBe(0);
    });

    // Re-reading a document replaces its items wholesale. A merge would leave a
    // page described half by one extraction and half by another, with offsets
    // from each addressing a page text that only one of them produced.
    it("replaces items on a re-read rather than accumulating them", async () => {
      await load();
      await load();
      const r = await db().query(
        `SELECT count(*)::int AS n FROM document_text_item WHERE page_number = 2`,
      );
      expect((r.rows[0] as { n: number }).n).toBe(2);
    });

    it("finds a page by its words", async () => {
      await load();
      const r = await db().query(
        `SELECT page_number FROM document_page
        WHERE to_tsvector('english', coalesce(content,'')) @@ to_tsquery('english','crore')`,
      );
      expect(r.rows).toHaveLength(1);
    });
  },
);
