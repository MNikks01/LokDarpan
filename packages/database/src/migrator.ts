import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Minimal surface of a `pg` client — keeps this module testable without a server. */
export interface SqlClient {
  query(sql: string, values?: readonly unknown[]): Promise<{ rows: unknown[] }>;
}

export interface Migration {
  readonly id: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface AppliedMigration {
  readonly id: string;
  readonly checksum: string;
}

const MIGRATION_FILE = /^(\d{4})_[a-z0-9_]+\.sql$/;

export function checksumOf(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

/**
 * Reads migrations in lexical order. Filenames are `NNNN_snake_case.sql`;
 * anything else is a mistake, not a file to skip silently.
 */
export async function loadMigrations(dir: string): Promise<Migration[]> {
  const entries = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  const migrations: Migration[] = [];
  for (const name of entries) {
    if (!MIGRATION_FILE.test(name)) {
      throw new Error(
        `Migration filename "${name}" does not match NNNN_snake_case.sql. ` +
          `Ordering is derived from the numeric prefix, so a non-conforming name has no defined position.`,
      );
    }
    const sql = await readFile(join(dir, name), "utf8");
    migrations.push({ id: name, sql, checksum: checksumOf(sql) });
  }

  const seen = new Set<string>();
  for (const m of migrations) {
    const prefix = m.id.slice(0, 4);
    if (seen.has(prefix)) {
      throw new Error(`Duplicate migration prefix ${prefix} — ordering would be ambiguous.`);
    }
    seen.add(prefix);
  }

  return migrations;
}

export async function ensureMigrationTable(client: SqlClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      id          TEXT        PRIMARY KEY,
      checksum    CHAR(64)    NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function readApplied(client: SqlClient): Promise<AppliedMigration[]> {
  const result = await client.query(`SELECT id, checksum FROM schema_migration ORDER BY id`);
  return result.rows as AppliedMigration[];
}

/**
 * An applied migration whose file has since changed is a hard error, never a
 * re-run: the database and the repository disagree about what was executed,
 * and re-running would apply a different statement than the one recorded.
 */
export function pendingMigrations(
  all: readonly Migration[],
  applied: readonly AppliedMigration[],
): Migration[] {
  const byId = new Map(applied.map((a) => [a.id, a.checksum]));

  for (const m of all) {
    const recorded = byId.get(m.id);
    if (recorded !== undefined && recorded !== m.checksum) {
      throw new Error(
        `Migration ${m.id} was already applied, but its file has changed since ` +
          `(recorded ${recorded.slice(0, 12)}…, file ${m.checksum.slice(0, 12)}…). ` +
          `Applied migrations are immutable — add a new migration instead of editing this one.`,
      );
    }
  }

  const unknownToRepo = applied.filter((a) => !all.some((m) => m.id === a.id));
  if (unknownToRepo.length > 0) {
    throw new Error(
      `Database reports migrations this repository does not contain: ` +
        `${unknownToRepo.map((a) => a.id).join(", ")}. ` +
        `The database is ahead of the code; deploying would be a downgrade.`,
    );
  }

  return all.filter((m) => !byId.has(m.id));
}

export async function applyMigration(client: SqlClient, migration: Migration): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(migration.sql);
    await client.query(`INSERT INTO schema_migration (id, checksum) VALUES ($1, $2)`, [
      migration.id,
      migration.checksum,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
