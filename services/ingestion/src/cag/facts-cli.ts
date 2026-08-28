import pg from "pg";

import { extractFacts } from "./facts";
import { loadFactCandidates } from "./facts-load";

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }

  const db = new pg.Client({ connectionString });
  await db.connect();

  try {
    const docs = await db.query<{ id: string; title: string }>(
      `SELECT id, title FROM document WHERE doc_type = 'audit_report' ORDER BY id`,
    );

    for (const doc of docs.rows) {
      const documentId = Number(doc.id);
      const pages = await db.query<{ page_number: number; content: string | null }>(
        `SELECT page_number, content FROM document_page WHERE document_id = $1 ORDER BY page_number`,
        [documentId],
      );
      const candidates = extractFacts(
        pages.rows.map((p) => ({
          pageNumber: p.page_number,
          content: p.content,
        })),
      );
      const result = await loadFactCandidates(db, documentId, candidates);

      process.stdout.write(
        `${doc.title.slice(0, 44).padEnd(44)} candidates=${String(candidates.length)} ` +
          `new=${String(result.inserted)} kept-reviewed=${String(result.skippedAlreadyReviewed)}\n`,
      );
    }

    // Said every run: candidates are not published facts, and nothing here has
    // been reviewed by a person yet.
    const pending = await db.query<{ count: string }>(
      `SELECT count(*) FROM document_fact WHERE verification_status = 'unverified'`,
    );
    process.stdout.write(
      `\n${pending.rows[0]?.count ?? "0"} candidates await human review. ` +
        `None is published until then.\n`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
