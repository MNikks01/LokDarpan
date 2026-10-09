import { displayTitle, mayRepublish } from "@lokdarpan/domain";
import type {
  AdminUnitLevel,
  NamedPlace,
  PlaceMentionRepository,
  PlaceMentionsInReport,
} from "@lokdarpan/domain";

import type { Queryable } from "./published-fact.repository";

/**
 * Districts and talukas named on reviewed audit pages (ADR-077).
 *
 * A mention counts while its fact is verified or corrected, was not read from a
 * scan (ADR-072), and comes from a source whose terms permit republication
 * (ADR-073). Nothing here ranks: places come back in name order, and the counts
 * are for a reader's tooltip, never for choosing what is drawn.
 */

const SHOWN = `f.verification_status IN ('verified', 'corrected') AND f.page_reading_id IS NULL`;

interface NamedRow {
  readonly unit_id: string;
  readonly name_en: string;
  readonly level: AdminUnitLevel;
  readonly lon: number;
  readonly lat: number;
  readonly document_id: string;
  readonly source_id: string;
}

interface PageRow {
  readonly document_id: string;
  readonly title: string;
  readonly issuing_authority: string;
  readonly source_id: string;
  readonly source_url: string;
  readonly retrieved_at: string;
  readonly page_number: number;
  readonly raw_text: string;
}

export class PostgresPlaceMentionRepository implements PlaceMentionRepository {
  constructor(private readonly db: Queryable) {}

  /**
   * Walks `parent_id` down rather than reading `admin_unit_closure`, which no
   * loader writes (#192). A place without a boundary has no point to draw and
   * is left out here; its own page still lists its mentions.
   */
  async namedWithin(unitId: number): Promise<readonly NamedPlace[]> {
    const result = await this.db.query<NamedRow>(
      `WITH RECURSIVE inside AS (
         SELECT id FROM admin_unit WHERE id = $1
         UNION ALL
         SELECT a.id FROM admin_unit a JOIN inside i ON a.parent_id = i.id
       )
       SELECT u.id AS unit_id, u.name_en, u.level,
              ST_X(b.label_point) AS lon, ST_Y(b.label_point) AS lat,
              f.document_id, s.source_id
         FROM place_mention m
         JOIN inside i              ON i.id = m.admin_unit_id
         JOIN admin_unit u          ON u.id = m.admin_unit_id
         JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
         JOIN document_fact f       ON f.id = m.document_fact_id
         JOIN document d            ON d.id = f.document_id
         JOIN source_artifact s     ON s.sha256 = d.source_sha256
        WHERE ${SHOWN} AND b.label_point IS NOT NULL`,
      [unitId],
    );

    const places = new Map<string, { row: NamedRow; pages: number; reports: Set<string> }>();
    for (const row of result.rows) {
      if (!mayRepublish(row.source_id)) continue;
      const place = places.get(row.unit_id) ?? { row, pages: 0, reports: new Set<string>() };
      place.pages += 1;
      place.reports.add(row.document_id);
      places.set(row.unit_id, place);
    }
    return [...places.values()]
      .map(({ row, pages, reports }) => ({
        unitId: Number(row.unit_id),
        name: row.name_en,
        level: row.level,
        point: [row.lon, row.lat] as const,
        pages,
        reports: reports.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async mentionsOf(unitId: number): Promise<readonly PlaceMentionsInReport[]> {
    const result = await this.db.query<PageRow>(
      `SELECT d.id AS document_id, d.title, d.issuing_authority, s.source_id, s.source_url,
              to_json(s.retrieved_at) #>> '{}' AS retrieved_at, f.page_number, f.raw_text
         FROM place_mention m
         JOIN document_fact f   ON f.id = m.document_fact_id
         JOIN document d        ON d.id = f.document_id
         JOIN source_artifact s ON s.sha256 = d.source_sha256
        WHERE m.admin_unit_id = $1 AND ${SHOWN}
        ORDER BY d.id, f.page_number, f.id`,
      [unitId],
    );

    const reports = new Map<
      string,
      PlaceMentionsInReport & { pages: PlaceMentionsInReport["pages"][number][] }
    >();
    for (const row of result.rows) {
      if (!mayRepublish(row.source_id)) continue;
      const report = reports.get(row.document_id) ?? {
        documentId: Number(row.document_id),
        title: displayTitle(row.title),
        issuingAuthority: row.issuing_authority,
        sourceId: row.source_id,
        sourceUrl: row.source_url,
        retrievedAt: row.retrieved_at,
        pages: [],
      };
      report.pages.push({ pageNumber: row.page_number, excerpt: row.raw_text });
      reports.set(row.document_id, report);
    }
    return [...reports.values()];
  }
}
