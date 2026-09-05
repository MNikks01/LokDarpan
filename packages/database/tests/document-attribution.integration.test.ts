import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresPublishedFactRepository } from "../src/published-fact.repository";

const DATABASE_URL = process.env["DATABASE_URL"];

/**
 * Which place a document belongs to, asserted against a real Postgres.
 *
 * The defect this pins: every level asked for its *state's* records, so
 * Maharashtra, Nagpur district and Nagpur Municipal Corporation all showed the
 * same thirty state-wide audit reports. A reader can only take that as findings
 * about the place they selected.
 *
 * The correction is not to spread the state's reports downwards. It is to
 * return what is filed against the unit asked for, and to let that be nothing.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "document attribution (integration)",
  { timeout: 30_000 },
  () => {
    let pool: pg.Pool | undefined;
    let repository: PostgresPublishedFactRepository | undefined;

    const ARTIFACT = "8b".repeat(32);
    // Outside the real LGD range so nothing here can collide with ingested data.
    const STATE_LGD = "9940001";
    const DISTRICT_LGD = "9940002";
    const BODY_LGD = "9940003";
    let versionId = 0;
    let stateId = 0;
    let districtId = 0;
    let bodyId = 0;

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
      repository = new PostgresPublishedFactRepository(pool);

      await pool.query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1, 'test-attribution', 'https://example.invalid/a', now(), 1, 'test/a.pdf')
         ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT],
      );
      const version = await pool.query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('attribution test') RETURNING id`,
      );
      versionId = Number(version.rows[0]?.id);

      const unit = async (
        lgd: string,
        level: string,
        name: string,
        parent: number | null,
      ): Promise<number> => {
        const created = await pool?.query<{ id: string }>(
          `INSERT INTO admin_unit (lgd_code, level, name_en, parent_id, source_sha256,
                                   dataset_version_id, extraction_confidence, valid_from)
           VALUES ($1, $2::admin_unit_level, $3, $4, $5, $6, 1.0, CURRENT_DATE) RETURNING id`,
          [lgd, level, name, parent, ARTIFACT, versionId],
        );
        return Number(created?.rows[0]?.id);
      };

      stateId = await unit(STATE_LGD, "state", "Attribution State", null);
      districtId = await unit(DISTRICT_LGD, "district", "Attribution District", stateId);
      bodyId = await unit(BODY_LGD, "urban_local_body", "Attribution Corporation", districtId);

      // `document_one_per_artifact` is unique, so each fixture document needs
      // its own bytes — which is right: two documents from one artefact would be
      // the same document counted twice.
      let nextArtifact = 0;
      const document = async (
        title: string,
        adminUnitId: number | null,
        issuing: string,
      ): Promise<void> => {
        nextArtifact += 1;
        const sha = String(nextArtifact).padStart(2, "8").repeat(32).slice(0, 64);
        await pool?.query(
          `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
           VALUES ($1, 'test-attribution', 'https://example.invalid/a', now(), 1, 'test/a.pdf')
           ON CONFLICT (sha256) DO NOTHING`,
          [sha],
        );
        await pool?.query(
          `INSERT INTO document (doc_type, title, issuing_authority, admin_unit_id,
                                 geography_source, source_sha256, dataset_version_id,
                                 mime_type, page_count, pages_without_text, extraction_method)
           VALUES ('audit_report', $1, $2, $3, $4, $5, $6,
                   'application/pdf', 1, 0, 'test fixture')`,
          [
            title,
            issuing,
            adminUnitId,
            adminUnitId === null ? null : "publisher_filter",
            sha,
            versionId,
          ],
        );
      };

      // Named for the office that issued it, filed at state level — the exact
      // shape of the real reports, and the trap the join must not fall into.
      await document(
        "Attribution District Report No. 9 of 2026",
        stateId,
        "Accountant General, Attribution District",
      );
      await document("A district-attributed report", districtId, "Some authority");
      await document("A corporation-attributed report", bodyId, "Some authority");
      await document("A report no unit could be established for", null, "Some authority");
    });

    afterAll(async () => {
      await pool?.query(`DELETE FROM document WHERE dataset_version_id = $1`, [versionId]);
      await pool?.query(`DELETE FROM admin_unit WHERE dataset_version_id = $1`, [versionId]);
      await pool?.query(`DELETE FROM dataset_version WHERE id = $1`, [versionId]);
      await pool?.query(`DELETE FROM source_artifact WHERE source_id = 'test-attribution'`);
      await pool?.end();
    });

    const titlesFor = async (unitId: number): Promise<readonly string[]> => {
      const list = (await repository?.listDocumentsForUnit(unitId)) ?? [];
      return list.map((d) => d.title);
    };

    it("returns a state's own records when the state is selected", async () => {
      const titles = await titlesFor(stateId);
      expect(titles).toContain("Attribution District Report No. 9 of 2026");
    });

    it("does not hand a state's records down to its district", async () => {
      const titles = await titlesFor(districtId);
      expect(titles).not.toContain("Attribution District Report No. 9 of 2026");
    });

    // The specific misreading: a report issued by the Accountant General at
    // Nagpur is not a report about Nagpur, and its title is not evidence.
    it("does not attribute a report to the district named in its title", async () => {
      const titles = await titlesFor(districtId);
      expect(titles.some((t) => t.includes("Attribution District Report"))).toBe(false);
    });

    it("returns a district's own records for that district", async () => {
      expect(await titlesFor(districtId)).toContain("A district-attributed report");
    });

    it("returns a local body's records only for that local body", async () => {
      expect(await titlesFor(bodyId)).toContain("A corporation-attributed report");
      expect(await titlesFor(districtId)).not.toContain("A corporation-attributed report");
      expect(await titlesFor(stateId)).not.toContain("A corporation-attributed report");
    });

    it("keeps a document whose geography was never established reachable", async () => {
      const unresolved = (await repository?.listUnattributedDocuments()) ?? [];
      const titles = unresolved.map((d) => d.title);
      expect(titles).toContain("A report no unit could be established for");
      // Unresolved is not a place. It must not surface under one.
      expect(await titlesFor(stateId)).not.toContain("A report no unit could be established for");
    });

    it("says how each placement was reached", async () => {
      const list = (await repository?.listDocumentsForUnit(stateId)) ?? [];
      const placed = list.find((d) => d.title === "Attribution District Report No. 9 of 2026");
      // The publisher's own classification: evidence that it is this state's
      // report, and evidence of nothing narrower.
      expect(placed?.geographySource).toBe("publisher_filter");
    });

    // Holding nothing for a district is a fact about our records. The document
    // exists, and it is still reachable where it is actually filed.
    it("returns nothing for a place with nothing filed against it, and loses nothing", async () => {
      const empty = await titlesFor(bodyId);
      expect(empty).not.toContain("A district-attributed report");
      expect(await titlesFor(districtId)).toContain("A district-attributed report");
    });
  },
);
