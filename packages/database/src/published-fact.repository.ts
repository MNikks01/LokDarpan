import { displayTitle, mayRepublish } from "@lokdarpan/domain";
import { Money } from "@lokdarpan/money";
import type {
  DocumentFactsView,
  DocumentSummary,
  FactOrigin,
  PublishedFact,
  PublishedFactKind,
  PublishedFactRepository,
} from "@lokdarpan/domain";
/**
 * Anything that can run a query - a pool in production, a transaction-scoped
 * client in a test.
 *
 * Typed this narrowly so tests can hand in a client inside a transaction and
 * roll back. A repository that insisted on a pool would force its fixtures to
 * commit, and committed fixtures in a shared database have already broken
 * unrelated suites in this repository once.
 */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- R is the
   caller's row shape, matching pg's own `query<R>` signature; it appears once
   because the rows are the only thing this interface returns. */
export interface Queryable {
  query<R>(sql: string, values?: readonly unknown[]): Promise<{ rows: R[] }>;
}

/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

interface FactRow {
  readonly id: string;
  readonly kind: PublishedFactKind;
  readonly page_number: number;
  readonly raw_text: string;
  readonly value: string | null;
  readonly verification_status: string;
  readonly verified_by: string;
  readonly verified_at: string;
}

interface DocumentRow {
  readonly id: string;
  readonly title: string;
  readonly page_count: number;
  readonly pages_without_text: number;
  readonly issuing_authority: string;
  readonly published_on: string | null;
  readonly source_id: string;
  readonly source_url: string;
  readonly retrieved_at: string;
  readonly awaiting_review: string;
  readonly dataset_version_id: string;
}

/**
 * Reads published facts, and only through the `published_fact` view.
 *
 * Never `document_fact`. The view cannot return an unreviewed row, so the
 * guarantee that no unverified claim reaches a reader is a property of the
 * query surface rather than a WHERE clause this file has to remember. A future
 * change here that selected the table directly would be a visible mistake, not
 * a silent one.
 */
export class PostgresPublishedFactRepository implements PublishedFactRepository {
  constructor(private readonly db: Queryable) {}

  async documentFacts(documentId: number): Promise<DocumentFactsView | null> {
    const documents = await this.db.query<DocumentRow>(
      `SELECT d.id, d.title, d.page_count, d.pages_without_text, d.issuing_authority,
              d.published_on, d.dataset_version_id,
              s.source_id, s.source_url, s.retrieved_at,
              (SELECT count(*) FROM document_fact f
                WHERE f.document_id = d.id AND f.verification_status = 'unverified'
              ) AS awaiting_review
         FROM document d
         JOIN source_artifact s ON s.sha256 = d.source_sha256
        WHERE d.id = $1`,
      [documentId],
    );
    const document = documents.rows[0];
    if (document === undefined) return null;

    // A source whose publisher has not permitted republication is withheld
    // whole, not shown with its figures blanked: a page of empty rows would
    // still assert that this document is one we hold and have read.
    // `.docs/06-government-sources/source-licences.md` records the terms.
    if (!mayRepublish(document.source_id)) return null;

    const facts = await this.db.query<FactRow>(
      `SELECT id, kind, page_number, raw_text, value, verification_status,
              verified_by, verified_at
         FROM published_fact
        WHERE document_id = $1
        ORDER BY page_number, id`,
      [documentId],
    );

    return {
      documentId: Number(document.id),
      title: displayTitle(document.title),
      pageCount: document.page_count,
      pagesWithoutText: document.pages_without_text,
      awaitingReview: Number(document.awaiting_review),
      facts: facts.rows.map(toFact).filter((f): f is PublishedFact => f !== null),
      provenance: {
        sourceId: document.source_id,
        sourceUrl: document.source_url,
        retrievedAt: new Date(document.retrieved_at).toISOString(),
        issuingAuthority: document.issuing_authority,
        publishedOn: document.published_on,
      },
      datasetVersion: Number(document.dataset_version_id),
    };
  }

  async listDocuments(): Promise<readonly DocumentSummary[]> {
    return this.queryDocuments(null);
  }

  async listDocumentsForUnit(lgdCode: string): Promise<readonly DocumentSummary[]> {
    return this.queryDocuments(lgdCode);
  }

  /**
   * One query for both listings, scoped by LGD code when one is given.
   *
   * The unit is joined through `document.admin_unit_id` — the link the
   * ingestion recorded — and never inferred from the title.
   */
  private async queryDocuments(lgdCode: string | null): Promise<readonly DocumentSummary[]> {
    const result = await this.db.query<{
      id: string;
      title: string;
      issuing_authority: string;
      published_facts: string;
      awaiting_review: string;
      unit_name: string | null;
      unit_level: string | null;
    }>(
      `SELECT d.id, d.title, d.issuing_authority,
              u.name_en AS unit_name, u.level::text AS unit_level,
              (SELECT count(*) FROM published_fact p WHERE p.document_id = d.id
              ) AS published_facts,
              (SELECT count(*) FROM document_fact f
                WHERE f.document_id = d.id AND f.verification_status = 'unverified'
              ) AS awaiting_review
         FROM document d
         LEFT JOIN admin_unit u ON u.id = d.admin_unit_id
        WHERE $1::text IS NULL OR u.lgd_code = $1
        ORDER BY d.title`,
      [lgdCode],
    );
    return result.rows.map((r) => ({
      documentId: Number(r.id),
      title: displayTitle(r.title),
      issuingAuthority: r.issuing_authority,
      publishedFacts: Number(r.published_facts),
      awaitingReview: Number(r.awaiting_review),
      adminUnitName: r.unit_name,
      adminUnitLevel: r.unit_level,
    }));
  }
}

/**
 * A published row with no value is dropped rather than rendered.
 *
 * `published_fact.value` coalesces the reviewer's correction over the parser's
 * reading, so it is null only when a reviewer verified a candidate the parser
 * could not normalise without supplying one. Showing the evidence sentence with
 * no value would put a claim on the page that states nothing; the fact stays in
 * the ledger and out of the reader's view until someone corrects it.
 */
function toFact(row: FactRow): PublishedFact | null {
  if (row.value === null) return null;
  const value = row.kind === "monetary_amount" ? toRupees(row.value) : row.value;
  // A monetary value that will not parse as paise is not shown. Rendering it
  // raw would put an unlabelled integer on the page where a reader expects
  // rupees, which is worse than showing nothing.
  if (value === null) return null;
  const origin: FactOrigin =
    row.verification_status === "corrected" ? "corrected_by_reviewer" : "as_extracted";
  return {
    id: Number(row.id),
    kind: row.kind,
    pageNumber: row.page_number,
    evidence: row.raw_text,
    value,
    origin,
    verifiedBy: row.verified_by,
    verifiedAt: new Date(row.verified_at).toISOString(),
  };
}

/**
 * Paise in the ledger become a decimal string of rupees on the wire.
 *
 * `document_fact.normalised_value` stores paise, because that is the only
 * representation that stays exact through arithmetic. The client contract is
 * decimal rupee strings. Converting anywhere but here means some caller
 * eventually reads paise as rupees and publishes a figure a hundred times too
 * large under a correct-looking source link - the exact failure the money rules
 * exist to prevent.
 *
 * A reviewer's correction is trusted to be paise like the parser's reading; a
 * value that is not an integer is refused rather than guessed at.
 */
function toRupees(paise: string): string | null {
  if (!/^-?\d+$/u.test(paise.trim())) return null;
  return Money.fromPaise(BigInt(paise.trim())).toDecimalString();
}
