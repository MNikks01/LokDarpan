import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "../src/migrator";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;

describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "finance schema (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };

    let artifact = "";
    let versionId = 0;
    let schemeId = 0;

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

    // Each test runs in a transaction that is rolled back, so a shared
    // development database is left exactly as it was found.
    beforeEach(async () => {
      await db().query("BEGIN");
      artifact = "b".repeat(64);
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
       VALUES ($1,'beams','https://beams.mahakosh.gov.in/', now(), 1, 'raw/beams/t')
       ON CONFLICT (sha256) DO NOTHING`,
        [artifact],
      );
      const v = await db().query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('finance test') RETURNING id`,
      );
      versionId = Number(v.rows[0]?.id);
      const unit = await db().query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                               extraction_confidence, valid_from)
       VALUES ('99','state','Testland',$1,$2,1.0,'2026-01-01') RETURNING id`,
        [artifact, versionId],
      );
      const dept = await db().query<{ id: string }>(
        `INSERT INTO department (admin_unit_id, code, source_sha256, dataset_version_id, extraction_confidence)
       VALUES ($1,'H',$2,$3,1.0) RETURNING id`,
        [Number(unit.rows[0]?.id), artifact, versionId],
      );
      const scheme = await db().query<{ id: string }>(
        `INSERT INTO budget_scheme (department_id, demand_no, scheme_code, source_sha256,
                                  dataset_version_id, extraction_confidence)
       VALUES ($1,'H-07','30510768',$2,$3,1.0) RETURNING id`,
        [Number(dept.rows[0]?.id), artifact, versionId],
      );
      schemeId = Number(scheme.rows[0]?.id);
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    interface Amounts {
      readonly year: number;
      readonly object: string;
      readonly allocated: string | null;
      readonly released: string | null;
      readonly utilized: string | null;
    }

    const insertFact = ({
      year,
      object,
      allocated,
      released,
      utilized,
    }: Amounts): Promise<unknown> =>
      db().query(
        `INSERT INTO scheme_finance (budget_scheme_id, fiscal_year, object_code, allocated_inr,
                                   released_inr, utilized_inr, extraction_confidence,
                                   linkage_confidence, source_sha256, dataset_version_id)
       VALUES ($1,$2,$3,$4,$5,$6,1.0,1.0,$7,$8)`,
        [schemeId, year, object, allocated, released, utilized, artifact, versionId],
      );

    const variance = async (
      year: number,
    ): Promise<{
      release_variance_inr: string | null;
      allocation_variance_inr: string | null;
      status: string;
    }> => {
      const r = await db().query(
        `SELECT release_variance_inr, allocation_variance_inr, status
         FROM scheme_finance_variance WHERE budget_scheme_id = $1 AND fiscal_year = $2`,
        [schemeId, year],
      );
      return r.rows[0] as never;
    };

    it("computes both variances against their own denominators", async () => {
      await insertFact({
        year: 2023,
        object: "01",
        allocated: "100.00",
        released: "80.00",
        utilized: "60.00",
      });
      const v = await variance(2023);
      expect(v.release_variance_inr).toBe("20.00"); // R - U
      expect(v.allocation_variance_inr).toBe("40.00"); // A - U
      expect(v.status).toBe("complete");
    });

    // Maharashtra's own published data breaks this: BEAMS scheme B-10 for
    // FY2024-25 reports allocated 5,310,000 against released 7,434,000. A CHECK
    // would reject a true government record.
    it("accepts a record where released exceeds allocated, as published", async () => {
      await expect(
        insertFact({
          year: 2024,
          object: "01",
          allocated: "5310000.00",
          released: "7434000.00",
          utilized: "7434000.00",
        }),
      ).resolves.toBeDefined();
      const v = await variance(2024);
      expect(v.release_variance_inr).toBe("0.00");
      expect(v.allocation_variance_inr).toBe("-2124000.00");
    });

    it("accepts a record where expenditure exceeds released", async () => {
      await expect(
        insertFact({
          year: 2022,
          object: "01",
          allocated: "100.00",
          released: "50.00",
          utilized: "90.00",
        }),
      ).resolves.toBeDefined();
    });

    // Missing is never zero, and no variance is computed across a missing stage.
    it("computes no variance when a stage is unpublished, and says so", async () => {
      await insertFact({
        year: 2021,
        object: "01",
        allocated: "100.00",
        released: "80.00",
        utilized: null,
      });
      const v = await variance(2021);
      expect(v.release_variance_inr).toBeNull();
      expect(v.allocation_variance_inr).toBeNull();
      expect(v.status).toBe("insufficient_data");
    });

    it("distinguishes a published zero from an absent value", async () => {
      await insertFact({
        year: 2020,
        object: "01",
        allocated: "0.00",
        released: "0.00",
        utilized: "0.00",
      });
      const v = await variance(2020);
      expect(v.status).toBe("complete");
      expect(v.release_variance_inr).toBe("0.00");
    });

    it("refuses a negative amount", async () => {
      await expect(
        insertFact({
          year: 2019,
          object: "01",
          allocated: "-1.00",
          released: null,
          utilized: null,
        }),
      ).rejects.toThrow();
    });

    it("refuses a fact whose provenance artefact does not exist", async () => {
      await expect(
        db().query(
          `INSERT INTO scheme_finance (budget_scheme_id, fiscal_year, object_code, allocated_inr,
                                     extraction_confidence, linkage_confidence, source_sha256,
                                     dataset_version_id)
         VALUES ($1,2018,'01',1.00,1.0,1.0,repeat('f',64),$2)`,
          [schemeId, versionId],
        ),
      ).rejects.toThrow();
    });

    it("refuses a linkage confidence outside 0..1", async () => {
      await expect(
        db().query(
          `INSERT INTO scheme_finance (budget_scheme_id, fiscal_year, object_code, allocated_inr,
                                     extraction_confidence, linkage_confidence, source_sha256,
                                     dataset_version_id)
         VALUES ($1,2017,'01',1.00,1.0,1.5,$2,$3)`,
          [schemeId, artifact, versionId],
        ),
      ).rejects.toThrow();
    });

    it("refuses a duplicate (scheme, year, object)", async () => {
      await insertFact({
        year: 2016,
        object: "07",
        allocated: "1.00",
        released: null,
        utilized: null,
      });
      await expect(
        insertFact({ year: 2016, object: "07", allocated: "2.00", released: null, utilized: null }),
      ).rejects.toThrow();
    });

    it("keeps a department name absent rather than invented", async () => {
      const r = await db().query<{ name_en: string | null }>(
        `SELECT name_en FROM department WHERE code = 'H' AND admin_unit_id IN
         (SELECT id FROM admin_unit WHERE lgd_code = '99')`,
      );
      expect(r.rows[0]?.name_en).toBeNull();
    });

    it("has no column named exactly 'variance'", async () => {
      const r = await db().query(
        `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND lower(column_name) = 'variance'`,
      );
      expect(r.rows).toHaveLength(0);
    });
  },
);
