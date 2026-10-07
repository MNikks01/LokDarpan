import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { loadPublicBodies } from "../src/cag/bodies-load";
import { pendingReview } from "../src/review/queue";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const ARTIFACT = "b0".repeat(32);
const SCAN = "b1".repeat(32);
/** A state of our own, so the test never touches a real unit's bodies. */
const STATE_LGD = "T-074";
const STATE_NAME = "Testland";

describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "loadPublicBodies (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let documentId = 0;
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

    // Each test runs in a transaction that is rolled back.
    beforeEach(async () => {
      await db().query("BEGIN");
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
         VALUES ($1,'cag','https://cag.gov.in/t.pdf', now(), 10, 'cag/t', 'file'),
                ($2,'mahatenders','https://example.invalid/n.pdf', now(), 10, 'mt/n', 'file')
         ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT, SCAN],
      );
      versionId = Number(
        (
          await db().query<{ id: string }>(
            `INSERT INTO dataset_version (description) VALUES ('bodies test') RETURNING id`,
          )
        ).rows[0]?.id,
      );
      const unit = await db().query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ($1, 'state', $2, $3, $4, 1, '2000-01-01') RETURNING id`,
        [STATE_LGD, STATE_NAME, ARTIFACT, versionId],
      );
      const unitId = Number(unit.rows[0]?.id);
      const doc = await db().query<{ id: string }>(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title, issuing_authority,
                               mime_type, page_count, pages_without_text, extraction_method, admin_unit_id,
                               geography_source)
         VALUES ($1,$2,'audit_report','Testland Report','CAG','application/pdf',20,0,'test',$3,
                 'publisher_filter')
         RETURNING id`,
        [ARTIFACT, versionId, unitId],
      );
      documentId = Number(doc.rows[0]?.id);
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    /** A body_reference fact as the review tool would leave it. */
    const fact = async (
      name: string,
      status: "unverified" | "verified" | "rejected" | "corrected",
      corrected: string | null = null,
      document = documentId,
    ): Promise<number> => {
      const decided = status !== "unverified";
      const r = await db().query<{ id: string }>(
        `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                    extraction_method, parser_version, extraction_confidence,
                                    verification_status, verified_by, verified_at, corrected_value)
         VALUES ($1, 3, 'body_reference', $2, $2, 'test', 'cag-facts/24', 0.6,
                 $3, $4, $5, $6)
         RETURNING id`,
        [
          document,
          name,
          status,
          decided ? "reviewer@test" : null,
          decided ? new Date() : null,
          corrected,
        ],
      );
      return Number(r.rows[0]?.id);
    };

    const bodies = async (): Promise<{ kind: string; name_en: string; parent: string | null }[]> =>
      (
        await db().query<{ kind: string; name_en: string; parent: string | null }>(
          `SELECT b.kind, b.name_en, p.name_en AS parent
             FROM public_body b
             LEFT JOIN public_body p ON p.id = b.parent_body_id
             JOIN admin_unit u ON u.id = b.jurisdiction_admin_unit_id
            WHERE u.lgd_code = $1
            ORDER BY b.kind, b.name_en`,
          [STATE_LGD],
        )
      ).rows;

    const mentions = async (): Promise<number> =>
      Number(
        (
          await db().query<{ count: string }>(
            `SELECT count(*) FROM public_body_mention m
               JOIN public_body b ON b.id = m.public_body_id
               JOIN admin_unit u ON u.id = b.jurisdiction_admin_unit_id
              WHERE u.lgd_code = $1`,
            [STATE_LGD],
          )
        ).rows[0]?.count,
      );

    it("creates nothing from undecided or rejected mentions", async () => {
      await fact("Public Works Department", "unverified");
      await fact("Finance Department", "rejected");
      const r = await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      expect(r.departments).toBe(0);
      expect(await bodies()).toEqual([]);
    });

    it("creates a department under its state's government from a verified mention", async () => {
      await fact("Public Works Department", "verified");
      await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      expect(await bodies()).toEqual([
        { kind: "government", name_en: "Government of Testland", parent: null },
        {
          kind: "department",
          name_en: "Public Works Department",
          parent: "Government of Testland",
        },
      ]);
      expect(await mentions()).toBe(1);
    });

    it("names a body as the reviewer corrected it, not as the parser read it", async () => {
      await fact("Revenue & Forest Department", "corrected", "Revenue and Forest Department");
      await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      const names = (await bodies()).map((b) => b.name_en);
      expect(names).toContain("Revenue and Forest Department");
      expect(names).not.toContain("Revenue & Forest Department");
    });

    it("gathers every confirmed mention of one name onto one body", async () => {
      await fact("Finance Department", "verified");
      await fact("Finance Department", "verified");
      await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      expect((await bodies()).filter((b) => b.kind === "department")).toHaveLength(1);
      expect(await mentions()).toBe(2);
    });

    it("is idempotent: a second run writes nothing", async () => {
      await fact("Finance Department", "verified");
      await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      const second = await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      expect(second).toMatchObject({
        governments: 0,
        departments: 0,
        mentionsAdded: 0,
        mentionsRemoved: 0,
      });
    });

    it("removes a mention once the reviewer withdraws it, and keeps the body row", async () => {
      const id = await fact("Housing Department", "verified");
      await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      expect(await mentions()).toBe(1);

      await db().query(
        `UPDATE document_fact
            SET verification_status = 'rejected', verified_by = 'reviewer@test', verified_at = now()
          WHERE id = $1`,
        [id],
      );
      const r = await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      expect(r.mentionsRemoved).toBe(1);
      expect(await mentions()).toBe(0);
      // Not deleted: with no confirmed mention it is simply not shown.
      expect((await bodies()).map((b) => b.name_en)).toContain("Housing Department");
    });

    it("places a confirmed government in the unit it names", async () => {
      await fact(`Government of ${STATE_NAME}`, "verified");
      const r = await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      expect(r.unplaced).toEqual([]);
      expect(await bodies()).toEqual([
        { kind: "government", name_en: "Government of Testland", parent: null },
      ]);
      expect(await mentions()).toBe(1);
    });

    it("leaves out a government whose place is not in the hierarchy, and says so", async () => {
      await fact("Government of Nowhere", "verified");
      const r = await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      expect(r.unplaced).toEqual(["Government of Nowhere"]);
      expect(await bodies()).toEqual([]);
    });

    it("offers a reviewer only the candidates of the state asked for", async () => {
      const id = await fact("Public Works Department", "unverified");
      const here = await pendingReview(db(), { kind: "body_reference", stateLgdCode: STATE_LGD });
      expect(here.map((c) => c.id)).toContain(id);
      const elsewhere = await pendingReview(db(), {
        kind: "body_reference",
        stateLgdCode: "T-NONE",
      });
      expect(elsewhere.map((c) => c.id)).not.toContain(id);
    });

    it("ignores mentions from a source whose terms do not permit republication", async () => {
      const unit = await db().query<{ admin_unit_id: string }>(
        `SELECT admin_unit_id FROM document WHERE id = $1`,
        [documentId],
      );
      const other = await db().query<{ id: string }>(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title, issuing_authority,
                               mime_type, page_count, pages_without_text, extraction_method, admin_unit_id,
                               geography_source)
         VALUES ($1,$2,'tender_notice','Notice','Agency','application/pdf',1,0,'test',$3,
                 'publisher_filter')
         RETURNING id`,
        [SCAN, versionId, Number(unit.rows[0]?.admin_unit_id)],
      );
      await fact("Irrigation Department", "verified", null, Number(other.rows[0]?.id));
      await loadPublicBodies(db(), { stateLgdCode: STATE_LGD });
      expect(await bodies()).toEqual([]);
    });
  },
);
