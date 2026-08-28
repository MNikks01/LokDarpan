import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REVIEWER_URL = process.env["DATABASE_URL_REVIEWER"];

/**
 * Migration 0008 grants the reviewer a column-scoped UPDATE on document_fact
 * and nothing else. That narrowness is the whole design: it makes the rule
 * "never modify the original source document" a privilege the database
 * enforces, rather than a discipline the review tool has to remember.
 *
 * These tests connect as the reviewer's own login user and issue the
 * statements rather than inspecting `has_column_privilege`, because a
 * privilege check only restates the grant while running the statement proves
 * what actually happens.
 */
describe.skipIf(REVIEWER_URL === undefined || REVIEWER_URL === "")(
  "reviewer role (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };

    beforeAll(async () => {
      const c = new pg.Client({ connectionString: REVIEWER_URL });
      await c.connect();
      client = c;
    }, 30_000);

    afterAll(async () => {
      await client?.end();
    });

    // Each attempt runs in its own transaction so a rejected statement cannot
    // poison the next, and nothing survives even if a grant ever regresses.
    const refuses = async (label: string, sql: string): Promise<void> => {
      await db().query("BEGIN");
      try {
        await expect(db().query(sql), label).rejects.toThrow(/permission denied|must be owner/i);
      } finally {
        await db().query("ROLLBACK");
      }
    };

    const allows = async (sql: string): Promise<void> => {
      await db().query("BEGIN");
      try {
        await expect(db().query(sql)).resolves.toBeDefined();
      } finally {
        await db().query("ROLLBACK");
      }
    };

    it("can read candidates, and the provenance needed to judge them", async () => {
      const r = await db().query(
        `SELECT f.id FROM document_fact f
           JOIN document d        ON d.id = f.document_id
           JOIN source_artifact s ON s.sha256 = d.source_sha256 LIMIT 1`,
      );
      expect(r.rows.length).toBeLessThanOrEqual(1);
    });

    it("can record a decision", async () => {
      await allows(
        `UPDATE document_fact SET verification_status = 'rejected',
                verified_by = 'test', verified_at = now(), reviewer_note = 'n'`,
      );
    });

    it("can supply a correction", async () => {
      await allows(`UPDATE document_fact SET corrected_value = '42'`);
    });

    // The load-bearing one. A reviewer records a judgement beside what the
    // parser read; they never overwrite it. Anyone auditing the decision later
    // must still be able to see the text the claim was drawn from.
    it("cannot rewrite the text the parser read from the page", async () => {
      await refuses("raw_text", `UPDATE document_fact SET raw_text = 'rewritten'`);
    });

    it("cannot rewrite the parser's normalised reading", async () => {
      await refuses("normalised_value", `UPDATE document_fact SET normalised_value = '999'`);
    });

    it("cannot move a candidate to a different page or document", async () => {
      await refuses("page_number", `UPDATE document_fact SET page_number = 1`);
      await refuses("document_id", `UPDATE document_fact SET document_id = 1`);
    });

    it("cannot restate how or by what version the claim was extracted", async () => {
      await refuses(
        "extraction_confidence",
        `UPDATE document_fact SET extraction_confidence = 1.0`,
      );
      await refuses("parser_version", `UPDATE document_fact SET parser_version = 'x'`);
    });

    // Review is judging what a parser produced. A hand-written candidate would
    // have no parser run behind it and no evidence it was ever extracted.
    it("cannot invent a candidate", async () => {
      await refuses(
        "insert",
        `INSERT INTO document_fact (document_id, page_number, kind, raw_text,
                                    extraction_method, parser_version, extraction_confidence)
         VALUES (1, 1, 'monetary_amount', 'invented', 'by hand', 'none', 1.0)`,
      );
    });

    // Rejecting a claim must leave a record that it was considered and refused.
    // A deletion would erase the evidence that the review ever happened.
    it("cannot delete a candidate it has rejected", async () => {
      await refuses("delete", `DELETE FROM document_fact`);
    });

    it("cannot touch the raw-artefact store or the ledger", async () => {
      await refuses(
        "source_artifact",
        `UPDATE source_artifact SET source_url = 'https://x.example'`,
      );
      await refuses("admin_unit", `UPDATE admin_unit SET name_en = 'Renamed'`);
      await refuses("document", `UPDATE document SET title = 'Retitled'`);
    });

    // The point of writing history from a SECURITY DEFINER trigger. A reviewer
    // who can author, edit or delete their own audit trail does not have one.
    it("can read the record of superseded decisions", async () => {
      const r = await db().query(`SELECT count(*) FROM document_fact_review_history`);
      expect(r.rows).toHaveLength(1);
    });

    it("cannot write, alter or erase the record of superseded decisions", async () => {
      await refuses(
        "insert history",
        `INSERT INTO document_fact_review_history (document_fact_id, verification_status)
         VALUES (1, 'verified')`,
      );
      await refuses(
        "update history",
        `UPDATE document_fact_review_history SET verified_by = 'someone else'`,
      );
      await refuses("delete history", `DELETE FROM document_fact_review_history`);
    });

    it("is not a superuser and cannot create databases or roles", async () => {
      const r = await db().query<{
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
      }>(`SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`);
      expect(r.rows[0]).toMatchObject({
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
      });
    });
  },
);
