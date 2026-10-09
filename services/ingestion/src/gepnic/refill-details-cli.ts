import pg from "pg";

import { RawStoreMisconfigured, rawStoreFromEnv } from "../raw-store";
import { refillDetailFields } from "./refill-details";

/**
 * Fill every tender's detail fields from the pages already kept (0048, ADR-079).
 *
 *   DATABASE_URL=… RAW_STORE_S3_*=… pnpm --filter @lokdarpan/ingestion tenders:refill-details
 *
 * Reads the raw store, never a portal. Safe to repeat: a tender whose fields
 * are already filled is left alone.
 */
async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }
  let store;
  try {
    store = rawStoreFromEnv();
  } catch (error) {
    if (!(error instanceof RawStoreMisconfigured)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exit(78);
  }
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const r = await refillDetailFields(db, store);
    process.stdout.write(
      `tenders read: ${String(r.read)} · filled: ${String(r.filled)} · could not be read: ${String(r.failed)}\n`,
    );
  } finally {
    await db.end();
  }
}

void main();
