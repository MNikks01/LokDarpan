import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { loadBeamsRows } from "../src/beams/load";
import type { BeamsRow } from "../src/beams/parse";
import type { RawArtifact } from "../src/raw-store";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;

const ARTIFACT = "c".repeat(64);

const artifact: RawArtifact = {
  sha256: ARTIFACT,
  sourceId: "beams",
  sourceUrl: "https://beams.mahakosh.gov.in/Beams5/BudgetMVC/MISRPT/x.jsp",
  retrievedAt: new Date("2026-08-26T00:00:00Z"),
  httpStatus: 200,
  contentType: "application/vnd.ms-excel",
  byteSize: 10,
  storagePath: "beams/cc/cc/x",
};

const row = (over: Partial<BeamsRow> = {}): BeamsRow => ({
  deptCode: "H",
  demandNo: "H-07",
  schemeCode: "30510768",
  schemeNameEn: "Construction of Roads",
  schemeNameLocal: "रस्ते बांधकाम",
  chargedVoted: "Voted",
  schemeCommitted: "Scheme",
  sourceOfFund: null,
  planType: "Gen_PWD",
  objectCode: "01",
  allocatedInr: "100.00",
  releasedFdInr: "90.00",
  releasedInr: "80.00",
  utilizedInr: "60.00",
  reappropriatedInr: null,
  ...over,
});

describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "loadBeamsRows (integration)",
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

    // Every test rolls back, so a shared development database is untouched.
    beforeEach(async () => {
      await db().query("BEGIN");
      // Inside the transaction, and therefore rolled back with it: these tests
      // assert counts, and a development database holding real ingested PWD data
      // would satisfy or break them for reasons unrelated to the code. Emptying
      // here is safer than scoping every query, because a query that forgets the
      // scope fails open.
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
        `INSERT INTO dataset_version (description) VALUES ('beams load test') RETURNING id`,
      );
      versionId = Number(v.rows[0]?.id);
      const u = await db().query<{ id: string }>(
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                               extraction_confidence, valid_from)
       VALUES ('98','state','Testland',$1,$2,1.0,'2026-01-01') RETURNING id`,
        [ARTIFACT, versionId],
      );
      unitId = Number(u.rows[0]?.id);
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const load = (rows: readonly BeamsRow[], fiscalYear = 2024): ReturnType<typeof loadBeamsRows> =>
      loadBeamsRows(db(), rows, {
        artifact,
        datasetVersionId: versionId,
        adminUnitId: unitId,
        fiscalYear,
      });

    it("creates the department, scheme and fact", async () => {
      const result = await load([row()]);
      expect(result).toEqual({ departments: 1, schemes: 1, facts: 1 });
    });

    // BEAMS does not publish a department name; inferring one would put an
    // unsourced string in front of a reader.
    it("leaves the department name absent rather than inventing it", async () => {
      await load([row()]);
      const r = await db().query<{ name_en: string | null }>(
        `SELECT name_en FROM department WHERE admin_unit_id = $1 AND code = 'H'`,
        [unitId],
      );
      expect(r.rows[0]?.name_en).toBeNull();
    });

    it("stores both release stages distinctly", async () => {
      await load([row()]);
      const r = await db().query<{ released_fd_inr: string; released_inr: string }>(
        `SELECT released_fd_inr, released_inr FROM scheme_finance`,
      );
      expect(r.rows[0]).toMatchObject({ released_fd_inr: "90.00", released_inr: "80.00" });
    });

    it("keeps the Marathi scheme name", async () => {
      await load([row()]);
      const r = await db().query<{ name_local: string }>(
        `SELECT bs.name_local FROM budget_scheme bs
         JOIN department d ON d.id = bs.department_id AND d.admin_unit_id = $1`,
        [unitId],
      );
      expect(r.rows[0]?.name_local).toBe("रस्ते बांधकाम");
    });

    it("reuses one department and scheme across many object rows", async () => {
      const result = await load([
        row({ objectCode: "01" }),
        row({ objectCode: "02" }),
        row({ objectCode: "03" }),
      ]);
      expect(result).toEqual({ departments: 1, schemes: 1, facts: 3 });
    });

    // Re-running an ingest must converge on the published figures, not duplicate.
    it("is idempotent", async () => {
      await load([row()]);
      await load([row()]);
      const r = await db().query<{ count: string }>(`SELECT count(*) FROM scheme_finance`);
      expect(Number(r.rows[0]?.count)).toBe(1);
    });

    it("updates a revised figure and repoints provenance", async () => {
      await load([row({ utilizedInr: "60.00" })]);
      await load([row({ utilizedInr: "75.00" })]);
      const r = await db().query<{ utilized_inr: string }>(
        `SELECT utilized_inr FROM scheme_finance`,
      );
      expect(r.rows[0]?.utilized_inr).toBe("75.00");
    });

    it("stores an unpublished amount as null, not zero", async () => {
      await load([row({ utilizedInr: null })]);
      const r = await db().query<{ utilized_inr: string | null; status: string }>(
        `SELECT f.utilized_inr, v.status FROM scheme_finance f
         JOIN scheme_finance_variance v ON v.id = f.id`,
      );
      expect(r.rows[0]?.utilized_inr).toBeNull();
      expect(r.rows[0]?.status).toBe("insufficient_data");
    });

    it("computes both variances once loaded", async () => {
      await load([row()]);
      const r = await db().query<{ release_variance_inr: string; allocation_variance_inr: string }>(
        `SELECT release_variance_inr, allocation_variance_inr FROM scheme_finance_variance`,
      );
      expect(r.rows[0]).toMatchObject({
        release_variance_inr: "20.00", // 80 - 60
        allocation_variance_inr: "40.00", // 100 - 60
      });
    });

    it("keeps separate years separate", async () => {
      await load([row()], 2023);
      await load([row()], 2024);
      const r = await db().query<{ count: string }>(`SELECT count(*) FROM scheme_finance`);
      expect(Number(r.rows[0]?.count)).toBe(2);
    });
  },
);
