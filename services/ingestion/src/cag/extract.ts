import { getDocumentProxy } from "unpdf";

export type PageScript = "latin" | "devanagari" | "mixed" | "none";

/**
 * One text item as pdf.js reported it, with where it sits in the page's text
 * and where it sits on the page.
 *
 * `charStart`/`charEnd` index into the page `content` this extractor produces.
 * That is only meaningful because the content is rebuilt from these items
 * exactly — see `pageTextOf` — so a figure found by character offset can be
 * traced to a region without any stored evidence string changing.
 */
/** The shape pdf.js reports for a text item; other entries lack `str`. */
interface PdfTextItem {
  readonly str: string;
  readonly hasEOL?: boolean;
  readonly transform: number[];
  readonly width?: number;
  readonly height?: number;
}

export interface TextItem {
  readonly seq: number;
  readonly charStart: number;
  readonly charEnd: number;
  /** PDF coordinates: origin bottom-left, y upward, points, unscaled. */
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

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
  /** How many amounts lost their currency mark — see `substitutedCurrencyMarks`. */
  readonly substitutedCurrencyMarks: number;
  /**
   * The page box in points, **unrotated** — the same space `items` and a fact's
   * box are in. A rotated page has two boxes, and storing the upright one beside
   * unrotated coordinates put highlights off the edge of their own page.
   */
  readonly width: number;
  readonly height: number;
  /** The page's declared /Rotate, so a renderer can turn the page itself. */
  readonly rotation: number;
  /** Every text item, in the order pdf.js reported it. */
  readonly items: readonly TextItem[];
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
/**
 * A page's text, and where each item landed in it.
 *
 * The join is `str + (hasEOL ? "\n" : "")`, which is what `unpdf`'s
 * `extractText` produces — verified byte-identical on pages of prose, of
 * tables, and of mangled Devanagari. Rebuilding the text a different way would
 * change every stored evidence string and strand every review decision made
 * against it, so this is checked rather than assumed.
 */
export function pageTextOf(
  raw: readonly {
    str: string;
    hasEOL?: boolean;
    transform: number[];
    width?: number;
    height?: number;
  }[],
): { content: string; items: TextItem[] } {
  let content = "";
  const items: TextItem[] = [];

  for (const [seq, item] of raw.entries()) {
    const charStart = content.length;
    content += item.str;
    const charEnd = content.length;
    if (item.hasEOL === true) content += "\n";

    // transform is [a, b, c, d, e, f]; e and f are the item's origin.
    const x0 = item.transform[4] ?? 0;
    const y0 = item.transform[5] ?? 0;
    items.push({
      seq,
      charStart,
      charEnd,
      x0,
      y0,
      x1: x0 + (item.width ?? 0),
      y1: y0 + (item.height ?? 0),
    });
  }

  return { content, items };
}

/**
 * The smallest box covering every item overlapping a character range, or null
 * where the range touches no item.
 *
 * Half-open on both sides: an item counts when it shares at least one character
 * with the range, so a figure split across two items — which the text layer does
 * routinely — is covered by both.
 */
export function boxAround(
  items: readonly TextItem[],
  charStart: number,
  charEnd: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const touching = items.filter((i) => i.charStart < charEnd && i.charEnd > charStart);
  if (touching.length === 0) return null;
  return {
    x0: Math.min(...touching.map((i) => i.x0)),
    y0: Math.min(...touching.map((i) => i.y0)),
    x1: Math.max(...touching.map((i) => i.x1)),
    y1: Math.max(...touching.map((i) => i.y1)),
  };
}

/**
 * Applies the same cleanup the stored content gets, and moves the item offsets
 * with it.
 *
 * `content` is stripped of characters Postgres cannot hold and then trimmed, so
 * an offset into the raw join does not address the stored string. Remapping is
 * not optional bookkeeping: an offset that is two characters out points a
 * reader's highlight at the wrong figure, which is worse than showing none.
 */
export function cleanWithItems(
  raw: string,
  items: readonly TextItem[],
): { content: string; items: TextItem[] } {
  // Where each raw character ends up, or -1 where it is dropped.
  const moved = new Array<number>(raw.length).fill(-1);
  let kept = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] ?? "";
    UNSTORABLE.lastIndex = 0;
    if (UNSTORABLE.test(ch)) continue;
    moved[i] = kept.length;
    kept += ch;
  }

  const start = kept.length - kept.trimStart().length;
  const content = kept.trim();
  const at = (rawIndex: number): number => {
    const m = moved[rawIndex];
    return m === undefined || m < 0 ? -1 : m - start;
  };

  const adjusted: TextItem[] = [];
  for (const item of items) {
    // The first and last surviving characters of this item, in the stored text.
    let lo = -1;
    let hi = -1;
    for (let i = item.charStart; i < item.charEnd; i++) {
      const a = at(i);
      if (a < 0 || a >= content.length) continue;
      if (lo < 0) lo = a;
      hi = a + 1;
    }
    if (lo < 0) continue; // nothing of this item survived
    adjusted.push({ ...item, charStart: lo, charEnd: hi });
  }

  return { content, items: adjusted };
}

/**
 * A stray mark standing where the page prints a currency symbol.
 *
 * `` ` 40.80 कोटी `` and `` ` 25.96 crore `` are the shape. The mark is a
 * backtick or an acute accent immediately before a number, which is not
 * something an audit report writes: rendering the exact region these characters
 * occupy shows ₹ printed on the page in eleven of the twelve affected
 * documents.
 *
 * The pattern requires the number, not just the mark. A backtick quoting a word
 * is ordinary punctuation; a backtick immediately before a decimal amount is a
 * font mapping that lost a glyph.
 */
const SUBSTITUTED_CURRENCY = /[`´]\s?\d[\d,]*(?:\.\d+)?/gu;

/**
 * How many amounts on this page have lost their currency mark.
 *
 * Counted rather than judged: 0 is a measurement — the page was read and no
 * such mark was found — and it is deliberately different from the `null` a page
 * that was never measured carries.
 */
export function substitutedCurrencyMarks(content: string): number {
  return (content.match(SUBSTITUTED_CURRENCY) ?? []).length;
}

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

  const pages: ExtractedPage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    // `rotation: 0` asks for the box the file states rather than the one a
    // reader sees. Text-item transforms are in that unrotated space, so the two
    // have to be requested together or a landscape page disagrees by a quarter
    // turn.
    const [textContent, viewport] = [
      await page.getTextContent(),
      page.getViewport({ scale: 1, rotation: 0 }),
    ];
    // pdf.js mixes text items with marked-content boundaries in the same array;
    // only the former carry `str` and a transform.
    const raw = (textContent.items as PdfTextItem[]).filter(
      (i) => typeof i.str === "string" && Array.isArray(i.transform),
    );

    const joined = pageTextOf(raw);
    const { content, items } = cleanWithItems(joined.content, joined.items);

    pages.push({
      pageNumber: n,
      // Empty string would claim the page is blank; null says we could not read it.
      content: content === "" ? null : content,
      script: scriptOf(content),
      glyphSubstitution: content === "" ? null : glyphSubstitution(content),
      substitutedCurrencyMarks: substitutedCurrencyMarks(content),
      width: viewport.width,
      height: viewport.height,
      rotation: ((page.rotate % 360) + 360) % 360,
      items,
    });
  }

  return {
    pageCount: pdf.numPages,
    pagesWithoutText: pages.filter((p) => p.content === null).length,
    pages,
    extractionMethod: "unpdf/pdfjs text layer",
  };
}
