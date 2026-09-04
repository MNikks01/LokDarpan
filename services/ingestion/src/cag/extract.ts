import { extractText, getDocumentProxy } from "unpdf";

export type PageScript = "latin" | "devanagari" | "mixed" | "none";

export interface ExtractedPage {
  /** 1-based, matching how a citation is written. */
  readonly pageNumber: number;
  /** `null` where no text was extracted — the page may be an image needing OCR. */
  readonly content: string | null;
  readonly script: PageScript;
  /**
   * How much of this page's text layer is not the text — see
   * `glyphSubstitution`. `null` where the question does not arise.
   */
  readonly glyphSubstitution: number | null;
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

/**
 * A Latin letter or ASCII symbol touching a Devanagari character.
 *
 * Devanagari does not mix with Latin inside a word. Where it appears to, the
 * PDF is mapping glyphs through a non-Unicode font and the extracted text is
 * mojibake: "मेसस! इंडो अलाइड <ोटन फूस" for "मेसर्स इंडो अलाइड प्रोटीन फूड्स".
 */
const SUBSTITUTED_GLYPH = /[ऀ-ॿ][A-Za-z<>{}[\]!@#$%^&*|~`]|[A-Za-z<>{}[\]!@#$%^&*|~`][ऀ-ॿ]/gu;

/** Devanagari characters below which the ratio is noise rather than a signal. */
const ENOUGH_DEVANAGARI = 20;

/**
 * How much of a page's text layer is not the text.
 *
 * `pagesWithoutText` counts pages with no text layer. This is the case it
 * cannot see: a text layer that is present and wrong. That distinction is not
 * academic — digits survive mojibake and unit words do not, so a garbled page
 * yields figures whose scale is silently lost, which is how ₹2.12 crore came to
 * be stored as ₹1.
 *
 * Returns `null` rather than 0 where there is too little Devanagari to judge:
 * an English page is not evidence of a clean font mapping, and saying so would
 * be claiming a measurement that was never made.
 */
export function glyphSubstitution(content: string): number | null {
  const devanagari = (content.match(/[ऀ-ॿ]/gu) ?? []).length;
  if (devanagari < ENOUGH_DEVANAGARI) return null;
  return (content.match(SUBSTITUTED_GLYPH) ?? []).length / devanagari;
}
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
      glyphSubstitution: content === "" ? null : glyphSubstitution(content),
    };
  });

  return {
    pageCount: pdf.numPages,
    pagesWithoutText: pages.filter((p) => p.content === null).length,
    pages,
    extractionMethod: "unpdf/pdfjs text layer",
  };
}
