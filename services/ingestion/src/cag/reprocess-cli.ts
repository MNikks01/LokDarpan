import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { openDatasetVersion, sealDatasetVersion } from "../lgd/load";
import { extractDocument } from "./extract";
import { loadDocument } from "./load";

/**
 * Re-reads documents already held, from the raw store rather than the network.
 *
 * `ingest:cag --refetch` re-downloads. That is right when a publisher has
 * revised a report in place and its bytes have changed, and wrong for every
 * other reason — re-extracting with a better parser, or backfilling something
 * the extractor did not used to record. Those need the bytes we already have,
 * and pulling multi-megabyte PDFs off a government host to obtain a file we
 * already store is the traffic `.docs/17-legal` §Data-sourcing ethics asks us
 * not to generate.
 *
 * The raw store is content-addressed, so the bytes re-read here are provably
 * the bytes that were retrieved: the path *is* their SHA-256.
 */
const RAW_ROOT =
  process.env["RAW_STORE_ROOT"] ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/raw");

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const docs = await db.query<{
      id: string;
      title: string;
      doc_type: "audit_report" | "government_resolution" | "other";
      issuing_authority: string;
      published_on: string | null;
      admin_unit_id: string | null;
      source_sha256: string;
      storage_path: string;
    }>(
      `SELECT d.id, d.title, d.doc_type, d.issuing_authority, d.published_on,
              d.admin_unit_id, d.source_sha256, s.storage_path
         FROM document d JOIN source_artifact s ON s.sha256 = d.source_sha256
        ORDER BY d.id`,
    );

    for (const doc of docs.rows) {
      const bytes = await readFile(resolve(RAW_ROOT, doc.storage_path));
      const extracted = await extractDocument(bytes);
      const datasetVersionId = await openDatasetVersion(
        db,
        `CAG re-read ${doc.title} · ${doc.source_sha256}`,
      );
      const result = await loadDocument(db, {
        artifact: { sha256: doc.source_sha256 },
        extracted,
        meta: {
          docType: doc.doc_type,
          title: doc.title,
          issuingAuthority: doc.issuing_authority,
          publishedOn: doc.published_on,
          adminUnitId: doc.admin_unit_id === null ? null : Number(doc.admin_unit_id),
        },
        datasetVersionId,
      });
      await sealDatasetVersion(db, datasetVersionId);

      const items = extracted.pages.reduce((n, p) => n + p.items.length, 0);
      process.stdout.write(
        `${doc.title.slice(0, 46).padEnd(46)} pages=${String(result.pages)} ` +
          `text-items=${String(items)}\n`,
      );
    }
    process.stdout.write(`\n${String(docs.rows.length)} documents re-read from the raw store.\n`);
  } finally {
    await db.end();
  }
}

await main();
