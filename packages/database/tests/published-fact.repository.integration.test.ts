import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PostgresPublishedFactRepository } from "../src/published-fact.repository";

const DATABASE_URL = process.env["DATABASE_URL"];
const ARTIFACT = `${"b".repeat(63)}1`;

/**
 * The repository takes a `Queryable`, so these tests hand it the same client
 * their fixtures were written on, inside a transaction that is rolled back.
 * Nothing commits, so nothing can leak into the shared development database -
 * committed fixtures have broken unrelated suites in this repository before.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")(
  "PostgresPublishedFactRepository (integration)",
  () => {
    let client: pg.Client | undefined;
    const db = (): pg.Client => {
      if (client === undefined) throw new Error("no database connection");
      return client;
    };
    let repository: PostgresPublishedFactRepository;
    let documentId = 0;

    beforeAll(async () => {
      const c = new pg.Client({ connectionString: DATABASE_URL });
      await c.connect();
      client = c;
      repository = new PostgresPublishedFactRepository(c);
    }, 30_000);

    afterAll(async () => {
      await client?.end();
    });

    beforeEach(async () => {
      await db().query("BEGIN");
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1,'cag','https://cag.gov.in/fixture.pdf', now(), 10, 'cag/fixture')
         ON CONFLICT (sha256) DO NOTHING`,
        [ARTIFACT],
      );
      const v = await db().query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('published fact fixture') RETURNING id`,
      );
      const d = await db().query<{ id: string }>(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title,
                               issuing_authority, mime_type, page_count, pages_without_text,
                               extraction_method)
         VALUES ($1,$2,'audit_report','Fixture Audit Report',
                 'Comptroller and Auditor General of India','application/pdf',337,4,'test')
         RETURNING id`,
        [ARTIFACT, Number(v.rows[0]?.id)],
      );
      documentId = Number(d.rows[0]?.id);
    });

    afterEach(async () => {
      await db().query("ROLLBACK");
    });

    const addFact = async (
      status: string,
      over: { value?: string | null; corrected?: string | null; page?: number } = {},
    ): Promise<void> => {
      await db().query(
        `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                    extraction_method, parser_version, extraction_confidence,
                                    verification_status, verified_by, verified_at, corrected_value)
         VALUES ($1,$2,'monetary_amount','a contract value of 15.14 crore',$3,'regex','cag-facts/2',
                 0.8,$4,$5,$6,$7)`,
        [
          documentId,
          over.page ?? 12,
          over.value === undefined ? "15140000000" : over.value,
          status,
          status === "unverified" ? null : "j.doe@example.org",
          status === "unverified" ? null : new Date(),
          over.corrected ?? null,
        ],
      );
    };

    // The guarantee the whole pipeline rests on, asserted at the read boundary.
    it("serves a verified fact and withholds every undecided one", async () => {
      await addFact("verified");
      await addFact("unverified", { page: 40 });

      const view = await repository.documentFacts(documentId);

      expect(view?.facts).toHaveLength(1);
      expect(view?.facts[0]).toMatchObject({ pageNumber: 12, verifiedBy: "j.doe@example.org" });
    });

    it("withholds a rejected fact", async () => {
      await addFact("rejected");
      expect((await repository.documentFacts(documentId))?.facts).toHaveLength(0);
    });

    it("serves the reviewer's correction, marked as theirs", async () => {
      await addFact("corrected", { corrected: "1514000000" });
      const fact = (await repository.documentFacts(documentId))?.facts[0];
      expect(fact).toMatchObject({ value: "15140000.00", origin: "corrected_by_reviewer" });
    });

    it("marks an uncorrected fact as read from the page as published", async () => {
      await addFact("verified");
      expect((await repository.documentFacts(documentId))?.facts[0]?.origin).toBe("as_extracted");
    });

    // A verified candidate the parser could not normalise, with no correction
    // supplied, states nothing. It stays in the ledger and out of the page.
    it("drops a published row that carries no value at all", async () => {
      await addFact("verified", { value: null });
      expect((await repository.documentFacts(documentId))?.facts).toHaveLength(0);
    });

    it("reports how many candidates still await review", async () => {
      await addFact("verified");
      await addFact("unverified", { page: 40 });
      await addFact("unverified", { page: 41 });
      expect((await repository.documentFacts(documentId))?.awaitingReview).toBe(2);
    });

    // A reader comparing this page to the PDF must be able to tell "not in the
    // report" from "in a part the extractor could not read".
    it("carries the document's unreadable page count and its provenance", async () => {
      const view = await repository.documentFacts(documentId);
      expect(view).toMatchObject({
        title: "Fixture Audit Report",
        pageCount: 337,
        pagesWithoutText: 4,
      });
      expect(view?.provenance).toMatchObject({
        sourceUrl: "https://cag.gov.in/fixture.pdf",
        issuingAuthority: "Comptroller and Auditor General of India",
      });
    });

    it("carries the evidence sentence with the fact", async () => {
      await addFact("verified");
      expect((await repository.documentFacts(documentId))?.facts[0]?.evidence).toContain(
        "15.14 crore",
      );
    });

    // The ledger stores paise; the client contract is decimal rupee strings.
    // Passing paise through unconverted would publish a figure a hundred times
    // too large under a correct-looking source link.
    it("converts the ledger's paise into a decimal string of rupees", async () => {
      await addFact("verified", { value: "15140000000" });
      const fact = (await repository.documentFacts(documentId))?.facts[0];
      expect(fact?.value).toBe("151400000.00");
    });

    it("withholds a monetary value that is not readable as paise", async () => {
      await addFact("verified", { value: "not-a-number" });
      expect((await repository.documentFacts(documentId))?.facts).toHaveLength(0);
    });

    // The licence gate, asserted at the read boundary. BEAMS terms require
    // written permission before reproduction, so its material is withheld
    // whole rather than shown with figures blanked - a page of empty rows
    // would still assert that this is a document we hold and have read.
    it("withholds a document whose publisher has not permitted republication", async () => {
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
         VALUES ($1,'beams','https://beams.mahakosh.gov.in/x', now(), 10, 'beams/x')
         ON CONFLICT (sha256) DO NOTHING`,
        [`${"a".repeat(63)}2`],
      );
      const v = await db().query<{ id: string }>(
        `INSERT INTO dataset_version (description) VALUES ('licence test') RETURNING id`,
      );
      const d = await db().query<{ id: string }>(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title,
                               issuing_authority, mime_type, page_count, pages_without_text,
                               extraction_method)
         VALUES ($1,$2,'audit_report','BEAMS Export','Finance Department','application/pdf',
                 1,0,'test')
         RETURNING id`,
        [`${"a".repeat(63)}2`, Number(v.rows[0]?.id)],
      );

      expect(await repository.documentFacts(Number(d.rows[0]?.id))).toBeNull();
    });

    it("carries the source id, so attribution is read from the licence registry", async () => {
      expect((await repository.documentFacts(documentId))?.provenance.sourceId).toBe("cag");
    });

    it("returns null for a document that does not exist", async () => {
      expect(await repository.documentFacts(2_147_483_000)).toBeNull();
    });

    it("lists documents with what is published and what is pending", async () => {
      await addFact("verified");
      await addFact("unverified", { page: 40 });
      const listed = (await repository.listDocuments()).find((d) => d.documentId === documentId);
      expect(listed).toMatchObject({ publishedFacts: 1, awaitingReview: 1 });
    });
  },
);
