import { extractText, getDocumentProxy } from "unpdf";

export type PageScript = "latin" | "devanagari" | "mixed" | "none";

export interface ExtractedPage {
  /** 1-based, matching how a citation is written. */
  readonly pageNumber: number;
  /** `null` where no text was extracted — the page may be an image needing OCR. */
  readonly content: string | null;
  readonly script: PageScript;
}

export interface ExtractedDocument {
  readonly pageCount: number;
  readonly pagesWithoutText: number;
  readonly pages: readonly ExtractedPage[];
  readonly extractionMethod: string;
}

/**
 * Characters PostgreSQL `TEXT` cannot hold. PDF text layers emit NUL and other
 * C0 controls, and a single one aborts the whole insert.
 *
 * This modifies the *extraction*, never the document. The original bytes are in
 * the content-addressed raw store, unchanged, so a better parser can always be
 * run against exactly what was retrieved.
 */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const UNSTORABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu;

const DEVANAGARI = /[ऀ-ॿ]/u;
const LATIN_LETTER = /\p{Script=Latin}/u;

/**
 * CAG reports are bilingual, and the Marathi half comes first.
 *
 * Recording the script per page is not cosmetic. A search for English terms
 * over the opening third of one of these reports finds nothing and reads
 * exactly like an empty document — which is what happened on the first attempt
 * to assess this source. Knowing which pages are which prevents a reader, or a
 * later extraction pass, from drawing that conclusion.
 */
export function scriptOf(text: string): PageScript {
  const trimmed = text.trim();
  if (trimmed === "") return "none";
  const hasDevanagari = DEVANAGARI.test(trimmed);
  const hasLatin = LATIN_LETTER.test(trimmed);
  if (hasDevanagari && hasLatin) return "mixed";
  if (hasDevanagari) return "devanagari";
  if (hasLatin) return "latin";
  return "none";
}

/**
 * Extracts text page by page.
 *
 * Per page, not merged: a fact is cited by page number, and a merged blob
 * cannot say which page a sentence came from. That citation is the difference
 * between evidence and an assertion.
 */
export async function extractDocument(bytes: Buffer): Promise<ExtractedDocument> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });

  const pages: ExtractedPage[] = text.map((raw, i) => {
    const content = raw.replace(UNSTORABLE, "").trim();
    return {
      pageNumber: i + 1,
      // Empty string would claim the page is blank; null says we could not read it.
      content: content === "" ? null : content,
      script: scriptOf(content),
    };
  });

  return {
    pageCount: pdf.numPages,
    pagesWithoutText: pages.filter((p) => p.content === null).length,
    pages,
    extractionMethod: "unpdf/pdfjs text layer",
  };
}
