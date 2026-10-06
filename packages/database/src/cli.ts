import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
  type Migration,
} from "./migrator";

const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../database/migrations",
);

/**
 * `--status`: what applying would do, without doing any of it.
 *
 * Production's migrations are applied by hand with the owner credential
 * (`.docs/16-operations/applying-migrations.md`), and the first thing to know
 * before that is exactly what will run. This reads inside a READ ONLY
 * transaction, so it cannot write even by mistake — including the
 * bookkeeping table, which a normal run creates if it is missing. The same
 * checks a real run makes still apply: a changed or unknown migration fails.
 */
async function status(client: pg.Client, all: readonly Migration[]): Promise<void> {
  await client.query("BEGIN READ ONLY");
  try {
    const table = await client.query<{ exists: boolean }>(
      `SELECT to_regclass('schema_migration') IS NOT NULL AS exists`,
    );
    const applied = table.rows[0]?.exists === true ? await readApplied(client) : [];
    const pending = pendingMigrations(all, applied);
    process.stdout.write(`applied ${String(applied.length)} of ${String(all.length)}\n`);
    if (pending.length === 0) {
      process.stdout.write("nothing pending\n");
      return;
    }
    process.stdout.write(`pending ${String(pending.length)}:\n`);
    for (const migration of pending) process.stdout.write(`  ${migration.id}\n`);
  } finally {
    await client.query("ROLLBACK");
  }
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78); // EX_CONFIG
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const all = await loadMigrations(MIGRATIONS_DIR);
    if (process.argv.includes("--status")) {
      await status(client, all);
      return;
    }
    await ensureMigrationTable(client);
    const pending = pendingMigrations(all, await readApplied(client));

    if (pending.length === 0) {
      process.stdout.write(`up to date (${String(all.length)} applied)\n`);
      return;
    }

    for (const migration of pending) {
      process.stdout.write(`applying ${migration.id} … `);
      await applyMigration(client, migration);
      process.stdout.write("ok\n");
    }
    process.stdout.write(`${String(pending.length)} migration(s) applied\n`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
