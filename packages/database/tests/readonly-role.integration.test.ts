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

    /**
     * The tables this milestone added, under the role production connects as.
     *
     * Grants reach them through `ALTER DEFAULT PRIVILEGES` rather than a
     * statement naming them, so nothing in a migration says these three are
     * readable — the guarantee is a default set once in 0002 and inherited ever
     * since. Development and every other test connect as the owner, so a
     * regression here would first be seen in production.
     */
    describe("the tables added since 0002", () => {
      it("can read tender history", async () => {
        await expect(db().query("SELECT count(*) FROM tender_version")).resolves.toBeDefined();
      });

      it("can read ingestion runs", async () => {
        await expect(db().query("SELECT count(*) FROM ingestion_run")).resolves.toBeDefined();
      });

      it("can read geography coverage", async () => {
        await expect(db().query("SELECT count(*) FROM geography_coverage")).resolves.toBeDefined();
      });

      it("can read a collection window's state and freshness", async () => {
        await expect(
          db().query(
            "SELECT portal_code, state_lgd_code, last_checked_at, last_success_at FROM tender_collection_window",
          ),
        ).resolves.toBeDefined();
      });

      it("cannot forge a tender's history", async () => {
        await refuses(
          "insert tender_version",
          `INSERT INTO tender_version (tender_id, tender_reference, title, source_sha256,
                                       dataset_version_id, first_seen_at, last_seen_at)
           VALUES (1, 'X', 'X', repeat('0', 64), 1, now(), now())`,
        );
      });

      // A reader who could write a run could claim a collection that never
      // happened, which is the one thing the run table exists to prevent.
      it("cannot claim an ingestion run", async () => {
        await refuses(
          "insert ingestion_run",
          "INSERT INTO ingestion_run (source_id) VALUES ('forged')",
        );
      });

      it("cannot assert coverage it did not measure", async () => {
        await refuses(
          "insert geography_coverage",
          `INSERT INTO geography_coverage (admin_unit_id, level, status, source_id)
           VALUES (1, 'village', 'complete', 'forged')`,
        );
      });

      it("cannot rewrite when a source was last collected", async () => {
        await refuses(
          "update tender_collection_window",
          "UPDATE tender_collection_window SET last_success_at = now()",
        );
      });
    });
  },
);
