import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "@lokdarpan/database";

import { PARSER_VERSION, type FactCandidate } from "../src/cag/facts";
import { loadFactCandidates } from "../src/cag/facts-load";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;
const ARTIFACT = "c".repeat(64);

const money: FactCandidate = {
  kind: "monetary_amount",
  pageNumber: 12,
  rawText: "awarded to M/s. Vijay Constructions for ₹ 15.14 crore",
  normalisedValue: "15140000000",
  extractionConfidence: 0.8,
  validation: { state: "needs_review", reason: "" },
  perUnit: null,
};

/** The same figure, once the extractor can say where on the page it sits. */
const moneyWithBox: FactCandidate = {
  ...money,
  box: { x0: 72, y0: 700, x1: 210, y1: 709 },
};

const firm: FactCandidate = {
  kind: "contractor_reference",
  pageNumber: 12,
  rawText: "awarded to M/s. Vijay Constructions for ₹ 15.14 crore",
  normalisedValue: "Vijay Constructions",
  extractionConfidence: 0.7,
  validation: { state: "needs_review", reason: "" },
  perUnit: null,
};

describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "loadFactCandidates (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
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
        `INSERT INTO dataset_version (description) VALUES ('fact load test') RETURNING id`,
      );
      const d = await db().query<{ id: string }>(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title,
                               issuing_authority, mime_type, page_count, pages_without_text, extraction_method)
         VALUES ($1,$2,'audit_report','Test Report','CAG','application/pdf',20,0,'test')
         RETURNING id`,
        [ARTIFACT, Number(v.rows[0]?.id)],
      );
      documentId = Number(d.rows[0]?.id);
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const statusOf = async (): Promise<string | undefined> => {
      const r = await db().query<{ verification_status: string }>(
        `SELECT verification_status FROM document_fact WHERE document_id = $1 AND kind = 'monetary_amount'`,
        [documentId],
      );
      return r.rows[0]?.verification_status;
    };

    const countFacts = async (): Promise<number> => {
      const r = await db().query<{ count: string }>(
        `SELECT count(*) FROM document_fact WHERE document_id = $1`,
        [documentId],
      );
      return Number(r.rows[0]?.count);
    };

    const boxOf = async (): Promise<{ x0: string | null } | undefined> => {
      const r = await db().query<{ x0: string | null }>(
        `SELECT bbox_x0 AS x0 FROM document_fact
          WHERE document_id = $1 AND kind = 'monetary_amount'`,
        [documentId],
      );
      return r.rows[0];
    };

    // A box is not part of a fact's identity and not part of what a person
    // reviewed: it says where on the page a figure the reviewer already read is
    // sitting. So it fills in whatever the row's status.
    //
    // This was first written to backfill only `unverified` rows, which left
    // every decided fact — the only ones a reader can reach — as the ones with
    // no region to show. Each status is checked here because that bug type-
    // checked and passed every other test.
    describe.each(["verified", "rejected", "corrected"])("a %s fact", (status) => {
      it("gains its region without being re-offered or re-decided", async () => {
        await loadFactCandidates(db(), documentId, [money]);
        await db().query(
          `UPDATE document_fact SET verification_status = $2, corrected_value = $3,
                  verified_by = 'reviewer@example.test', verified_at = now()
            WHERE document_id = $1 AND kind = 'monetary_amount'`,
          [documentId, status, status === "corrected" ? "1" : null],
        );
        expect((await boxOf())?.x0).toBeNull();

        const again = await loadFactCandidates(db(), documentId, [moneyWithBox]);

        expect(again.inserted).toBe(0);
        expect(again.located).toBe(1);
        expect(Number((await boxOf())?.x0)).toBe(72);
        expect(await statusOf()).toBe(status);
      });
    });

    it("does not rewrite a box it has already recorded", async () => {
      await loadFactCandidates(db(), documentId, [moneyWithBox]);
      const again = await loadFactCandidates(db(), documentId, [moneyWithBox]);
      expect(again.located).toBe(0);
      expect(Number((await boxOf())?.x0)).toBe(72);
    });

    it("leaves a fact unlocated when the extractor could not place it", async () => {
      await loadFactCandidates(db(), documentId, [money]);
      const again = await loadFactCandidates(db(), documentId, [money]);
      expect(again.located).toBe(0);
      expect((await boxOf())?.x0).toBeNull();
    });

    it("inserts each candidate as unverified", async () => {
      const r = await loadFactCandidates(db(), documentId, [money, firm]);
      expect(r).toEqual({
        inserted: 2,
        skippedAlreadyReviewed: 0,
        refreshed: 0,
        located: 0,
        retired: 0,
        strandedDecisions: 0,
      });
      expect(await statusOf()).toBe("unverified");
    });

    it("does not duplicate a candidate when the parser is re-run", async () => {
      await loadFactCandidates(db(), documentId, [money, firm]);
      const again = await loadFactCandidates(db(), documentId, [money, firm]);
      expect(again.inserted).toBe(0);
      expect(await countFacts()).toBe(2);
    });

    // The guarantee the review gate rests on. A re-extraction that reset review
    // state would silently republish a claim a person had already rejected.
    it("leaves a verified candidate untouched on re-extraction", async () => {
      await loadFactCandidates(db(), documentId, [money]);
      await db().query(
        `UPDATE document_fact SET verification_status = 'verified',
                verified_by = 'reviewer@example.test', verified_at = now()
          WHERE document_id = $1`,
        [documentId],
      );

      const again = await loadFactCandidates(db(), documentId, [money]);

      expect(again).toEqual({
        inserted: 0,
        skippedAlreadyReviewed: 1,
        refreshed: 0,
        located: 0,
        retired: 0,
        strandedDecisions: 0,
      });
      expect(await statusOf()).toBe("verified");
      expect(await countFacts()).toBe(1);
    });

    it("leaves a rejected candidate rejected, and does not re-offer it", async () => {
      await loadFactCandidates(db(), documentId, [money]);
      await db().query(
        `UPDATE document_fact SET verification_status = 'rejected',
                verified_by = 'reviewer@example.test', verified_at = now()
          WHERE document_id = $1`,
        [documentId],
      );

      const again = await loadFactCandidates(db(), documentId, [money]);

      expect(again.skippedAlreadyReviewed).toBe(1);
      expect(await statusOf()).toBe("rejected");
    });

    it("keeps a reviewer's correction rather than the parser's reading", async () => {
      await loadFactCandidates(db(), documentId, [money]);
      await db().query(
        `UPDATE document_fact SET verification_status = 'corrected',
                corrected_value = '9999999999', verified_by = 'reviewer@example.test',
                verified_at = now()
          WHERE document_id = $1`,
        [documentId],
      );

      await loadFactCandidates(db(), documentId, [money]);

      const r = await db().query<{ value: string }>(
        `SELECT value FROM published_fact WHERE document_id = $1`,
        [documentId],
      );
      expect(r.rows[0]?.value).toBe("9999999999");
    });

    // Two candidates differing only in normalised value are different claims:
    // the same sentence can state an amount and name a firm.
    it("treats candidates of different kinds on one sentence as distinct", async () => {
      const r = await loadFactCandidates(db(), documentId, [money, firm]);
      expect(r.inserted).toBe(2);
    });

    it("stores a candidate whose value could not be normalised", async () => {
      const unreadable: FactCandidate = { ...money, normalisedValue: null };
      await loadFactCandidates(db(), documentId, [unreadable]);
      const r = await db().query<{ normalised_value: string | null }>(
        `SELECT normalised_value FROM document_fact WHERE document_id = $1`,
        [documentId],
      );
      expect(r.rows[0]?.normalised_value).toBeNull();
    });

    it("publishes nothing that no one has reviewed", async () => {
      await loadFactCandidates(db(), documentId, [money, firm]);
      const r = await db().query<{ count: string }>(
        `SELECT count(*) FROM published_fact WHERE document_id = $1`,
        [documentId],
      );
      expect(Number(r.rows[0]?.count)).toBe(0);
    });

    it("does nothing when the parser found nothing", async () => {
      expect(await loadFactCandidates(db(), documentId, [])).toEqual({
        inserted: 0,
        skippedAlreadyReviewed: 0,
        refreshed: 0,
        located: 0,
        retired: 0,
        strandedDecisions: 0,
      });
    });

    // Fixing how a sentence is read must replace the old reading, not sit
    // beside it. `₹ 20 ,564.71 कोटी` was stored unvalued until the digit group
    // tolerated the text layer's injected space; the superseded row would
    // otherwise have stayed in the queue asking a reviewer to supply a scale
    // that is printed on the page.
    it("retires an undecided candidate the parser no longer produces", async () => {
      await loadFactCandidates(db(), documentId, [money]);

      const reread = { ...money, normalisedValue: "20564710000000" };
      const again = await loadFactCandidates(db(), documentId, [reread]);

      expect(again.inserted).toBe(1);
      expect(again.retired).toBe(1);
      expect(again.strandedDecisions).toBe(0);
      expect(await countFacts()).toBe(1);
    });

    // A decision belongs to the person who made it. The parser reports that it
    // has stopped producing the candidate and changes nothing.
    it("never retires a decided fact, and counts it as stranded", async () => {
      await loadFactCandidates(db(), documentId, [money]);
      await db().query(
        `UPDATE document_fact SET verification_status = 'verified',
                verified_by = 'reviewer@example.test', verified_at = now()
          WHERE document_id = $1`,
        [documentId],
      );

      const again = await loadFactCandidates(db(), documentId, []);

      expect(again.retired).toBe(0);
      expect(again.strandedDecisions).toBe(1);
      expect(await statusOf()).toBe("verified");
      expect(await countFacts()).toBe(1);
    });

    // An undecided candidate's provenance is the parser that currently produces
    // it. A row claiming a parser version that no longer exists misdescribes how
    // a figure was arrived at, and these are the rows about to be published.
    it("brings an undecided row's parser version up to date", async () => {
      await loadFactCandidates(db(), documentId, [money]);
      await db().query(
        `UPDATE document_fact SET parser_version = 'cag-facts/1' WHERE document_id = $1`,
        [documentId],
      );

      const again = await loadFactCandidates(db(), documentId, [money]);

      expect(again.refreshed).toBe(1);
      expect(again.inserted).toBe(0);
      const v = await db().query<{ parser_version: string }>(
        `SELECT parser_version FROM document_fact WHERE document_id = $1`,
        [documentId],
      );
      expect(v.rows[0]?.parser_version).toBe(PARSER_VERSION);
    });

    // A decided row's version is part of what a person reviewed. The parser
    // does not get to restate that.
    it("leaves a decided row's parser version alone", async () => {
      await loadFactCandidates(db(), documentId, [money]);
      await db().query(
        `UPDATE document_fact SET parser_version = 'cag-facts/1',
                verification_status = 'verified', verified_by = 'reviewer@example.test',
                verified_at = now() WHERE document_id = $1`,
        [documentId],
      );

      const again = await loadFactCandidates(db(), documentId, [money]);

      expect(again.refreshed).toBe(0);
      const v = await db().query<{ parser_version: string }>(
        `SELECT parser_version FROM document_fact WHERE document_id = $1`,
        [documentId],
      );
      expect(v.rows[0]?.parser_version).toBe("cag-facts/1");
    });

    // Two amounts in one short sentence share an evidence window, so the value
    // has to be part of a candidate's identity. Were it not, the second would
    // look like a re-reading of the first and retire it.
    it("keeps two figures that share an evidence window", async () => {
      const other = { ...money, normalisedValue: "20000000000" };
      const r = await loadFactCandidates(db(), documentId, [money, other]);

      expect(r.inserted).toBe(2);
      expect(r.retired).toBe(0);
      expect(await countFacts()).toBe(2);
    });
  },
);
