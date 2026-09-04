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
  readonly artifact: RawArtifact;
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
      `INSERT INTO document_page (document_id, page_number, content, script, glyph_substitution)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (document_id, page_number) DO UPDATE SET
         content            = EXCLUDED.content,
         script             = EXCLUDED.script,
         glyph_substitution = EXCLUDED.glyph_substitution`,
      [documentId, page.pageNumber, page.content, page.script, page.glyphSubstitution],
    );
  }

  return {
    documentId,
    pages: extracted.pages.length,
    pagesWithoutText: extracted.pagesWithoutText,
  };
}
