import pg from "pg";

import type { TextItem } from "./extract";
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
      // The items are what turn a character offset into a region. They are read
      // back rather than recomputed: re-opening the PDF here would work, and
      // would also mean the geometry a fact cites came from a different read of
      // the file than the text it was found in.
      const geometry = await db.query<{
        page_number: number;
        seq: number;
        char_start: number;
        char_end: number;
        x0: string;
        y0: string;
        x1: string;
        y1: string;
      }>(
        `SELECT page_number, seq, char_start, char_end, x0, y0, x1, y1
           FROM document_text_item WHERE document_id = $1 ORDER BY page_number, seq`,
        [documentId],
      );
      const itemsByPage = new Map<number, TextItem[]>();
      for (const i of geometry.rows) {
        const list = itemsByPage.get(i.page_number) ?? [];
        list.push({
          seq: i.seq,
          charStart: i.char_start,
          charEnd: i.char_end,
          x0: Number(i.x0),
          y0: Number(i.y0),
          x1: Number(i.x1),
          y1: Number(i.y1),
        });
        itemsByPage.set(i.page_number, list);
      }

      const candidates = extractFacts(
        pages.rows.map((p) => {
          const items = itemsByPage.get(p.page_number);
          return {
            pageNumber: p.page_number,
            content: p.content,
            ...(items === undefined ? {} : { items }),
          };
        }),
      );
      const result = await loadFactCandidates(db, documentId, candidates);

      process.stdout.write(
        `${doc.title.slice(0, 44).padEnd(44)} candidates=${String(candidates.length)} ` +
          `new=${String(result.inserted)} kept-reviewed=${String(result.skippedAlreadyReviewed)} ` +
          `retired=${String(result.retired)} stranded=${String(result.strandedDecisions)} ` +
          `located=${String(result.located)}\n`,
      );
      if (result.strandedDecisions > 0) {
        // Not an error, and deliberately not fixed here: a decision belongs to
        // the person who made it, and only a person may revise one.
        process.stdout.write(
          `  ${String(result.strandedDecisions)} decided facts are no longer produced by ` +
            `this parser version. Review them with --revise.\n`,
        );
      }
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
