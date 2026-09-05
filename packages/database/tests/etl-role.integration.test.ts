import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ETL_URL = process.env["DATABASE_URL_ETL"];

/**
 * The credential the scheduler runs as, exercised as itself.
 *
 * Ingestion has always run as the database owner, which was tolerable while it
 * ran by hand from a trusted machine. Scheduling it puts the credential in
 * GitHub, and an owner credential there can drop the ledger. These tests run the
 * statements rather than inspecting `has_table_privilege`, because a privilege
 * check only restates the grant while running the statement proves what happens.
 */
describe.skipIf(ETL_URL === undefined || ETL_URL === "")(
  "the ETL role (integration)",
  { timeout: 30_000 },
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };

    beforeAll(async () => {
      const c = new pg.Client({ connectionString: ETL_URL });
      await c.connect();
      client = c;
    }, 30_000);

    afterAll(async () => {
      await client?.end();
    });

    /** Each attempt in its own transaction, so a rejection cannot poison the next. */
    const refuses = async (label: string, sql: string): Promise<void> => {
      await db().query("BEGIN");
      try {
        await expect(db().query(sql), label).rejects.toThrow(/permission denied|must be owner/i);
      } finally {
        await db().query("ROLLBACK");
      }
    };

    it("connects as the ETL role, not as the owner", async () => {
      const who = await db().query<{ user: string }>("SELECT current_user AS user");
      expect(who.rows[0]?.user).toBe("lokdarpan_etl_user");
      const owner = await db().query<{ is_owner: boolean }>(
        "SELECT pg_has_role(current_user, 'lokdarpan', 'MEMBER') AS is_owner",
      );
      expect(owner.rows[0]?.is_owner).toBe(false);
    });

    describe("what ingestion actually does", () => {
      it("reads the admin hierarchy to resolve a portal's districts", async () => {
        await expect(
          db().query("SELECT id, name_en FROM admin_unit WHERE level = 'district' LIMIT 1"),
        ).resolves.toBeDefined();
      });

      it("counts the history a run caused", async () => {
        await expect(db().query("SELECT max(id) FROM tender_version")).resolves.toBeDefined();
      });

      it("opens a run and closes it", async () => {
        await db().query("BEGIN");
        try {
          const opened = await db().query<{ id: string }>(
            "INSERT INTO ingestion_run (source_id) VALUES ('zz-etl-role-test') RETURNING id",
          );
          const id = Number(opened.rows[0]?.id);
          expect(Number.isInteger(id)).toBe(true);
          await expect(
            db().query(
              "UPDATE ingestion_run SET status='succeeded', completed_at=now() WHERE id=$1",
              [id],
            ),
          ).resolves.toBeDefined();
        } finally {
          await db().query("ROLLBACK");
        }
      });

      it("records an observation window", async () => {
        await db().query("BEGIN");
        try {
          await expect(
            db().query(
              `INSERT INTO tender_collection_window (portal_code, collecting_since, state_lgd_code)
               VALUES ('zz-etl', CURRENT_DATE, '9950001')
               ON CONFLICT (portal_code) DO UPDATE SET last_success_at = now()`,
            ),
          ).resolves.toBeDefined();
        } finally {
          await db().query("ROLLBACK");
        }
      });

      // A probe key, not the sweep's 437642. What is under test is that this
      // role may take an advisory lock at all; using the real key would contend
      // with the lock suite whenever the two files run at the same time, and a
      // test that fails on scheduling order teaches nothing.
      it("may take an advisory lock, as the sweep does", async () => {
        const probe = 437_642_001;
        const taken = await db().query<{ taken: boolean }>(
          "SELECT pg_try_advisory_lock($1) AS taken",
          [probe],
        );
        expect(taken.rows[0]?.taken).toBe(true);
        await db().query("SELECT pg_advisory_unlock($1)", [probe]);
      });
    });

    describe("what it must not be able to do", () => {
      // History is written by the trigger from 0022, which runs as the table
      // owner. A grant here would defeat making that trigger SECURITY DEFINER.
      it("cannot write tender history directly", async () => {
        await refuses(
          "insert tender_version",
          `INSERT INTO tender_version (tender_id, tender_reference, title, source_sha256,
                                       dataset_version_id, first_seen_at, last_seen_at)
           VALUES (1, 'X', 'X', repeat('0', 64), 1, now(), now())`,
        );
      });

      it("cannot delete a tender", async () => {
        await refuses("delete tender", "DELETE FROM tender WHERE id = -1");
      });

      it("cannot empty a table", async () => {
        await refuses("truncate tender", "TRUNCATE tender CASCADE");
      });

      it("cannot change the schema", async () => {
        await refuses("alter tender", "ALTER TABLE tender ADD COLUMN forged TEXT");
      });

      it("cannot create objects of its own", async () => {
        await refuses("create table", "CREATE TABLE forged (id INT)");
      });

      it("cannot drop the ledger", async () => {
        await refuses("drop admin_unit", "DROP TABLE admin_unit");
      });

      // Ingestion has no business rewriting the audit ledger or the geography.
      it("cannot touch unrelated application data", async () => {
        await refuses("update document", "UPDATE document SET title = 'forged'");
        await refuses("update admin_unit", "UPDATE admin_unit SET name_en = 'forged'");
      });

      it("is not a superuser and cannot create roles or databases", async () => {
        const attrs = await db().query<{
          rolsuper: boolean;
          rolcreatedb: boolean;
          rolcreaterole: boolean;
        }>(
          "SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user",
        );
        expect(attrs.rows[0]).toMatchObject({
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
        });
      });
    });
  },
);
