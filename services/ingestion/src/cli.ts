import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { LgdClient } from "./lgd/client.js";
import { loadStates, openDatasetVersion, recordArtifact, sealDatasetVersion } from "./lgd/load.js";
import { parseStates } from "./lgd/parse.js";
import { putArtifact } from "./raw-store.js";

/**
 * Resolved from this module, not from `process.cwd()`: `pnpm --filter` runs a
 * script with the package directory as cwd, which would scatter the raw store
 * across `services/ingestion/data/raw` instead of the one store at the root.
 */
const RAW_ROOT =
  process.env["RAW_STORE_ROOT"] ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/raw");

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78); // EX_CONFIG
  }

  const client = new LgdClient();
  await client.openSession();
  const page = await client.fetchStates();

  // Raw bytes are stored before anything is parsed: if extraction is wrong, the
  // fix must be re-derivable from what was actually retrieved.
  const artifact = await putArtifact(RAW_ROOT, page.body, {
    sourceId: "lgd",
    sourceUrl: page.url,
    retrievedAt: new Date(),
    httpStatus: page.status,
    contentType: page.contentType,
  });
  process.stdout.write(
    `raw  ${artifact.sha256.slice(0, 12)}… ${String(artifact.byteSize)} bytes\n`,
  );

  const states = parseStates(page.body.toString("utf8"));
  process.stdout.write(`parsed ${String(states.length)} States/UTs\n`);

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    await recordArtifact(db, artifact);
    const datasetVersionId = await openDatasetVersion(db, `LGD States/UTs · ${artifact.sha256}`);
    const result = await loadStates(db, states, {
      artifact,
      datasetVersionId,
      validFrom: new Date().toISOString().slice(0, 10),
    });
    await sealDatasetVersion(db, datasetVersionId);
    process.stdout.write(
      `loaded inserted=${String(result.inserted)} updated=${String(result.updated)} ` +
        `unchanged=${String(result.unchanged)} (dataset_version ${String(datasetVersionId)})\n`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
