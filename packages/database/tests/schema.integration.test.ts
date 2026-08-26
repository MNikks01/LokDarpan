import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "../src/migrator";

const DATABASE_URL = process.env["DATABASE_URL"];
const MIGRATIONS_DIR = new URL("../../../database/migrations", import.meta.url).pathname;

const ARTIFACT = "a".repeat(64);

/**
 * Runs only where a Postgres is reachable: `docker compose up -d` locally, and
 * a service container in CI. The schema's guarantees are claims about a real
 * database, so asserting them anywhere else would prove nothing.
 */
describe.skipIf(DATABASE_URL === undefined || DATABASE_URL === "")("schema (integration)", () => {
  // Genuinely undefined if beforeAll throws before connecting; afterAll still runs.
  let client: pg.Client | undefined;

  beforeAll(async () => {
    const c = new pg.Client({ connectionString: DATABASE_URL });
    await c.connect();
    client = c;
    await ensureMigrationTable(c);
    const all = await loadMigrations(MIGRATIONS_DIR);
    for (const migration of pendingMigrations(all, await readApplied(c))) {
      await applyMigration(c, migration);
    }
    await c.query(
      `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, byte_size, storage_path)
       VALUES ($1,'lgd','https://lgdirectory.gov.in/', now(), 100, 'raw/lgd/test')
       ON CONFLICT (sha256) DO NOTHING`,
      [ARTIFACT],
    );
    await c.query(
      `INSERT INTO dataset_version (description) SELECT 'integration test'
       WHERE NOT EXISTS (SELECT 1 FROM dataset_version)`,
    );
  }, 60_000);

  // Each test runs in a transaction that is rolled back, so a shared
  // development database is left exactly as it was found.
  beforeEach(async () => {
    await db().query("BEGIN");
  });

  afterEach(async () => {
    await db().query("ROLLBACK");
  });

  afterAll(async () => {
    await client?.end();
  });

  function db(): pg.Client {
    if (client === undefined) throw new Error("database connection was not established");
    return client;
  }

  async function versionId(): Promise<number> {
    const r = await db().query(`SELECT id FROM dataset_version ORDER BY id LIMIT 1`);
    return (r.rows[0] as { id: string }).id as unknown as number;
  }

  const insertUnit = async (overrides: Partial<Record<string, unknown>>): Promise<void> => {
    const row = {
      lgd_code: `T${String(Math.random()).slice(2, 10)}`,
      level: "state",
      name_en: "Testland",
      name_local: null,
      source_sha256: ARTIFACT,
      dataset_version_id: await versionId(),
      extraction_confidence: 1.0,
      valid_from: "2026-01-01",
      valid_to: null,
      ...overrides,
    };
    await db().query(
      `INSERT INTO admin_unit
         (lgd_code, level, name_en, name_local, source_sha256, dataset_version_id,
          extraction_confidence, valid_from, valid_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        row.lgd_code,
        row.level,
        row.name_en,
        row.name_local,
        row.source_sha256,
        row.dataset_version_id,
        row.extraction_confidence,
        row.valid_from,
        row.valid_to,
      ],
    );
  };

  it("has PostGIS available", async () => {
    const r = await db().query(`SELECT extname FROM pg_extension WHERE extname = 'postgis'`);
    expect(r.rows).toHaveLength(1);
  });

  it("accepts a well-formed unit, including a local-script name", async () => {
    await expect(
      insertUnit({ name_en: "Chhattisgarh", name_local: "छत्तीसगढ़" }),
    ).resolves.toBeUndefined();
  });

  // A fact whose source cannot be named must not exist. This is the invariant
  // the whole ledger rests on, so it is enforced by the database, not by a
  // service that could be bypassed.
  it("refuses a unit whose provenance artefact does not exist", async () => {
    await expect(insertUnit({ source_sha256: "f".repeat(64) })).rejects.toThrow();
  });

  it("refuses a blank name", async () => {
    await expect(insertUnit({ name_en: "   " })).rejects.toThrow();
  });

  // Missing is never an empty string, for the same reason missing is never zero.
  it("refuses an empty-string local name", async () => {
    await expect(insertUnit({ name_local: "" })).rejects.toThrow();
  });

  it("refuses a confidence outside 0..1", async () => {
    await expect(insertUnit({ extraction_confidence: 1.5 })).rejects.toThrow();
  });

  it("refuses a validity range that ends before it starts", async () => {
    await expect(
      insertUnit({ valid_from: "2026-01-01", valid_to: "2025-01-01" }),
    ).rejects.toThrow();
  });

  it("refuses a duplicate (lgd_code, level)", async () => {
    const code = `DUP${String(Math.random()).slice(2, 8)}`;
    await insertUnit({ lgd_code: code });
    await expect(insertUnit({ lgd_code: code })).rejects.toThrow();
  });

  it("applies migrations idempotently", async () => {
    const all = await loadMigrations(MIGRATIONS_DIR);
    expect(pendingMigrations(all, await readApplied(db()))).toHaveLength(0);
  });
});
