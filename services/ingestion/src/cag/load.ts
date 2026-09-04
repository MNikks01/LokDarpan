import type { SqlClient } from "@lokdarpan/database";

import type { RawArtifact } from "../raw-store";
import type { ExtractedDocument } from "./extract";

export interface DocumentMeta {
  readonly docType: "audit_report" | "government_resolution" | "other";
  readonly title: string;
  readonly issuingAuthority: string | null;
  /** As stated by the document. `null` when it states none. */
  readonly publishedOn: string | null;
  readonly adminUnitId: number | null;
}

export interface DocumentLoadResult {
  readonly documentId: number;
  readonly pages: number;
  readonly pagesWithoutText: number;
}

export interface DocumentLoadContext {
  /**
   * Only the parts of the artefact a document is keyed and typed by. Narrowed
   * from `RawArtifact` so a re-read from the content-addressed store — which
   * knows the hash but is not performing a retrieval — can load without
   * inventing an HTTP status or a retrieval time it did not observe.
   */
  readonly artifact: Pick<RawArtifact, "sha256"> & Partial<Pick<RawArtifact, "contentType">>;
  readonly extracted: ExtractedDocument;
  readonly meta: DocumentMeta;
  readonly datasetVersionId: number;
}

export async function loadDocument(
  client: SqlClient,
  context: DocumentLoadContext,
): Promise<DocumentLoadResult> {
  const { artifact, extracted, meta, datasetVersionId } = context;
  // One document per artefact: the artefact *is* the document's identity, so
  // re-ingesting the same bytes updates rather than duplicates.
  const doc = await client.query(
    `INSERT INTO document (source_sha256, dataset_version_id, doc_type, title,
                           issuing_authority, published_on, admin_unit_id,
                           mime_type, page_count, pages_without_text, extraction_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (source_sha256) DO UPDATE SET
       title              = EXCLUDED.title,
       page_count         = EXCLUDED.page_count,
       pages_without_text = EXCLUDED.pages_without_text,
       extraction_method  = EXCLUDED.extraction_method,
       dataset_version_id = EXCLUDED.dataset_version_id
     RETURNING id`,
    [
      artifact.sha256,
      datasetVersionId,
      meta.docType,
      meta.title,
      meta.issuingAuthority,
      meta.publishedOn,
      meta.adminUnitId,
      artifact.contentType ?? "application/pdf",
      extracted.pageCount,
      extracted.pagesWithoutText,
      extracted.extractionMethod,
    ],
  );
  const documentId = Number((doc.rows[0] as { id: string }).id);

  for (const page of extracted.pages) {
    await client.query(
      `INSERT INTO document_page (document_id, page_number, content, script, glyph_substitution,
                                  width, height, rotation, substituted_currency_marks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (document_id, page_number) DO UPDATE SET
         content            = EXCLUDED.content,
         script             = EXCLUDED.script,
         glyph_substitution = EXCLUDED.glyph_substitution,
         width              = EXCLUDED.width,
         height             = EXCLUDED.height,
         rotation           = EXCLUDED.rotation,
         substituted_currency_marks = EXCLUDED.substituted_currency_marks`,
      [
        documentId,
        page.pageNumber,
        page.content,
        page.script,
        page.glyphSubstitution,
        page.width,
        page.height,
        page.rotation,
        page.substitutedCurrencyMarks,
      ],
    );

    // Replaced wholesale rather than merged. The items are a reading of the
    // page, not a record anyone edits, and a partial overwrite would leave a
    // page described half by one extraction and half by another.
    await client.query(
      `DELETE FROM document_text_item WHERE document_id = $1 AND page_number = $2`,
      [documentId, page.pageNumber],
    );
    if (page.items.length > 0) {
      const values: unknown[] = [];
      const rows = page.items.map((item, n) => {
        values.push(
          documentId,
          page.pageNumber,
          item.seq,
          item.charStart,
          item.charEnd,
          item.x0,
          item.y0,
          item.x1,
          item.y1,
        );
        const base = n * 9;
        return `($${String(base + 1)},$${String(base + 2)},$${String(base + 3)},$${String(base + 4)},$${String(base + 5)},$${String(base + 6)},$${String(base + 7)},$${String(base + 8)},$${String(base + 9)})`;
      });
      await client.query(
        `INSERT INTO document_text_item
           (document_id, page_number, seq, char_start, char_end, x0, y0, x1, y1)
         VALUES ${rows.join(",")}`,
        values,
      );
    }
  }

  return {
    documentId,
    pages: extracted.pages.length,
    pagesWithoutText: extracted.pagesWithoutText,
  };
}
