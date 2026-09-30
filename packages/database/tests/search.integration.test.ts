import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "../src/migrator";
import { PostgresGeographyRepository } from "../src/geography.repository";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;

/**
 * Search over what is held (migration 0039).
 *
 * Every fixture lives inside a transaction that is rolled back, read through the
 * same client — the way a request reads, one snapshot client per request
 * (ADR-053). The names are invented so no other suite's rows can match them.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")("search (integration)", () => {
  let client: pg.Client | undefined;
  let repository: PostgresGeographyRepository | undefined;

  const db = (): pg.Client => {
    if (client === undefined) throw new Error("not connected");
    return client;
  };
  const search = (term: string) => {
    if (repository === undefined) throw new Error("not connected");
    return repository.search(term, 8);
  };

  beforeAll(async () => {
    const c = new pg.Client({ connectionString: DATABASE_URL });
    await c.connect();
    await ensureMigrationTable(c);
    const all = await loadMigrations(MIGRATIONS_DIR);
    for (const m of pendingMigrations(all, await readApplied(c))) await applyMigration(c, m);
    client = c;
    repository = new PostgresGeographyRepository(c);
  }, 60_000);

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(async () => {
    await db().query("BEGIN");
    const artifact = async (sha: string, sourceId: string): Promise<void> => {
      await db().query(
        `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)
         VALUES ($1, $2, 'https://example.invalid/', now(), 1, 'test/s', 'file')`,
        [sha, sourceId],
      );
    };
    await artifact("5a".repeat(32), "lgd");
    await artifact("5b".repeat(32), "cag");
    await artifact("5c".repeat(32), "beams");
    const version = await db().query<{ id: string }>(
      `INSERT INTO dataset_version (description) VALUES ('search test') RETURNING id`,
    );
    const v = version.rows[0]?.id;

    const unit = async (level: string, name: string, local: string | null): Promise<void> => {
      await db().query(
        `INSERT INTO admin_unit (lgd_code, level, name_en, name_local, source_sha256,
                                 dataset_version_id, extraction_confidence, valid_from)
         VALUES ($1, $2::admin_unit_level, $3, $4, $5, $6, 1, '2026-01-01')`,
        [`Q${String(Math.random()).slice(2, 9)}`, level, name, local, "5a".repeat(32), v],
      );
    };
    await unit("state", "Qorvessa", "कोर्वेसा");
    await unit("district", "Qorvessa Nagar", null);
    // Contains the term, starts with something else, and has no local name:
    // the shape that a NULL in the ranking used to put first.
    await unit("district", "Upper Qorvessa Hills", null);

    const document = async (sha: string, title: string): Promise<number> => {
      const d = await db().query<{ id: string }>(
        `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title, mime_type,
                               page_count, pages_without_text, extraction_method)
         VALUES ($1, $2, 'audit_report', $3, 'application/pdf', 2, 0, 'test') RETURNING id`,
        [sha, v, title],
      );
      return Number(d.rows[0]?.id);
    };
    const cag = await document("5b".repeat(32), "Zelvorine Audit Report No. 9");
    const beams = await document("5c".repeat(32), "Zelvorine Treasury Export");

    await db().query(
      `INSERT INTO document_page (document_id, page_number, content, script) VALUES
         ($1, 1, 'The Trellisford embankment was completed after the monsoon.', 'latin'),
         ($1, 2, 'त्रेलिसफोर्ड तटबंध का कार्य पूर्ण हुआ।', 'devanagari'),
         ($2, 1, 'Trellisford treasury lines that may not be republished.', 'latin')`,
      [cag, beams],
    );

    const fact = async (document: number, status: string, text: string): Promise<void> => {
      const decided = status !== "unverified";
      await db().query(
        `INSERT INTO document_fact (document_id, page_number, kind, raw_text, normalised_value,
                                    extraction_method, parser_version, extraction_confidence,
                                    verification_status, verified_by, verified_at, corrected_value)
         VALUES ($1, 1, 'monetary_amount', $2, '500000000', 'test', 't', 0.9,
                 $3::verification_status, $4, $5, $6)`,
        [
          document,
          text,
          status,
          decided ? "A Reviewer" : null,
          decided ? new Date() : null,
          status === "corrected" ? "400000000" : null,
        ],
      );
    };
    const sentence = "The Glimmerstone bridge cost ₹ 5 crore against ₹ 4 crore sanctioned.";
    // Two figures in one sentence: one result, not the line twice.
    await fact(cag, "verified", sentence);
    await fact(cag, "corrected", sentence);
    await fact(cag, "unverified", "The Glimmerstone approach road cost ₹ 9 crore.");
    await fact(cag, "rejected", "The Glimmerstone culvert cost ₹ 2 crore.");
    await fact(beams, "verified", "The Glimmerstone treasury line was ₹ 7 crore.");
  });

  afterEach(async () => {
    await db().query("ROLLBACK");
  });

  const kinds = <T extends { kind: string }>(results: readonly T[], kind: string): T[] =>
    results.filter((r) => r.kind === kind);

  it("puts the place that starts with the term first, and one that merely contains it after", async () => {
    const places = kinds(await search("Qorvessa"), "place");
    expect(places.map((p) => p.title)).toEqual([
      "Qorvessa",
      "Qorvessa Nagar",
      "Upper Qorvessa Hills",
    ]);
  });

  it("finds a place through a near-miss spelling", async () => {
    const places = kinds(await search("Qorvesa"), "place");
    expect(places[0]?.title).toBe("Qorvessa");
  });

  it("finds a place by its local-script name", async () => {
    const places = kinds(await search("कोर्वेसा"), "place");
    expect(places.map((p) => p.title)).toContain("Qorvessa");
  });

  it("finds a report by its title, and not one whose publisher has not permitted republication", async () => {
    const records = kinds(await search("Zelvorine"), "record");
    expect(records.map((r) => r.title)).toEqual(["Zelvorine Audit Report No. 9"]);
  });

  it("finds a verified figure by its words, once per sentence, with its page", async () => {
    const figures = kinds(await search("Glimmerstone bridge"), "figure");
    expect(figures).toHaveLength(1);
    expect(figures[0]?.pageNumber).toBe(1);
    expect(figures[0]?.excerpt).toContain("Glimmerstone bridge");
    expect(figures[0]?.documentId).not.toBeNull();
  });

  // A figure nobody verified, or one a person rejected, is not shown on its
  // page; search must not show it either.
  it("never returns an unverified or rejected figure, or one from a withheld source", async () => {
    const texts = kinds(await search("Glimmerstone"), "figure").map((f) => f.excerpt);
    expect(texts).toEqual(["The Glimmerstone bridge cost ₹ 5 crore against ₹ 4 crore sanctioned."]);
  });

  it("finds report pages by what they say, in either script, with an excerpt", async () => {
    const english = kinds(await search("Trellisford embankment"), "passage");
    expect(english).toHaveLength(1);
    expect(english[0]?.pageNumber).toBe(1);
    expect(english[0]?.title).toBe("Zelvorine Audit Report No. 9");
    expect(english[0]?.excerpt).toContain("embankment");

    const hindi = kinds(await search("तटबंध"), "passage");
    expect(hindi.map((p) => p.pageNumber)).toEqual([2]);
  });

  it("treats wildcard characters in a term as the characters themselves", async () => {
    // Unescaped, "Q%s" would be `ILIKE '%Q%s%'` and match every Qorvessa name;
    // escaped, it is three characters no name contains, and too unlike any
    // name for the fuzzy match to reach.
    expect(kinds(await search("%%"), "place")).toEqual([]);
    expect(kinds(await search("Q%s"), "place")).toEqual([]);
    expect(kinds(await search("Q_rvessa"), "place").map((p) => p.title)).not.toContain(
      "Upper Qorvessa Hills",
    );
  });

  it("ignores a term too short to mean anything", async () => {
    expect(await search(" Q ")).toEqual([]);
  });
});
