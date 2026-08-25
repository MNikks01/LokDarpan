import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const READONLY_URL = process.env["DATABASE_URL_READONLY"];

/**
 * The architecture states that ETL is the only write path to the ledger and
 * everything downstream is read-only. That was a promise made by application
 * code until migration 0002; these tests assert the database now enforces it.
 *
 * They connect as the API's own login user rather than as the owner, and they
 * issue the statements rather than inspecting `has_table_privilege` — a
 * privilege check would only restate the grant, while running the statement
 * proves what actually happens.
 */
describe.skipIf(READONLY_URL === undefined || READONLY_URL === "")(
  "read-only role (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };

    beforeAll(async () => {
      const c = new pg.Client({ connectionString: READONLY_URL });
      await c.connect();
      client = c;
    }, 30_000);

    afterAll(async () => {
      await client?.end();
    });

    const refuses = async (label: string, sql: string): Promise<void> => {
      // Each attempt runs in its own transaction so a rejected statement cannot
      // poison the next, and nothing survives even if a grant ever regresses.
      await db().query("BEGIN");
      try {
        await expect(db().query(sql), label).rejects.toThrow(/permission denied|must be owner/i);
      } finally {
        await db().query("ROLLBACK");
      }
    };

    it("can read the ledger", async () => {
      const result = await db().query<{ count: string }>("SELECT count(*) FROM admin_unit");
      expect(Number(result.rows[0]?.count ?? -1)).toBeGreaterThanOrEqual(0);
    });

    it("can read a fact together with its provenance", async () => {
      const result = await db().query(
        `SELECT a.id FROM admin_unit a JOIN source_artifact s ON s.sha256 = a.source_sha256 LIMIT 1`,
      );
      expect(result.rows.length).toBeLessThanOrEqual(1);
    });

    it("cannot insert a unit", async () => {
      await refuses(
        "INSERT admin_unit",
        `INSERT INTO admin_unit (lgd_code, level, name_en, source_sha256, dataset_version_id,
                                 extraction_confidence, valid_from)
         VALUES ('ZZ', 'state', 'Nowhere', repeat('a', 64), 1, 1.0, '2026-01-01')`,
      );
    });

    it("cannot rename a unit", async () => {
      await refuses("UPDATE admin_unit", `UPDATE admin_unit SET name_en = 'Renamed'`);
    });

    it("cannot delete a unit", async () => {
      await refuses("DELETE admin_unit", `DELETE FROM admin_unit`);
    });

    it("cannot empty the table", async () => {
      await refuses("TRUNCATE admin_unit", `TRUNCATE admin_unit CASCADE`);
    });

    // The raw store is the audit trail. A read path able to rewrite it would
    // make every fact citing an artefact unverifiable.
    it("cannot write to the raw-artefact store", async () => {
      await refuses(
        "INSERT source_artifact",
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES (repeat('9', 64), 'x', 'x', now(), 1, 'x')`,
      );
    });

    it("cannot open a dataset version", async () => {
      await refuses(
        "INSERT dataset_version",
        `INSERT INTO dataset_version (description) VALUES ('forged')`,
      );
    });

    it("cannot create objects in the schema", async () => {
      await refuses("CREATE TABLE", `CREATE TABLE should_not_exist (id int)`);
    });

    it("cannot drop the ledger", async () => {
      await refuses("DROP TABLE", `DROP TABLE admin_unit`);
    });

    it("is not a superuser and cannot create databases or roles", async () => {
      const result = await db().query<{
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
      }>(`SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`);
      expect(result.rows[0]).toMatchObject({
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
      });
    });
  },
);
