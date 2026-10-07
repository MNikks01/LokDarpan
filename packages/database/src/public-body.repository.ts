import { displayTitle, mayRepublish } from "@lokdarpan/domain";
import type {
  BodyMention,
  BodyMentionsInReport,
  PublicBodyKind,
  PublicBodyRef,
  PublicBodyRepository,
  PublicBodyView,
} from "@lokdarpan/domain";

import type { Queryable } from "./published-fact.repository";

/**
 * Governments and departments, shown only through reviewed mentions (ADR-074).
 *
 * A mention counts while its fact is verified or corrected, was not read from a
 * scan (ADR-072), and comes from a source whose terms permit republication. A
 * body with no such mention is not shown at all: not as an empty page, which
 * would still assert the body is one we hold a record of.
 */

interface BodyRow {
  readonly id: string;
  readonly kind: PublicBodyKind;
  readonly name_en: string;
  readonly parent_body_id: string | null;
  readonly unit_id: string;
  readonly unit_name: string;
  readonly dataset_version_id: string;
}

interface MentionRow {
  readonly body_id: string;
  readonly fact_id: string;
  readonly page_number: number;
  readonly raw_text: string;
  readonly document_id: string;
  readonly title: string;
  readonly issuing_authority: string;
  readonly published_on: string | null;
  readonly source_id: string;
  readonly source_url: string;
  readonly retrieved_at: string;
  readonly mention_version: string;
}

/** Shown mentions of the given bodies, in report and page order. */
const MENTIONS = `
  SELECT m.public_body_id AS body_id, f.id AS fact_id, f.page_number, f.raw_text,
         d.id AS document_id, d.title, d.issuing_authority, d.published_on::text AS published_on,
         s.source_id, s.source_url, s.retrieved_at::text AS retrieved_at,
         m.dataset_version_id AS mention_version
    FROM public_body_mention m
    JOIN document_fact f   ON f.id = m.document_fact_id
    JOIN document d        ON d.id = f.document_id
    JOIN source_artifact s ON s.sha256 = d.source_sha256
   WHERE m.public_body_id = ANY($1::bigint[])
     AND f.verification_status IN ('verified', 'corrected')
     AND f.page_reading_id IS NULL
   ORDER BY d.id, f.page_number, f.id`;

/** One report's shown mentions, in the order they were read. */
function groupByReport(mentions: readonly MentionRow[]): BodyMentionsInReport[] {
  const order: string[] = [];
  const byDocument = new Map<string, { first: MentionRow; mentions: BodyMention[] }>();
  for (const m of mentions) {
    let group = byDocument.get(m.document_id);
    if (group === undefined) {
      group = { first: m, mentions: [] };
      byDocument.set(m.document_id, group);
      order.push(m.document_id);
    }
    group.mentions.push({
      factId: Number(m.fact_id),
      pageNumber: m.page_number,
      rawText: m.raw_text,
    });
  }
  return order.map((id) => {
    const group = byDocument.get(id);
    if (group === undefined) throw new Error(`report ${id} lost while grouping`);
    const m = group.first;
    return {
      documentId: Number(m.document_id),
      title: displayTitle(m.title),
      issuingAuthority: m.issuing_authority,
      publishedOn: m.published_on,
      sourceId: m.source_id,
      sourceUrl: m.source_url,
      retrievedAt: m.retrieved_at,
      mentions: group.mentions,
    };
  });
}

export class PostgresPublicBodyRepository implements PublicBodyRepository {
  constructor(private readonly db: Queryable) {}

  private async shownMentions(bodyIds: readonly string[]): Promise<MentionRow[]> {
    if (bodyIds.length === 0) return [];
    const r = await this.db.query<MentionRow>(MENTIONS, [bodyIds]);
    return r.rows.filter((row) => mayRepublish(row.source_id));
  }

  /** Refs for bodies with at least one shown mention, counting distinct reports. */
  private async refs(rows: readonly BodyRow[]): Promise<PublicBodyRef[]> {
    const mentions = await this.shownMentions(rows.map((r) => r.id));
    const reports = new Map<string, Set<string>>();
    for (const m of mentions) {
      const set = reports.get(m.body_id) ?? new Set<string>();
      set.add(m.document_id);
      reports.set(m.body_id, set);
    }
    return rows
      .filter((r) => reports.has(r.id))
      .map((r) => ({
        id: Number(r.id),
        kind: r.kind,
        name: r.name_en,
        reportCount: reports.get(r.id)?.size ?? 0,
      }));
  }

  private async bodyRows(where: string, params: readonly unknown[]): Promise<BodyRow[]> {
    const r = await this.db.query<BodyRow>(
      `SELECT b.id, b.kind, b.name_en, b.parent_body_id, u.id AS unit_id, u.name_en AS unit_name,
              b.dataset_version_id
         FROM public_body b
         JOIN admin_unit u ON u.id = b.jurisdiction_admin_unit_id
        WHERE ${where}
        ORDER BY b.kind, b.name_en`,
      params,
    );
    return r.rows;
  }

  async body(id: number): Promise<PublicBodyView | null> {
    const [row] = await this.bodyRows("b.id = $1", [id]);
    if (row === undefined) return null;

    const mentions = await this.shownMentions([row.id]);
    if (mentions.length === 0) return null;

    const parentRows =
      row.parent_body_id === null ? [] : await this.bodyRows("b.id = $1", [row.parent_body_id]);
    const [parent] = await this.refs(parentRows);
    const departments =
      row.kind === "government"
        ? await this.refs(await this.bodyRows("b.parent_body_id = $1", [row.id]))
        : [];

    return {
      id: Number(row.id),
      kind: row.kind,
      name: row.name_en,
      jurisdiction: { unitId: Number(row.unit_id), name: row.unit_name },
      parent: parent ?? null,
      departments,
      reports: groupByReport(mentions),
      datasetVersion: Math.max(
        Number(row.dataset_version_id),
        ...mentions.map((m) => Number(m.mention_version)),
      ),
    };
  }

  async bodiesOf(unitId: number): Promise<readonly PublicBodyRef[]> {
    return this.refs(await this.bodyRows("b.jurisdiction_admin_unit_id = $1", [unitId]));
  }
}
