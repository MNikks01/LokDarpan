/**
 * Facts a person has verified, and the document they were verified from.
 *
 * Nothing here comes from a parser directly. Every value has passed a human
 * review recorded in `document_fact`, and the `published_fact` view is the only
 * way to read one - an unreviewed candidate cannot be selected at all.
 *
 * That makes the provenance of a published fact two-part, and both parts are
 * required: where the government published it, and who decided it had been
 * read correctly. A citation without the second is an extraction claiming to be
 * a fact; the second without the first is an assertion.
 */

export type PublishedFactKind =
  "monetary_amount" | "contractor_reference" | "officer_role_reference" | "work_reference";

/** How the published value came to differ, or not, from what the parser read. */
export type FactOrigin = "as_extracted" | "corrected_by_reviewer";

export interface PublishedFact {
  readonly id: number;
  readonly kind: PublishedFactKind;
  /** The citation. A fact without a page is not evidence. */
  readonly pageNumber: number;
  /** The published sentence, so a reader judges the claim in its own context. */
  readonly evidence: string;
  /**
   * Money arrives as a decimal string of rupees, never a JSON number: a
   * national multi-year aggregate exceeds Number.MAX_SAFE_INTEGER and would
   * fail silently, producing a wrong government figure under a correct source
   * link. Non-monetary kinds carry the name as published.
   */
  readonly value: string;
  readonly origin: FactOrigin;
  /**
   * Who accepted it. Displayed, not hidden: a reader entitled to the claim is
   * entitled to know a person stands behind it.
   */
  readonly verifiedBy: string;
  readonly verifiedAt: string;
}

export interface DocumentProvenance {
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly issuingAuthority: string;
  readonly publishedOn: string | null;
}

export interface DocumentFactsView {
  readonly documentId: number;
  readonly title: string;
  readonly pageCount: number;
  /**
   * Pages whose text could not be read. Stated rather than hidden, because a
   * reader comparing this page to the PDF must be able to tell "not in the
   * report" from "in a part of the report the extractor could not read".
   */
  readonly pagesWithoutText: number;
  readonly facts: readonly PublishedFact[];
  /**
   * How many extracted candidates from this document are still awaiting a
   * decision. Absence of a fact here means nobody has confirmed it yet - never
   * that the document does not contain it.
   */
  readonly awaitingReview: number;
  readonly provenance: DocumentProvenance;
  readonly datasetVersion: number;
}

/**
 * A document title fit to print.
 *
 * Titles are derived from the published filename, which on cag.gov.in carries
 * upload artefacts: a language note and a content hash, as in
 * "Nagpur Report No. 2 of 2026 Marathi & English hyperlinked 06a50a7f0926c61".
 * Those are facts about the file, not the name of the report, and printing
 * them makes a citation look machine-generated at exactly the moment a reader
 * is deciding whether to trust it.
 *
 * Only trailing artefacts are removed, and only ones that match a known shape.
 * Nothing is invented, and a title that does not match is left exactly as it
 * was published rather than guessed at.
 */
export function displayTitle(rawTitle: string): string {
  const cleaned = rawTitle
    // Must contain a hex letter and be at least eight characters. Every digit
    // is also a hex digit, so a laxer pattern eats a trailing year range -
    // "Audit Report 202425" would lose the years it is about.
    .replace(/\s+(?=[0-9a-f]*[a-f])[0-9a-f]{8,}(?:\.\d+)?\s*$/iu, "")
    .replace(/\s+hyperlinked\s*$/iu, "")
    .replace(/\s+(?:Marathi|English|Hindi)(?:\s*&\s*(?:Marathi|English|Hindi))*\s*$/iu, "")
    .replace(/[\s_-]+$/u, "")
    .trim();
  // Never return an empty title: a document with no name is unciteable, and the
  // published string is more useful than nothing at all.
  return cleaned === "" ? rawTitle.trim() : cleaned;
}

export interface PublishedFactRepository {
  documentFacts(documentId: number): Promise<DocumentFactsView | null>;
  listDocuments(): Promise<readonly DocumentSummary[]>;
}

export interface DocumentSummary {
  readonly documentId: number;
  readonly title: string;
  readonly issuingAuthority: string;
  readonly publishedFacts: number;
  readonly awaitingReview: number;
}

/**
 * Groups facts by the page they were read from.
 *
 * A reader checking a claim opens the PDF at one page and reads what is there.
 * Presenting the facts in that same unit is what makes checking practical
 * rather than nominal, and it keeps two facts drawn from one sentence together
 * where their relationship is visible.
 */
export function byPage(
  facts: readonly PublishedFact[],
): readonly { readonly pageNumber: number; readonly facts: readonly PublishedFact[] }[] {
  const pages = new Map<number, PublishedFact[]>();
  for (const fact of facts) {
    const existing = pages.get(fact.pageNumber);
    if (existing === undefined) pages.set(fact.pageNumber, [fact]);
    else existing.push(fact);
  }
  return [...pages.entries()]
    .map(([pageNumber, grouped]) => ({ pageNumber, facts: grouped }))
    .sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Whether a document's published facts can be read as any kind of summary.
 *
 * They cannot, unless every candidate has been decided. CAG audits a sample of
 * works, and review is partial on top of that - so a page showing four facts
 * out of 600 undecided candidates must not read as "this is what the report
 * says". This returns the fact needed to say so plainly.
 */
export function isReviewComplete(view: DocumentFactsView): boolean {
  return view.awaitingReview === 0;
}
