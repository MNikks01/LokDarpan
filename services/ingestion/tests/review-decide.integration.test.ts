import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { ReviewError, assertReviewer, decisionForKey, recordDecision } from "../src/review/decide";
import { pendingReview, reviewProgress } from "../src/review/queue";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const ARTIFACT = "d".repeat(64);

describe("assertReviewer", () => {
  // `verified_by` is the audit trail. A decision nobody is accountable for is
  // not a review; it is an anonymous publication of a claim about a company.
  it("refuses a placeholder that names nobody", () => {
    for (const name of ["", "  ", "me", "admin", "TEST", "unknown"]) {
      expect(() => {
        assertReviewer(name);
      }, name).toThrow(ReviewError);
    }
  });

  it("accepts an identity that could be traced to a person", () => {
    expect(() => {
      assertReviewer("j.doe@example.org");
    }).not.toThrow();
  });
});

describe("decisionForKey", () => {
  it("maps the three keys that mean something", () => {
    expect(decisionForKey("v")).toBe("verified");
    expect(decisionForKey("r")).toBe("rejected");
    expect(decisionForKey("c")).toBe("corrected");
  });

  it("accepts the key however it was typed", () => {
    expect(decisionForKey(" V ")).toBe("verified");
  });

  // Publishing a claim about a named company because someone fumbled a
  // keystroke is the specific accident the review step exists to prevent.
  it("treats everything else as no decision at all", () => {
    for (const key of ["", " ", "x", "y", "yes", "1", "!", "verify", "q"]) {
      expect(decisionForKey(key), key).toBeNull();
    }
  });
});

describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "recordDecision (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let factId = 0;
    let documentId = 0;

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

    // Every test runs inside a transaction that is rolled back, so nothing
    // reaches the shared database and no test can see another's rows.
    beforeEach(async () => {
      await db().query("BEGIN");
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1,'cag','https://cag.gov.in/t.pdf', now(), 10, 'cag/t')
         ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT],
      );
      const v = await db().query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('review test') RETURNING id`,
      );
      const d = await db().query<{ id: string }>(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title,
                               issuing_authority, mime_type, page_count, pages_without_text,
                               extraction_method)
         VALUES ($1,$2,'audit_report','Test Report','CAG','application/pdf',20,0,'test')
         RETURNING id`,
        [ARTIFACT, Number(v.rows[0]?.id)],
      );
      documentId = Number(d.rows[0]?.id);
      const f = await db().query<{ id: string }>(
        `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                    extraction_method, parser_version, extraction_confidence)
         VALUES ($1, 12, 'monetary_amount', 'a contract value of 15.14 crore', '15140000000',
                 'regex', 'cag-facts/2', 0.8)
         RETURNING id`,
        [documentId],
      );
      factId = Number(f.rows[0]?.id);
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const statusOf = async (): Promise<Record<string, unknown> | undefined> => {
      const r = await db().query(
        `SELECT verification_status, verified_by, verified_at, corrected_value, reviewer_note
           FROM document_fact WHERE id = $1`,
        [factId],
      );
      return r.rows[0] as Record<string, unknown> | undefined;
    };

    it("records a verification, signed and timestamped", async () => {
      expect(
        await recordDecision(db(), { factId, decision: "verified", reviewer: "j.doe@example.org" }),
      ).toBe(true);
      const row = await statusOf();
      expect(row).toMatchObject({
        verification_status: "verified",
        verified_by: "j.doe@example.org",
      });
      expect(row?.["verified_at"]).not.toBeNull();
    });

    it("publishes a verified fact, and only then", async () => {
      const before = await db().query(`SELECT id FROM published_fact WHERE id = $1`, [factId]);
      expect(before.rows).toHaveLength(0);

      await recordDecision(db(), { factId, decision: "verified", reviewer: "j.doe@example.org" });

      const after = await db().query(`SELECT id FROM published_fact WHERE id = $1`, [factId]);
      expect(after.rows).toHaveLength(1);
    });

    // A rejected claim stays on the record as considered and refused. It must
    // never reach a reader, and never silently disappear either.
    it("keeps a rejected candidate recorded but unpublished", async () => {
      await recordDecision(db(), { factId, decision: "rejected", reviewer: "j.doe@example.org" });
      expect((await statusOf())?.["verification_status"]).toBe("rejected");
      const published = await db().query(`SELECT id FROM published_fact WHERE id = $1`, [factId]);
      expect(published.rows).toHaveLength(0);
    });

    it("publishes the reviewer's correction in place of the parser's reading", async () => {
      await recordDecision(db(), {
        factId,
        decision: "corrected",
        reviewer: "j.doe@example.org",
        correctedValue: "1514000000",
        note: "parser read the unit as crore; the page says lakh",
      });
      const r = await db().query<{ value: string }>(
        `SELECT value FROM published_fact WHERE id = $1`,
        [factId],
      );
      expect(r.rows[0]?.value).toBe("1514000000");
    });

    // The original stays visible beside the correction. Anyone auditing the
    // decision later must be able to see what the parser actually read.
    it("leaves the parser's reading intact under a correction", async () => {
      await recordDecision(db(), {
        factId,
        decision: "corrected",
        reviewer: "j.doe@example.org",
        correctedValue: "1514000000",
      });
      const r = await db().query<{ normalised_value: string; raw_text: string }>(
        `SELECT normalised_value, raw_text FROM document_fact WHERE id = $1`,
        [factId],
      );
      expect(r.rows[0]?.normalised_value).toBe("15140000000");
      expect(r.rows[0]?.raw_text).toContain("15.14 crore");
    });

    it("refuses a correction with no corrected value", async () => {
      await expect(
        recordDecision(db(), {
          factId,
          decision: "corrected",
          reviewer: "j.doe@example.org",
          correctedValue: "   ",
        }),
      ).rejects.toThrow(ReviewError);
      expect((await statusOf())?.["verification_status"]).toBe("unverified");
    });

    // Ambiguous provenance: is the published figure the parser's or the
    // reviewer's? `corrected` is how a reviewer says the value is theirs.
    it("refuses a value attached to anything but a correction", async () => {
      await expect(
        recordDecision(db(), {
          factId,
          decision: "verified",
          reviewer: "j.doe@example.org",
          correctedValue: "999",
        }),
      ).rejects.toThrow(ReviewError);
    });

    it("refuses an unattributed decision, and writes nothing", async () => {
      await expect(
        recordDecision(db(), { factId, decision: "verified", reviewer: "me" }),
      ).rejects.toThrow(ReviewError);
      expect((await statusOf())?.["verification_status"]).toBe("unverified");
    });

    // Losing the second decision is recoverable; overwriting the first
    // silently is not.
    it("does not overwrite a decision already made", async () => {
      await recordDecision(db(), { factId, decision: "verified", reviewer: "first@example.org" });
      const second = await recordDecision(db(), {
        factId,
        decision: "rejected",
        reviewer: "second@example.org",
      });
      expect(second).toBe(false);
      expect(await statusOf()).toMatchObject({
        verification_status: "verified",
        verified_by: "first@example.org",
      });
    });

    it("stops offering a candidate once it has been decided", async () => {
      const before = await pendingReview(db(), { documentId });
      await recordDecision(db(), { factId, decision: "verified", reviewer: "j.doe@example.org" });
      const after = await pendingReview(db(), { documentId });
      expect(after.map((c) => c.id)).not.toContain(factId);
      expect(after.length).toBe(before.length - 1);
    });

    it("counts what remains, so the end of the queue is visible from inside it", async () => {
      const before = await reviewProgress(db());
      await recordDecision(db(), { factId, decision: "verified", reviewer: "j.doe@example.org" });
      const after = await reviewProgress(db());
      expect(after.verified).toBe(before.verified + 1);
      expect(after.unverified).toBe(before.unverified - 1);
    });

    it("offers a candidate with its evidence and citation, ready to judge", async () => {
      const queue = await pendingReview(db(), { documentId, kind: "monetary_amount" });
      const mine = queue.find((c) => c.id === factId);
      expect(mine).toMatchObject({
        pageNumber: 12,
        kind: "monetary_amount",
        normalisedValue: "15140000000",
        documentTitle: "Test Report",
      });
      expect(mine?.rawText).toContain("15.14 crore");
      expect(mine?.sourceUrl).toContain("cag.gov.in");
    });
  },
);
