import type {
  AdminUnitLevel,
  BoundaryFeatureCollection,
  BoundaryProvenance,
  GeoUnit,
  GeographyRepository,
  SearchResult,
} from "@lokdarpan/domain";
import { LEVEL_LABEL } from "@lokdarpan/domain";
import { displayTitle } from "@lokdarpan/domain";
import type pg from "pg";

/**
 * Geography, read from PostGIS.
 *
 * Every spatial operation happens here in SQL, indexed by GIST. None of it is
 * done in the client: a containment test over a district's boundary is a few
 * milliseconds in the database and a frozen browser tab in JavaScript.
 *
 * Geometry is serialised with `ST_AsGeoJSON` and simplified on the way out.
 * The raw Maharashtra district set is tens of megabytes of coordinates; at the
 * zoom a reader sees a whole state, the extra precision is invisible and the
 * transfer is not.
 */

/**
 * Simplification tolerance in degrees, by how much of the world is in view.
 *
 * Chosen from the geometry rather than guessed: a district drawn across a
 * state-sized viewport is a few hundred pixels wide, where 0.005° is well under
 * one pixel. The finer tolerance is used when a single unit fills the screen.
 */
const TOLERANCE_OVERVIEW = 0.005;
const TOLERANCE_DETAIL = 0.0005;

interface UnitRow {
  readonly id: string;
  readonly name_en: string;
  readonly level: AdminUnitLevel;
  readonly lgd_code: string | null;
  readonly osm_relation_id: string | null;
  readonly parent_id: string | null;
  readonly source_kind: BoundaryProvenance["kind"] | null;
  readonly source_name: string | null;
  readonly source_licence: string | null;
  readonly source_url: string | null;
  readonly source_ref: string | null;
  readonly authority: string | null;
  readonly retrieved_at: Date | null;
  readonly west: number | null;
  readonly south: number | null;
  readonly east: number | null;
  readonly north: number | null;
}

const UNIT_COLUMNS = `
  u.id, u.name_en, u.level::text AS level, u.lgd_code, u.osm_relation_id, u.parent_id,
  b.source_kind::text AS source_kind, b.source_name, b.source_licence,
  b.source_url, b.source_ref, b.authority, b.retrieved_at,
  ST_XMin(b.geometry) AS west, ST_YMin(b.geometry) AS south,
  ST_XMax(b.geometry) AS east, ST_YMax(b.geometry) AS north`;

function toUnit(row: UnitRow): GeoUnit {
  const kind = row.source_kind;
  const sourceName = row.source_name;
  const sourceLicence = row.source_licence;
  const hasBoundary = kind !== null && sourceName !== null && sourceLicence !== null;
  return {
    id: Number(row.id),
    name: row.name_en,
    level: row.level,
    lgdCode: row.lgd_code,
    osmRelationId: row.osm_relation_id === null ? null : Number(row.osm_relation_id),
    parentId: row.parent_id === null ? null : Number(row.parent_id),
    boundary: hasBoundary
      ? {
          kind,
          sourceName,
          sourceLicence,
          sourceUrl: row.source_url,
          sourceRef: row.source_ref,
          authority: row.authority,
          retrievedAt: (row.retrieved_at ?? new Date(0)).toISOString(),
        }
      : null,
    bbox:
      row.west === null || row.south === null || row.east === null || row.north === null
        ? null
        : [row.west, row.south, row.east, row.north],
  };
}

export class PostgresGeographyRepository implements GeographyRepository {
  constructor(private readonly db: pg.Pool) {}

  /**
   * The units inside a place, found geographically rather than by `parent_id`.
   *
   * WHY NOT parent_id
   * A district does not contain one kind of thing. Nagpur contains fourteen
   * talukas, three municipal bodies and its villages, and those sit at three
   * different levels — a municipal corporation is not administratively beneath
   * a taluka, it is beside it. A strict parent chain forces one of them to be
   * mis-filed, and forces the reader to guess which branch a place is under.
   *
   * Containment answers the question the reader is actually asking: what is in
   * here? `ST_Contains` against the parent's own polygon, with the parent
   * excluded, and the GIST index doing the first cut.
   */
  async childrenOf(parentId: number): Promise<readonly GeoUnit[]> {
    // A parent with no boundary of its own cannot contain anything spatially.
    // States are in that position: the directory names them, and no boundary
    // for them has been ingested. Those fall back to the recorded parent link,
    // which is what the ingest wrote.
    const parentHasBoundary = await this.db.query<{ present: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM admin_unit_boundary WHERE admin_unit_id = $1) AS present`,
      [parentId],
    );
    if (parentHasBoundary.rows[0]?.present !== true) {
      const structural = await this.db.query<UnitRow>(
        `SELECT ${UNIT_COLUMNS}
           FROM admin_unit u
           LEFT JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
          WHERE u.parent_id = $1
          ORDER BY u.level, u.name_en`,
        [parentId],
      );
      return structural.rows.map(toUnit);
    }

    const result = await this.db.query<UnitRow>(
      `WITH parent AS (
         SELECT geometry FROM admin_unit_boundary WHERE admin_unit_id = $1
       )
       SELECT ${UNIT_COLUMNS}
         FROM admin_unit u
         JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
         CROSS JOIN parent p
        WHERE u.id <> $1
          AND b.geometry && p.geometry
          -- A boundary that merely brushes a neighbour is not inside it. The
          -- surface point lies on the polygon by construction, so this is exact
          -- for well-formed geometry and cheap once the index has cut the set.
          AND ST_Contains(p.geometry, ST_PointOnSurface(b.geometry))
        ORDER BY
          CASE u.level
            WHEN 'district' THEN 2 WHEN 'sub_district' THEN 3
            WHEN 'urban_local_body' THEN 4 WHEN 'block' THEN 4
            WHEN 'gram_panchayat' THEN 5 WHEN 'village' THEN 5
            WHEN 'ward' THEN 6 ELSE 9
          END,
          u.name_en`,
      [parentId],
    );
    return result.rows.map(toUnit);
  }

  async unitById(id: number): Promise<GeoUnit | null> {
    const result = await this.db.query<UnitRow>(
      `SELECT ${UNIT_COLUMNS}
         FROM admin_unit u
         LEFT JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
        WHERE u.id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row === undefined ? null : toUnit(row);
  }

  /**
   * Walks `parent_id` upward rather than reading the closure table, which is
   * empty: nothing has populated it since the OSM ingest writes parents
   * directly. The recursion is bounded by the nine levels of the hierarchy.
   */
  async ancestorsOf(id: number): Promise<readonly GeoUnit[]> {
    const result = await this.db.query<UnitRow>(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_id, 0 AS depth FROM admin_unit WHERE id = $1
         UNION ALL
         SELECT u.id, u.parent_id, chain.depth + 1
           FROM admin_unit u JOIN chain ON u.id = chain.parent_id
          WHERE chain.depth < 12
       )
       SELECT ${UNIT_COLUMNS}
         FROM chain
         JOIN admin_unit u ON u.id = chain.id
         LEFT JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
        ORDER BY chain.depth DESC`,
      [id],
    );
    return result.rows.map(toUnit);
  }

  async boundariesOfChildren(parentId: number): Promise<BoundaryFeatureCollection> {
    const result = await this.db.query<{ feature: BoundaryFeatureCollection["features"][number] }>(
      `SELECT jsonb_build_object(
                'type', 'Feature',
                'id', u.id,
                'properties', jsonb_build_object(
                  'unitId', u.id,
                  'name', u.name_en,
                  'level', u.level::text,
                  'sourceKind', b.source_kind::text,
                  'sourceName', b.source_name
                ),
                'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(b.geometry, $2))::jsonb
              ) AS feature
         FROM admin_unit u
         JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
        WHERE u.parent_id = $1
        ORDER BY u.name_en`,
      [parentId, TOLERANCE_OVERVIEW],
    );
    return { type: "FeatureCollection", features: result.rows.map((r) => r.feature) };
  }

  /**
   * Viewport-scoped read. `&&` is the bounding-box operator, which is what the
   * GIST index answers directly; the exact intersection is not needed to decide
   * what to draw and costs far more.
   */
  async unitsIntersecting(
    bbox: readonly [number, number, number, number],
    levels: readonly AdminUnitLevel[],
    limit: number,
  ): Promise<readonly GeoUnit[]> {
    const result = await this.db.query<UnitRow>(
      `SELECT ${UNIT_COLUMNS}
         FROM admin_unit u
         JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
        WHERE b.geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
          AND ($5::text[] IS NULL OR u.level::text = ANY($5))
        ORDER BY ST_Area(b.geometry) DESC
        LIMIT $6`,
      [bbox[0], bbox[1], bbox[2], bbox[3], levels.length === 0 ? null : [...levels], limit],
    );
    return result.rows.map(toUnit);
  }

  /**
   * Ledger state units keyed by LGD code, for joining to outlines that carry no
   * ledger identity of their own.
   */
  async statesByLgdCode(): Promise<ReadonlyMap<string, number>> {
    const result = await this.db.query<{ id: string; lgd_code: string }>(
      `SELECT id, lgd_code FROM admin_unit WHERE level = 'state' AND lgd_code IS NOT NULL`,
    );
    return new Map(result.rows.map((r) => [r.lgd_code, Number(r.id)]));
  }

  /**
   * Places and records matching a term.
   *
   * Two queries rather than one union in SQL: they read different tables with
   * different notions of relevance, and forcing them into one statement would
   * make neither rankable. Places are ranked so that a name that starts with
   * the term beats one that merely contains it — typing "Nag" should reach
   * Nagpur before Nagpura — and then by how large the place is, because a
   * district is a more likely target than one of its villages.
   */
  async search(term: string, limit: number): Promise<readonly SearchResult[]> {
    const trimmed = term.trim();
    if (trimmed.length < 2) return [];
    const pattern = `%${trimmed}%`;
    const prefix = `${trimmed}%`;

    const [places, records] = await Promise.all([
      this.db.query<{
        id: string;
        name_en: string;
        level: AdminUnitLevel;
        state_code: string | null;
        state_name: string | null;
        has_boundary: boolean;
      }>(
        `SELECT u.id, u.name_en, u.level::text AS level,
                s.lgd_code AS state_code, s.name_en AS state_name,
                (b.admin_unit_id IS NOT NULL) AS has_boundary
           FROM admin_unit u
           LEFT JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
           -- The state a unit sits under, found by walking ancestors rather
           -- than by looking a fixed number of levels up: a village may sit
           -- four levels below its state, and a hard-coded depth silently drops
           -- the context for anything deeper.
           LEFT JOIN LATERAL (
             WITH RECURSIVE up AS (
               SELECT a.id, a.parent_id, a.level, a.lgd_code, a.name_en, 0 AS depth
                 FROM admin_unit a WHERE a.id = u.id
               UNION ALL
               SELECT a.id, a.parent_id, a.level, a.lgd_code, a.name_en, up.depth + 1
                 FROM admin_unit a JOIN up ON a.id = up.parent_id
                WHERE up.depth < 10
             )
             SELECT lgd_code, name_en FROM up WHERE level = 'state' LIMIT 1
           ) s ON TRUE
          WHERE u.name_en ILIKE $1
          ORDER BY (u.name_en ILIKE $2) DESC,
                   COALESCE(ST_Area(b.geometry), 0) DESC,
                   u.name_en
          LIMIT $3`,
        [pattern, prefix, limit],
      ),
      this.db.query<{ id: string; title: string; issuing_authority: string | null }>(
        `SELECT id, title, issuing_authority
           FROM document
          WHERE title ILIKE $1
          ORDER BY title
          LIMIT $2`,
        [pattern, limit],
      ),
    ]);

    return [
      ...places.rows.map((r) => ({
        kind: "place" as const,
        id: Number(r.id),
        title: r.name_en,
        subtitle: LEVEL_LABEL[r.level],
        context: r.state_name,
        stateCode: r.state_code,
        hasBoundary: r.has_boundary,
      })),
      ...records.rows.map((r) => ({
        kind: "record" as const,
        id: Number(r.id),
        title: displayTitle(r.title),
        subtitle: "Audit report",
        context: r.issuing_authority,
        stateCode: null,
        hasBoundary: false,
      })),
    ];
  }

  /** Detailed geometry for one unit, for framing and highlighting it. */
  async boundaryOf(id: number): Promise<unknown> {
    const result = await this.db.query<{ geometry: unknown }>(
      `SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, $2))::jsonb AS geometry
         FROM admin_unit_boundary WHERE admin_unit_id = $1`,
      [id, TOLERANCE_DETAIL],
    );
    return result.rows[0]?.geometry ?? null;
  }
}
