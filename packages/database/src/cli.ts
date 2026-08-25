import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

import {
  applyMigration,
  ensureMigrationTable,
  loadMigrations,
  pendingMigrations,
  readApplied,
} from "./migrator.js";

const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../database/migrations",
);

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78); // EX_CONFIG
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await ensureMigrationTable(client);
    const all = await loadMigrations(MIGRATIONS_DIR);
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
