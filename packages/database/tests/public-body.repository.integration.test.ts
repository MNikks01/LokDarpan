import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "../src/migrator";
import { PostgresPublicBodyRepository } from "../src/public-body.repository";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const CAG = "c4".repeat(32);
const RESTRICTED = "c5".repeat(32);

/**
 * What decides whether a body is shown: a reviewed mention, from a source whose
 * terms permit republication, not read from a scan (ADR-074).
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "PostgresPublicBodyRepository (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let version = 0;
    let unit = 0;
    let report = 0;
    let notice = 0;

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

    const one = async (sql: string, params: readonly unknown[]): Promise<number> =>
      Number((await db().query<{ id: string }>(sql, [...params])).rows[0]?.id);

    beforeEach(async () => {
      await db().query("BEGIN");
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
         VALUES ($1,'cag','https://cag.gov.in/r.pdf','2026-10-01T00:00:00Z',10,'cag/r','file'),
                ($2,'mahatenders','https://example.invalid/n.pdf','2026-10-01T00:00:00Z',10,'mt/n','file')
         ON CONFLICT (sha256) DO NOTHING`,
        [CAG, RESTRICTED],
      );
      version = await one(
        `INSERT INTO dataset_version (description) VALUES ('body repo test') RETURNING id`,
        [],
      );
      unit = await one(
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ('T-074R', 'state', 'Testland', $1, $2, 1, '2000-01-01') RETURNING id`,
        [CAG, version],
      );
      const doc = async (sha: string, title: string): Promise<number> =>
        one(
          `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title, issuing_authority,
                                 mime_type, page_count, pages_without_text, extraction_method,
                                 admin_unit_id, geography_source)
           VALUES ($1,$2,'audit_report',$3,'CAG','application/pdf',10,0,'test',$4,'publisher_filter')
           RETURNING id`,
          [sha, version, title, unit],
        );
      report = await doc(CAG, "Testland Report No. 1");
      notice = await doc(RESTRICTED, "A notice");
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const body = async (kind: string, name: string, parent: number | null): Promise<number> =>
      one(
        `INSERT INTO public_body (kind, name_en, parent_body_id, jurisdiction_admin_unit_id, dataset_version_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [kind, name, parent, unit, version],
      );

    const mention = async (
      bodyId: number,
      status: "verified" | "rejected" | "unverified",
      document = report,
      page = 4,
    ): Promise<void> => {
      const decided = status !== "unverified";
      const fact = await one(
        `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                    extraction_method, parser_version, extraction_confidence,
                                    verification_status, verified_by, verified_at)
         VALUES ($1,$2,'body_reference','The Public Works Department did not reply.',
                 'Public Works Department','test','cag-facts/24',0.6,$3,$4,$5) RETURNING id`,
        [document, page, status, decided ? "reviewer@test" : null, decided ? new Date() : null],
      );
      await db().query(
        `INSERT INTO public_body_mention (public_body_id, document_fact_id, dataset_version_id)
         VALUES ($1,$2,$3)`,
        [bodyId, fact, version],
      );
    };

    it("shows a body through its reviewed mention, cited to the report and page", async () => {
      const gov = await body("government", "Government of Testland", null);
      const pwd = await body("department", "Public Works Department", gov);
      await mention(gov, "verified");
      await mention(pwd, "verified", report, 4);
      await mention(pwd, "verified", report, 9);

      const view = await new PostgresPublicBodyRepository(db()).body(pwd);
      expect(view).toMatchObject({
        id: pwd,
        kind: "department",
        name: "Public Works Department",
        jurisdiction: { unitId: unit, name: "Testland" },
        parent: { id: gov, name: "Government of Testland", reportCount: 1 },
        departments: [],
      });
      expect(view?.reports).toHaveLength(1);
      expect(view?.reports[0]).toMatchObject({
        documentId: report,
        sourceUrl: "https://cag.gov.in/r.pdf",
        sourceId: "cag",
      });
      expect(view?.reports[0]?.mentions.map((m) => m.pageNumber)).toEqual([4, 9]);
      expect(view?.datasetVersion).toBe(version);
    });

    it("does not show a body whose only mentions are undecided or rejected", async () => {
      const gov = await body("government", "Government of Testland", null);
      const pwd = await body("department", "Public Works Department", gov);
      await mention(pwd, "unverified");
      await mention(pwd, "rejected");
      expect(await new PostgresPublicBodyRepository(db()).body(pwd)).toBeNull();
    });

    it("does not show a body named only by a source whose terms are unrecorded", async () => {
      const gov = await body("government", "Government of Testland", null);
      const pwd = await body("department", "Public Works Department", gov);
      await mention(pwd, "verified", notice);
      expect(await new PostgresPublicBodyRepository(db()).body(pwd)).toBeNull();
    });

    it("omits a parent that no reviewed mention confirms", async () => {
      const gov = await body("government", "Government of Testland", null);
      const pwd = await body("department", "Public Works Department", gov);
      await mention(pwd, "verified");
      expect((await new PostgresPublicBodyRepository(db()).body(pwd))?.parent).toBeNull();
    });

    it("lists a government's shown departments and a unit's shown bodies, nothing more", async () => {
      const gov = await body("government", "Government of Testland", null);
      const pwd = await body("department", "Public Works Department", gov);
      const hidden = await body("department", "Housing Department", gov);
      await mention(gov, "verified");
      await mention(pwd, "verified");
      await mention(hidden, "rejected");

      const repo = new PostgresPublicBodyRepository(db());
      expect((await repo.body(gov))?.departments.map((d) => d.name)).toEqual([
        "Public Works Department",
      ]);
      expect((await repo.bodiesOf(unit)).map((b) => [b.kind, b.name])).toEqual([
        ["government", "Government of Testland"],
        ["department", "Public Works Department"],
      ]);
    });
  },
);
