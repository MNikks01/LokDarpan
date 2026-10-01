import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { collectListing, type AgencyListing, type CollectCounts } from "../src/maharashtra/collect";
import { PoliteClient } from "../src/maharashtra/http";
import { MHADA, MHADA_SOURCE_ID } from "../src/maharashtra/mhada";
import { FileRawStore } from "../src/raw-store";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * A MHADA collection against a real Postgres, with MHADA itself stood in for.
 *
 * Runs inside one transaction that is rolled back, so it neither needs nor
 * leaves any rows. The claims under test are about provenance: the listing is
 * kept as evidence, each notice cites it, and nothing already held is fetched
 * again.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "MHADA collection (integration)",
  { timeout: 30_000 },
  () => {
    let pool: pg.Pool | undefined;
    let db: pg.PoolClient | undefined;
    let rawDir = "";
    const requested: string[] = [];
    let first: CollectCounts | undefined;
    let second: CollectCounts | undefined;

    const listing = readFileSync(
      join(__dirname, "fixtures", "mhada-tenders-page0-2026-09-30.html"),
    );

    const client = (): PoliteClient =>
      new PoliteClient({
        sleep: () => Promise.resolve(),
        http: (url) => {
          const { pathname } = new URL(url);
          requested.push(pathname);
          if (pathname === "/robots.txt") return Promise.resolve(new Response("", { status: 404 }));
          if (pathname === "/mr/tenders") return Promise.resolve(new Response(listing));
          if (pathname.endsWith(".pdf")) {
            return Promise.resolve(
              new Response(`%PDF-1.4 test notice ${pathname}`, {
                headers: { "content-type": "application/pdf", etag: `"${pathname}"` },
              }),
            );
          }
          return Promise.resolve(new Response("", { status: 404 }));
        },
      });

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
      db = await pool.connect();
      await db.query("BEGIN");
      // Rows a real local run may have written would count as already held.
      await db.query(`DELETE FROM artifact_sighting WHERE source_id = $1`, [MHADA_SOURCE_ID]);
      rawDir = mkdtempSync(join(tmpdir(), "mhada-raw-"));
      const store = new FileRawStore(rawDir);
      const options = { fromPage: 0, toPage: 0, stopWhenAllHeld: true, dryRun: false } as const;
      first = await collectListing(MHADA, { client: client(), db, store }, options);
      requested.length = 0;
      second = await collectListing(MHADA, { client: client(), db, store }, options);
    });

    afterAll(async () => {
      await db?.query("ROLLBACK");
      db?.release();
      await pool?.end();
      rmSync(rawDir, { recursive: true, force: true });
    });

    it("fetches every notice the listing points to, once", () => {
      expect(first).toMatchObject({ pages: 1, listed: 10, fetched: 10, alreadyHeld: 0, failed: 0 });
    });

    it("fetches nothing already held on the next run, and stops at that page", () => {
      expect(second).toMatchObject({ pages: 1, listed: 10, fetched: 0, alreadyHeld: 10 });
      expect(requested).toEqual(["/robots.txt", "/mr/tenders"]);
    });

    it("keeps the listing as evidence, and every notice cites it", async () => {
      const rows = await db?.query<{
        source_url: string;
        discovered_from: string;
        listing_source: string;
        board: string;
        closing_on: string;
        http_etag: string;
      }>(
        `SELECT s.source_url, s.discovered_from, l.source_url AS listing_source,
                s.listing_facts->>'board' AS board, s.listing_facts->>'closing_on' AS closing_on,
                s.http_etag
           FROM artifact_sighting s
           JOIN source_artifact l ON l.sha256 = s.discovered_from_sha256
          WHERE s.source_id = $1`,
        [MHADA_SOURCE_ID],
      );
      expect(rows?.rows).toHaveLength(10);
      const notice = rows?.rows.find((r) =>
        r.source_url.endsWith("TN_No_134-EE-West-MSIB-30-09-2026.pdf"),
      );
      expect(notice).toMatchObject({
        discovered_from: "https://www.mhada.gov.in/mr/tenders",
        listing_source: "https://www.mhada.gov.in/mr/tenders",
        board: "मुंबई झोपडपट्टी सुधार मंडळ",
        closing_on: "2026-10-07",
      });
      expect(notice?.http_etag).toContain("TN_No_134");
    });

    it("records each notice's bytes as an artefact held in the store", async () => {
      const result = await db?.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM source_artifact
          WHERE source_id = $1 AND stored_in = 'file' AND content_type = 'application/pdf'`,
        [MHADA_SOURCE_ID],
      );
      expect(Number(result?.rows[0]?.n)).toBeGreaterThanOrEqual(10);
    });
  },
);

interface PackageRow {
  readonly work: string;
  readonly document: string;
}

/**
 * MSIDC lists each package of a multi-package notice as its own row, all
 * pointing to one PDF. The file is fetched once; each row's facts are kept.
 */
const PACKAGES: AgencyListing<PackageRow> = {
  sourceId: "test-shared-notice",
  lastPage: 0,
  pageUrl: () => "https://packages.example.gov.in/tenders/",
  parse: () => [
    { work: "Package A, MDR-130", document: "https://packages.example.gov.in/notice.pdf" },
    { work: "Package B, MDR-131", document: "https://packages.example.gov.in/notice.pdf" },
  ],
  documentsOf: (row) => [row.document],
  factsOf: (row) => ({ name_of_work: row.work }),
  noticeMetaOf: () => ({ title: "Shared notice", issuingAuthority: "Test", publishedOn: null }),
};

describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "rows sharing one notice (integration)",
  { timeout: 30_000 },
  () => {
    let pool: pg.Pool | undefined;
    let db: pg.PoolClient | undefined;
    let rawDir = "";
    const pdfRequests: string[] = [];
    let counts: CollectCounts | undefined;

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
      db = await pool.connect();
      await db.query("BEGIN");
      rawDir = mkdtempSync(join(tmpdir(), "shared-raw-"));
      const client = new PoliteClient({
        sleep: () => Promise.resolve(),
        http: (url) => {
          const { pathname } = new URL(url);
          if (pathname === "/robots.txt") return Promise.resolve(new Response("", { status: 404 }));
          if (pathname === "/notice.pdf") pdfRequests.push(pathname);
          return Promise.resolve(new Response("%PDF-1.4 one notice, two packages"));
        },
      });
      counts = await collectListing(
        PACKAGES,
        { client, db, store: new FileRawStore(rawDir) },
        { fromPage: 0, toPage: 0, stopWhenAllHeld: false, dryRun: false },
      );
    });

    afterAll(async () => {
      await db?.query("ROLLBACK");
      db?.release();
      await pool?.end();
      rmSync(rawDir, { recursive: true, force: true });
    });

    it("fetches the shared file once and keeps every row's facts", async () => {
      expect(pdfRequests).toHaveLength(1);
      expect(counts).toMatchObject({ listed: 2, fetched: 1, alreadyHeld: 1, failed: 0 });
      const rows = await db?.query<{ work: string; sha256: string }>(
        `SELECT listing_facts->>'name_of_work' AS work, sha256 FROM artifact_sighting
          WHERE source_id = 'test-shared-notice' ORDER BY id`,
      );
      expect(rows?.rows.map((r) => r.work)).toEqual(["Package A, MDR-130", "Package B, MDR-131"]);
      expect(new Set(rows?.rows.map((r) => r.sha256)).size).toBe(1);
    });
  },
);
