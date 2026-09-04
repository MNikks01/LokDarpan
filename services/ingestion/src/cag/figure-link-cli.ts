import pg from "pg";

import { halfOfPage, pairFigures, type Half, type LinkableFact } from "./figure-link";

/**
 * Marks each Devanagari-half fact as a second citation of its English twin.
 *
 * Rerunnable: the links are recomputed from scratch every time, so a parser
 * change that adds or retires facts cannot leave a stale pairing behind. It
 * writes only `same_figure_as` and never touches a review decision — a pairing
 * is a statement about which rows an aggregate counts, not about whether the
 * claim is true.
 */
async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }

  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    const pages = await db.query<{ document_id: string; page_number: number; content: string }>(
      `SELECT document_id, page_number, content FROM document_page WHERE content IS NOT NULL`,
    );
    const halves = new Map<string, Half>();
    for (const p of pages.rows) {
      halves.set(`${p.document_id}:${String(p.page_number)}`, halfOfPage(p.content));
    }

    // Rejected facts are excluded: a criterion or a misreading is not a figure
    // anyone reported, so pairing it would assert a correspondence between two
    // things neither of which counts.
    const facts = await db.query<{
      id: string;
      document_id: string;
      page_number: number;
      normalised_value: string | null;
    }>(
      `SELECT id, document_id, page_number, normalised_value FROM document_fact
        WHERE kind = 'monetary_amount' AND verification_status <> 'rejected'
        ORDER BY id`,
    );
    const linkable: LinkableFact[] = facts.rows.map((r) => ({
      id: Number(r.id),
      documentId: Number(r.document_id),
      pageNumber: r.page_number,
      normalisedValue: r.normalised_value,
    }));

    const outcome = pairFigures(linkable, (documentId, pageNumber) =>
      halves.get(`${String(documentId)}:${String(pageNumber)}`),
    );

    await db.query(
      `UPDATE document_fact SET same_figure_as = NULL WHERE same_figure_as IS NOT NULL`,
    );
    for (const pair of outcome.pairs) {
      await db.query(`UPDATE document_fact SET same_figure_as = $2 WHERE id = $1`, [
        pair.citationId,
        pair.countedId,
      ]);
    }

    process.stdout.write(
      `\n${String(outcome.pairs.length)} figures cited twice, now counted once.\n` +
        `${String(outcome.unpaired)} stated in only one half.\n` +
        `${String(outcome.ambiguous)} stated more than once in a half and left unlinked —\n` +
        "  a wrong pairing merges two government figures into one, which is worse\n" +
        "  than the double count it would fix. These are still counted twice.\n\n",
    );
  } finally {
    await db.end();
  }
}

await main();
