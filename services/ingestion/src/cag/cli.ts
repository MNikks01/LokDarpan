import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { openDatasetVersion, recordArtifact, sealDatasetVersion } from "../lgd/load";
import { putArtifact } from "../raw-store";
import { CagClient } from "./client";
import { extractDocument } from "./extract";
import { loadDocument } from "./load";

const RAW_ROOT =
  process.env["RAW_STORE_ROOT"] ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/raw");

/** These are multi-megabyte documents from one government host. */
const POLITE_DELAY_MS = 5_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }

  const limit = Number(process.argv[2] ?? "3");
  const client = new CagClient();
  const reports = await client.listStateReports();
  process.stdout.write(`discovered ${String(reports.length)} Maharashtra reports\n`);

  const db = new pg.Client({ connectionString });
  await db.connect();

  try {
    const state = await db.query<{ id: string }>(
      `SELECT id FROM admin_unit WHERE level = 'state' AND lgd_code = '27'`,
    );
    const adminUnitId = state.rows[0] === undefined ? null : Number(state.rows[0].id);

    for (const report of reports.slice(0, limit)) {
      const fetched = await client.fetchReport(report.url);

      // Original bytes stored before anything is parsed. Re-extraction with a
      // better parser must stay possible from what was actually retrieved.
      const artifact = await putArtifact(RAW_ROOT, fetched.body, {
        sourceId: "cag",
        sourceUrl: fetched.url,
        retrievedAt: new Date(),
        httpStatus: fetched.status,
        contentType: fetched.contentType,
      });

      const extracted = await extractDocument(fetched.body);
      await recordArtifact(db, artifact);
      const datasetVersionId = await openDatasetVersion(
        db,
        `CAG ${report.title} · ${artifact.sha256}`,
      );
      const result = await loadDocument(db, {
        artifact,
        extracted,
        meta: {
          docType: "audit_report",
          title: report.title,
          issuingAuthority: "Comptroller and Auditor General of India",
          // The listing does not state a publication date, and the retrieval
          // date is not one.
          publishedOn: null,
          adminUnitId,
        },
        datasetVersionId,
      });
      await sealDatasetVersion(db, datasetVersionId);

      process.stdout.write(
        `${report.title.slice(0, 52).padEnd(52)} ` +
          `pages=${String(result.pages)} no-text=${String(result.pagesWithoutText)}\n`,
      );
      await sleep(POLITE_DELAY_MS);
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
