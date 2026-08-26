import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { loadDepartmentActuals } from "../src/beams/actuals-load";
import type { DepartmentActuals } from "../src/beams/actuals-parse";
import type { RawArtifact } from "../src/raw-store";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const ARTIFACT = "d".repeat(64);

const artifact: RawArtifact = {
  sha256: ARTIFACT,
  sourceId: "beams",
  sourceUrl: "https://beams.mahakosh.gov.in/Beams5/BudgetMVC/MISRPT/DeptExpAct1.jsp",
  retrievedAt: new Date("2026-08-26T00:00:00Z"),
  httpStatus: 200,
  contentType: "text/html",
  byteSize: 10,
  storagePath: "beams/dd/dd/x",
};

const actuals = (over: Partial<DepartmentActuals> = {}): DepartmentActuals => ({
  fiscalYear: 2024,
  fromMonth: 4,
  toMonth: 3,
  rows: [
    {
      deptCode: "H",
      deptNameEn: "Public Works",
      budgetedInr: "515677060000.00",
      releasedInr: "369862620000.00",
      receivedInr: "6850430000.00",
      beamsExpenditureInr: "360492690000.00",
      treasuryExpenditureInr: "29558850000.00",
    },
  ],
  ...over,
});

describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "loadDepartmentActuals (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let versionId = 0;
    let unitId = 0;

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
      // Emptied inside the transaction, and rolled back with it — the
      // development database holds real ingested data these counts would read.
      await db().query("DELETE FROM department_finance");
      await db().query("DELETE FROM scheme_finance");
      await db().query("DELETE FROM budget_scheme");
      await db().query("DELETE FROM department");
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1,'beams',$2, now(), 10, 'beams/t') ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT, artifact.sourceUrl],
      );
      const v = await db().query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('actuals test') RETURNING id`,
      );
      versionId = Number(v.rows[0]?.id);
      const u = await db().query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ('97','state','Testland',$1,$2,1.0,'2026-01-01') RETURNING id`,
        [ARTIFACT, versionId],
      );
      unitId = Number(u.rows[0]?.id);
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const load = (a = actuals()): ReturnType<typeof loadDepartmentActuals> =>
      loadDepartmentActuals(db(), a, {
        artifact,
        datasetVersionId: versionId,
        adminUnitId: unitId,
      });

    it("creates the department and its year", async () => {
      expect(await load()).toEqual({ departments: 1, named: 1, facts: 1 });
    });

    // This report publishes the name the scheme-wise export omits.
    it("writes the department name the source publishes", async () => {
      await load();
      const r = await db().query<{ name_en: string }>(`SELECT name_en FROM department`);
      expect(r.rows[0]?.name_en).toBe("Public Works");
    });

    it("keeps BEAMS and treasury expenditure as separate measures", async () => {
      await load();
      const r = await db().query<{
        beams_expenditure_inr: string;
        treasury_expenditure_inr: string;
      }>(`SELECT beams_expenditure_inr, treasury_expenditure_inr FROM department_finance`);
      expect(r.rows[0]?.beams_expenditure_inr).toBe("360492690000.00");
      expect(r.rows[0]?.treasury_expenditure_inr).toBe("29558850000.00");
    });

    it("is idempotent", async () => {
      await load();
      await load();
      const r = await db().query<{ count: string }>(`SELECT count(*) FROM department_finance`);
      expect(Number(r.rows[0]?.count)).toBe(1);
    });

    it("keeps separate years separate", async () => {
      await load();
      await load(actuals({ fiscalYear: 2023 }));
      const r = await db().query<{ count: string }>(`SELECT count(*) FROM department_finance`);
      expect(Number(r.rows[0]?.count)).toBe(2);
    });

    it("stores an unpublished amount as null, not zero", async () => {
      const a = actuals();
      const [first] = a.rows;
      if (first === undefined) throw new Error("fixture has no rows");
      await load({ ...a, rows: [{ ...first, treasuryExpenditureInr: null }] });
      const r = await db().query<{ treasury_expenditure_inr: string | null }>(
        `SELECT treasury_expenditure_inr FROM department_finance`,
      );
      expect(r.rows[0]?.treasury_expenditure_inr).toBeNull();
    });
  },
);
