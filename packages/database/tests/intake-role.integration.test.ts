import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "../src/migrator";

const DATABASE_URL = process.env["DATABASE_URL"];
const INTAKE_URL = process.env["DATABASE_URL_INTAKE"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;

/**
 * Migration 0046: the public correction form may submit a request and do
 * nothing else, the read-only API cannot read requests back out, and a
 * reviewer may record a decision whose predecessor is kept (ADR-075).
 *
 * Statements are issued, not privileges inspected: running one proves what the
 * database does. Every case runs as the role under test inside a transaction
 * that is rolled back, so nothing it writes survives.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "correction intake (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };

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

    /** Run `body` as `role` in a transaction that is always rolled back. */
    const as = async <T>(role: string, body: () => Promise<T>): Promise<T> => {
      await db().query("BEGIN");
      try {
        await db().query(`SET LOCAL ROLE ${role}`);
        return await body();
      } finally {
        await db().query("ROLLBACK");
      }
    };

    const submit = (
      subject: string,
      description = "The amount on page 12 is printed as 4.5 crore, not 45 crore.",
      evidence: string | null = null,
    ): Promise<pg.QueryResult<{ ref: string }>> =>
      db().query<{ ref: string }>(`SELECT submit_correction($1, 'amount_wrong', $2, $3) AS ref`, [
        subject,
        description,
        evidence,
      ]);

    it("lets the form submit a request and returns a reference to quote", async () => {
      const ref = await as("lokdarpan_intake", async () => {
        const r = await submit("fact:123", undefined, "https://cag.gov.in/report.pdf");
        return r.rows[0]?.ref;
      });
      expect(ref).toMatch(/^LD-[0-9A-F]{10}$/u);
    });

    it.each([
      ["read requests", "SELECT * FROM correction_request"],
      [
        "write a request directly",
        `INSERT INTO correction_request (reference, subject, category, description)
         VALUES ('LD-X', 'fact:1', 'other', 'written around the function')`,
      ],
      ["change a request", "UPDATE correction_request SET status = 'corrected' WHERE false"],
      ["read the ledger", "SELECT * FROM document_fact WHERE false"],
      ["write the ledger", "UPDATE document_fact SET verification_status = 'verified' WHERE false"],
    ])("refuses the form any other privilege: %s", async (_label, sql) => {
      await as("lokdarpan_intake", async () => {
        await expect(db().query(sql)).rejects.toThrow(/permission denied/iu);
      });
    });

    it.each([
      ["a subject that is not a record or a page", "fact:abc"],
      ["a page that is not a path", "page:https://elsewhere.example"],
    ])("refuses %s", async (_label, subject) => {
      await as("lokdarpan_intake", async () => {
        await expect(submit(subject)).rejects.toThrow(/correction_subject_shape/u);
      });
    });

    it("refuses a description too short to act on, and evidence that is not a web address", async () => {
      await as("lokdarpan_intake", async () => {
        await expect(submit("fact:1", "wrong")).rejects.toThrow(/correction_description_length/u);
      });
      await as("lokdarpan_intake", async () => {
        await expect(submit("fact:1", undefined, "javascript:alert(1)")).rejects.toThrow(
          /correction_evidence_url_shape/u,
        );
      });
    });

    it("pauses intake for the whole site once the hourly ceiling is reached", async () => {
      await db().query("BEGIN");
      try {
        await db().query(
          `INSERT INTO correction_request (reference, subject, category, description)
           SELECT 'LD-CEILING-' || g, 'fact:1', 'other', 'filling the hour for the test'
             FROM generate_series(1, 200) AS g`,
        );
        await db().query("SET LOCAL ROLE lokdarpan_intake");
        await expect(submit("fact:1")).rejects.toThrow(/hourly ceiling/u);
      } finally {
        await db().query("ROLLBACK");
      }
    });

    it("never serves requests back through the read-only API role", async () => {
      await as("lokdarpan_readonly", async () => {
        await expect(db().query("SELECT * FROM correction_request")).rejects.toThrow(
          /permission denied/iu,
        );
      });
    });

    it("lets a reviewer record a decision, keeping the one it replaces", async () => {
      await db().query("BEGIN");
      try {
        const ref = (await submit("document:7")).rows[0]?.ref;
        await db().query("SET LOCAL ROLE lokdarpan_reviewer");
        await db().query(
          `UPDATE correction_request
              SET status = 'no_change', decided_by = 'reviewer@test', decided_at = now(),
                  resolution_note = 'Re-read page 12; the ledger matches it.'
            WHERE reference = $1`,
          [ref],
        );
        const history = await db().query<{ status: string }>(
          `SELECT h.status FROM correction_request_history h
             JOIN correction_request r ON r.id = h.correction_request_id
            WHERE r.reference = $1`,
          [ref],
        );
        expect(history.rows.map((h) => h.status)).toEqual(["received"]);
        await db().query("SAVEPOINT rewrite");
        await expect(
          db().query(
            `UPDATE correction_request SET description = 'rewritten' WHERE reference = $1`,
            [ref],
          ),
        ).rejects.toThrow(/permission denied/iu);
      } finally {
        await db().query("ROLLBACK");
      }
    });

    it.skipIf(INTAKE_URL === undefined || INTAKE_URL === "")(
      "lets the form's own login user submit, through the intake role",
      async () => {
        const intake = new pg.Client({ connectionString: INTAKE_URL });
        await intake.connect();
        try {
          await intake.query("BEGIN");
          const r = await intake.query<{ ref: string }>(
            `SELECT submit_correction('unit:20', 'place_wrong',
                    'This district is listed under the wrong state.', NULL) AS ref`,
          );
          expect(r.rows[0]?.ref).toMatch(/^LD-/u);
          await intake.query("ROLLBACK");
        } finally {
          await intake.end();
        }
      },
    );
  },
);
