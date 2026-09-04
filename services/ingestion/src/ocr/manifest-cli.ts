import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Writes the page list an OCR benchmark reads.
 *
 * The ledger knows which pages have no text layer and which have one that can
 * be trusted; the OCR service knows neither and must not learn. So the
 * selection happens here and crosses the boundary as a file.
 *
 * Two populations, for two different questions:
 *
 * **Ground truth.** Pages whose text layer is present and clean. The layer is
 * exact — it is what the file itself states — so rendering those pages and
 * asking an engine to read them measures accuracy against a known answer,
 * without anyone transcribing anything. Their weakness is stated in the report:
 * a digitally-born page is easier than a scan, so accuracy measured here is an
 * upper bound.
 *
 * **The unread.** The pages with no text layer at all. There is no ground truth
 * for these, so nothing here claims accuracy on them. What can be measured is
 * whether an engine reads them at all, whether two engines agree, and what the
 * extractor would do with the result.
 */

const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../data/benchmarks/ocr-manifest.json",
);

/** Above this, `035` judged the text layer to be mojibake rather than text. */
const MOJIBAKE = 0.1;

/** A page with almost no text measures nothing; a huge one is slow for no gain. */
const MIN_GROUND_TRUTH_CHARS = 400;
const MAX_GROUND_TRUTH_CHARS = 6000;

interface ManifestPage {
  readonly documentId: number;
  readonly sha256: string;
  readonly storagePath: string;
  readonly pageNumber: number;
  readonly script: string;
  readonly rotation: number | null;
  /** Present only for ground-truth pages: what the file itself states. */
  readonly expectedText?: string;
}

function arg(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL_READONLY"] ?? process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString === "") {
    process.stderr.write("DATABASE_URL is not set.\n");
    process.exit(78);
  }

  const groundTruthPerScript = arg("ground-truth-per-script", 40);
  const db = new pg.Client({ connectionString });
  await db.connect();

  try {
    // Sampled deterministically — ordered by a hash of the page's identity
    // rather than by random() — so a second run measures the same pages and a
    // change in the numbers is a change in the engines.
    const groundTruth = await db.query<ManifestPage & { expected_text: string }>(
      `SELECT * FROM (
         SELECT d.id AS "documentId", d.source_sha256 AS sha256, s.storage_path AS "storagePath",
                p.page_number AS "pageNumber", p.script, p.rotation, p.content AS expected_text,
                row_number() OVER (
                  PARTITION BY p.script
                  ORDER BY md5(d.id::text || ':' || p.page_number::text)
                ) AS rank
           FROM document_page p
           JOIN document d ON d.id = p.document_id
           JOIN source_artifact s ON s.sha256 = d.source_sha256
          WHERE p.content IS NOT NULL
            AND length(p.content) BETWEEN $2 AND $3
            AND (p.glyph_substitution IS NULL OR p.glyph_substitution <= $4)
            AND p.script IN ('latin', 'devanagari', 'mixed')
       ) ranked WHERE rank <= $1`,
      [groundTruthPerScript, MIN_GROUND_TRUTH_CHARS, MAX_GROUND_TRUTH_CHARS, MOJIBAKE],
    );

    const unread = await db.query<ManifestPage>(
      `SELECT d.id AS "documentId", d.source_sha256 AS sha256, s.storage_path AS "storagePath",
              p.page_number AS "pageNumber", p.script, p.rotation
         FROM document_page p
         JOIN document d ON d.id = p.document_id
         JOIN source_artifact s ON s.sha256 = d.source_sha256
        WHERE p.content IS NULL
        ORDER BY d.id, p.page_number`,
    );

    const manifest = {
      generatedAt: new Date().toISOString(),
      groundTruth: groundTruth.rows.map((r) => ({
        documentId: r.documentId,
        sha256: r.sha256,
        storagePath: r.storagePath,
        pageNumber: r.pageNumber,
        script: r.script,
        rotation: r.rotation,
        expectedText: r.expected_text,
      })),
      unread: unread.rows.map((r) => ({
        documentId: r.documentId,
        sha256: r.sha256,
        storagePath: r.storagePath,
        pageNumber: r.pageNumber,
        script: r.script,
        rotation: r.rotation,
      })),
    };

    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const byScript = new Map<string, number>();
    for (const page of manifest.groundTruth) {
      byScript.set(page.script, (byScript.get(page.script) ?? 0) + 1);
    }
    process.stdout.write(
      `ground truth: ${String(manifest.groundTruth.length)} pages (` +
        [...byScript].map(([s, n]) => `${s} ${String(n)}`).join(", ") +
        `)\nunread:       ${String(manifest.unread.length)} pages\nwritten to    ${OUT}\n`,
    );
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
