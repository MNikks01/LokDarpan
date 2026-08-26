import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  applyMigration,
  checksumOf,
  loadMigrations,
  pendingMigrations,
  type AppliedMigration,
  type Migration,
  type SqlClient,
} from "../src/migrator";

async function dirWith(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lokdarpan-mig-"));
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, name), body, "utf8");
  }
  return dir;
}

class RecordingClient implements SqlClient {
  readonly statements: string[] = [];
  constructor(private readonly failOn?: string) {}
  query(sql: string): Promise<{ rows: unknown[] }> {
    this.statements.push(sql);
    if (this.failOn !== undefined && sql.includes(this.failOn)) {
      return Promise.reject(new Error("deliberate failure"));
    }
    return Promise.resolve({ rows: [] });
  }
}

const migration = (id: string, sql: string): Migration => ({ id, sql, checksum: checksumOf(sql) });

describe("loadMigrations", () => {
  it("reads .sql files in lexical order", async () => {
    const dir = await dirWith({
      "0002_b.sql": "SELECT 2;",
      "0001_a.sql": "SELECT 1;",
      "notes.txt": "ignored",
    });
    const found = await loadMigrations(dir);
    expect(found.map((m) => m.id)).toEqual(["0001_a.sql", "0002_b.sql"]);
  });

  it("rejects a filename with no defined ordering", async () => {
    const dir = await dirWith({ "add-users.sql": "SELECT 1;" });
    await expect(loadMigrations(dir)).rejects.toThrow(/does not match/);
  });

  it("rejects a duplicated numeric prefix", async () => {
    const dir = await dirWith({ "0001_a.sql": "SELECT 1;", "0001_b.sql": "SELECT 2;" });
    await expect(loadMigrations(dir)).rejects.toThrow(/Duplicate migration prefix/);
  });
});

describe("pendingMigrations", () => {
  const a = migration("0001_a.sql", "SELECT 1;");
  const b = migration("0002_b.sql", "SELECT 2;");

  it("returns everything when nothing is applied", () => {
    expect(pendingMigrations([a, b], []).map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it("returns only what has not run", () => {
    const applied: AppliedMigration[] = [{ id: a.id, checksum: a.checksum }];
    expect(pendingMigrations([a, b], applied).map((m) => m.id)).toEqual([b.id]);
  });

  it("refuses to run when an applied migration's file has changed", () => {
    const applied: AppliedMigration[] = [{ id: a.id, checksum: checksumOf("SELECT 999;") }];
    expect(() => pendingMigrations([a, b], applied)).toThrow(/file has changed/);
  });

  it("refuses when the database is ahead of the repository", () => {
    const applied: AppliedMigration[] = [
      { id: a.id, checksum: a.checksum },
      { id: "0099_unknown.sql", checksum: "x".repeat(64) },
    ];
    expect(() => pendingMigrations([a], applied)).toThrow(/database is ahead/);
  });
});

describe("applyMigration", () => {
  it("wraps the migration and its bookkeeping in one transaction", async () => {
    const client = new RecordingClient();
    await applyMigration(client, migration("0001_a.sql", "CREATE TABLE t ();"));
    expect(client.statements[0]).toBe("BEGIN");
    expect(client.statements.at(-1)).toBe("COMMIT");
    expect(client.statements.some((s) => s.includes("INSERT INTO schema_migration"))).toBe(true);
  });

  it("rolls back and rethrows when the migration fails", async () => {
    const client = new RecordingClient("CREATE TABLE broken");
    await expect(
      applyMigration(client, migration("0001_a.sql", "CREATE TABLE broken (;")),
    ).rejects.toThrow(/deliberate failure/);
    expect(client.statements).toContain("ROLLBACK");
    expect(client.statements).not.toContain("COMMIT");
  });

  it("does not record a migration whose statements failed", async () => {
    const client = new RecordingClient("CREATE TABLE broken");
    await expect(
      applyMigration(client, migration("0001_a.sql", "CREATE TABLE broken (;")),
    ).rejects.toThrow();
    expect(client.statements.some((s) => s.includes("INSERT INTO schema_migration"))).toBe(false);
  });
});
