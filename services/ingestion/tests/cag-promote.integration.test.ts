import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { PromotionRefused, promoteCag } from "../src/cag/promote";
import { FileRawStore, sha256Of, storagePathFor } from "../src/raw-store";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;

async function migrate(client: pg.Client): Promise<void> {
  await ensureMigrationTable(client);
  const all = await loadMigrations(MIGRATIONS_DIR);
  for (const migration of pendingMigrations(all, await readApplied(client))) {
    await applyMigration(client, migration);
  }
}

/** A place, with the provenance every unit needs, in whichever database. */
async function seedState(client: pg.Client, lgdCode: string): Promise<number> {
  const sha = sha256Of(`state ${lgdCode} ${randomBytes(8).toString("hex")}`);
  await client.query(
    `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
     VALUES ($1, 'lgd', 'https://example.invalid/lgd', now(), 1, 'test/lgd', 'file')`,
    [sha],
  );
  const v = await client.query<{ id: string }>(
    `INSERT INTO dataset_version (description) VALUES ('promote test geography') RETURNING id`,
  );
  const u = await client.query<{ id: string }>(
    `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                             extraction_confidence, valid_from)
     VALUES ($1, 'state', 'Promotia', $2, $3, 1, '2026-01-01') RETURNING id`,
    [lgdCode, sha, v.rows[0]?.id],
  );
  return Number(u.rows[0]?.id);
}

/**
 * The promotion copies between two databases, so it is tested between two: the
 * suite's own as the source and a throwaway one as the target. The source rows
 * live inside a transaction the promotion reads through and that is rolled
 * back afterwards, so the shared database never holds them and the suites that
 * truncate the document tables alongside never see them.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "CAG promotion between databases (integration)",
  () => {
    const targetName = `lokdarpan_promote_${randomBytes(4).toString("hex")}`;
    let admin: pg.Client | undefined;
    let source: pg.Client | undefined;
    let target: pg.Client | undefined;
    let rawRoot = "";
    let storeRoot = "";
    let lgdCode = "";
    let reportSha = "";
    let reportPath = "";

    const src = (): pg.Client => {
      if (source === undefined) throw new Error("source not connected");
      return source;
    };
    const tgt = (): pg.Client => {
      if (target === undefined) throw new Error("target not connected");
      return target;
    };

    beforeAll(async () => {
      admin = new pg.Client({ connectionString: DATABASE_URL });
      await admin.connect();
      await migrate(admin);
      await admin.query(`CREATE DATABASE ${targetName}`);

      const url = new URL(DATABASE_URL ?? "");
      url.pathname = `/${targetName}`;
      target = new pg.Client({ connectionString: url.toString() });
      await target.connect();
      await migrate(target);

      source = new pg.Client({ connectionString: DATABASE_URL });
      await source.connect();
    }, 120_000);

    afterAll(async () => {
      await source?.end();
      await target?.end();
      await admin?.query(`DROP DATABASE IF EXISTS ${targetName} WITH (FORCE)`);
      await admin?.end();
    });

    beforeEach(async () => {
      rawRoot = await mkdtemp(join(tmpdir(), "promote-raw-"));
      storeRoot = await mkdtemp(join(tmpdir(), "promote-store-"));
      lgdCode = `P${randomBytes(3).toString("hex")}`;

      // The report's bytes, on disk where the source says they are.
      const bytes = Buffer.from(`%PDF report ${randomBytes(8).toString("hex")}`);
      reportSha = sha256Of(bytes);
      reportPath = storagePathFor("cag", reportSha);
      await mkdir(dirname(join(rawRoot, reportPath)), { recursive: true });
      await writeFile(join(rawRoot, reportPath), bytes);

      await src().query("BEGIN");
      const unit = await seedState(src(), lgdCode);
      await src().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, http_status,
                                      content_type, byte_size, storage_path, stored_in)
         VALUES ($1, 'cag', 'https://cag.gov.in/report.pdf', '2026-09-01T10:00:00.123456Z', 200,
                 'application/pdf', $2, $3, 'file')`,
        [reportSha, bytes.byteLength, reportPath],
      );
      const v = await src().query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('promote test report') RETURNING id`,
      );
      const d = await src().query<{ id: string }>(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title, admin_unit_id,
                               geography_source, mime_type, page_count, pages_without_text,
                               extraction_method)
         VALUES ($1, $2, 'audit_report', 'Report No. 1 of 2026', $3, 'publisher_filter',
                 'application/pdf', 2, 0, 'unpdf') RETURNING id`,
        [reportSha, v.rows[0]?.id, unit],
      );
      const doc = d.rows[0]?.id;
      await src().query(
        `INSERT INTO document_page (document_id, page_number, content, script)
         VALUES ($1, 1, 'रु. 5 करोड़', 'devanagari'), ($1, 2, 'Rs 5 crore', 'latin')`,
        [doc],
      );
      const fact = async (page: number, status: string, same: string | null): Promise<string> => {
        const decided = status !== "unverified";
        const r = await src().query<{ id: string }>(
          `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                      extraction_method, parser_version, extraction_confidence,
                                      verification_status, verified_by, verified_at, same_figure_as,
                                      bbox_x0, bbox_y0, bbox_x1, bbox_y1)
           VALUES ($1, $2, 'monetary_amount', 'Rs 5 crore', '5000000000', 'pattern', 'v1', 0.950,
                   $3::verification_status, $4, $5::timestamptz, $6, 10.5, 20.25, 110.5, 30.125)
           RETURNING id`,
          [
            doc,
            page,
            status,
            decided ? "A Reviewer" : null,
            decided ? "2026-09-04T17:20:43.489123Z" : null,
            same,
          ],
        );
        return r.rows[0]?.id ?? "";
      };
      const english = await fact(2, "verified", null);
      await fact(1, "verified", english);
      const rejected = await fact(2, "rejected", null);
      await src().query(
        `INSERT INTO document_fact_review_history (document_fact_id, verification_status,
                                                   verified_by, verified_at)
         VALUES ($1, 'verified', 'A Reviewer', '2026-09-03T09:00:00Z')`,
        [rejected],
      );
    });

    afterEach(async () => {
      await src().query("ROLLBACK");
    });

    const promote = (overrides: { dryRun?: boolean; rawRoot?: string } = {}) =>
      promoteCag({
        source: src(),
        target: tgt(),
        store: new FileRawStore(storeRoot),
        rawRoot: overrides.rawRoot ?? rawRoot,
        dryRun: overrides.dryRun ?? false,
        only: [reportSha],
        now: new Date("2026-10-01T00:00:00Z"),
      });

    const targetCount = async (sql: string): Promise<number> =>
      Number((await tgt().query<{ n: string }>(sql, [reportSha])).rows[0]?.n);

    it("writes nothing on a dry run, having checked every count", async () => {
      await seedState(tgt(), lgdCode);
      const result = await promote({ dryRun: true });

      expect(result).toMatchObject({ documents: 1, pages: 2, facts: 3, published: 2, history: 1 });
      expect(result.committed).toBe(false);
      expect(await targetCount(`SELECT count(*) AS n FROM document WHERE source_sha256 = $1`)).toBe(
        0,
      );
    });

    it("carries the reviewed ledger across, with every decision and link intact", async () => {
      const targetUnit = await seedState(tgt(), lgdCode);
      const result = await promote();
      expect(result).toMatchObject({ documents: 1, pages: 2, facts: 3, published: 2, history: 1 });
      expect(result.committed).toBe(true);

      // Filed under the target's own id for the same LGD code, in a sealed version.
      const doc = await tgt().query<{ admin_unit_id: string; sealed: boolean }>(
        `SELECT d.admin_unit_id, v.sealed_at IS NOT NULL AS sealed
           FROM document d JOIN dataset_version v ON v.id = d.dataset_version_id
          WHERE d.source_sha256 = $1`,
        [reportSha],
      );
      expect(Number(doc.rows[0]?.admin_unit_id)).toBe(targetUnit);
      expect(doc.rows[0]?.sealed).toBe(true);

      // Who decided, when to the microsecond, and where on the page.
      const published = await tgt().query<Record<string, string>>(
        `SELECT p.value, p.verified_by,
                to_char(p.verified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS at,
                f.bbox_x0::text AS x0, f.bbox_y1::text AS y1,
                f.extraction_confidence::text AS confidence
           FROM published_fact p JOIN document_fact f ON f.id = p.id
           JOIN document d ON d.id = p.document_id WHERE d.source_sha256 = $1`,
        [reportSha],
      );
      expect(published.rows).toHaveLength(2);
      expect(published.rows[0]).toMatchObject({
        value: "5000000000",
        verified_by: "A Reviewer",
        at: "2026-09-04T17:20:43.489123",
        x0: "10.500",
        y1: "30.125",
        confidence: "0.950",
      });

      // The Hindi figure points at the English one, inside the target.
      const link = await tgt().query<{ from_page: number; to_page: number }>(
        `SELECT f.page_number AS from_page, g.page_number AS to_page
           FROM document_fact f JOIN document_fact g ON g.id = f.same_figure_as
           JOIN document d ON d.id = f.document_id WHERE d.source_sha256 = $1`,
        [reportSha],
      );
      expect(link.rows).toEqual([{ from_page: 1, to_page: 2 }]);

      // The superseded decision is still attached to its figure.
      expect(
        await targetCount(
          `SELECT count(*) AS n FROM document_fact_review_history h
             JOIN document_fact f ON f.id = h.document_fact_id
             JOIN document d ON d.id = f.document_id
            WHERE d.source_sha256 = $1 AND f.verification_status = 'rejected'`,
        ),
      ).toBe(1);

      // The bytes are in the store, and the row says so, retrieval time intact.
      await expect(readFile(join(storeRoot, reportPath))).resolves.toBeInstanceOf(Buffer);
      const stored = await tgt().query<{ stored_in: string; retrieved: string }>(
        `SELECT stored_in, to_char(retrieved_at AT TIME ZONE 'UTC', 'US') AS retrieved
           FROM source_artifact WHERE sha256 = $1`,
        [reportSha],
      );
      expect(stored.rows[0]).toEqual({ stored_in: "file", retrieved: "123456" });
    });

    it("leaves a report that is already in the target alone", async () => {
      await seedState(tgt(), lgdCode);
      await promote();
      const again = await promote();
      expect(again).toMatchObject({ documents: 0, committed: false });
      expect(again.alreadyPresent).toEqual([reportSha]);
      expect(await targetCount(`SELECT count(*) AS n FROM document WHERE source_sha256 = $1`)).toBe(
        1,
      );
    });

    it("refuses a report whose place the target does not hold", async () => {
      await expect(promote()).rejects.toBeInstanceOf(PromotionRefused);
      expect(await targetCount(`SELECT count(*) AS n FROM source_artifact WHERE sha256 = $1`)).toBe(
        0,
      );
    });

    it("refuses bytes that do not hash to the report they are filed under", async () => {
      await seedState(tgt(), lgdCode);
      const elsewhere = await mkdtemp(join(tmpdir(), "promote-wrong-"));
      await mkdir(dirname(join(elsewhere, reportPath)), { recursive: true });
      await writeFile(join(elsewhere, reportPath), "not the report");

      await expect(promote({ rawRoot: elsewhere })).rejects.toThrow(/does not hash/);
      expect(await targetCount(`SELECT count(*) AS n FROM document WHERE source_sha256 = $1`)).toBe(
        0,
      );
    });

    it("refuses two databases on different migrations", async () => {
      await seedState(tgt(), lgdCode);
      await tgt().query(
        `INSERT INTO schema_migration (id, checksum) VALUES ('9999_not_in_the_source', 'x')`,
      );
      try {
        await expect(promote()).rejects.toThrow(/same migrations/);
      } finally {
        await tgt().query(`DELETE FROM schema_migration WHERE id = '9999_not_in_the_source'`);
      }
    });
  },
);
