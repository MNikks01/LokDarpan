import type {
  AdminUnitLevel,
  BoundaryFeatureCollection,
  BoundaryProvenance,
  GeoUnit,
  GeographyRepository,
  SearchResult,
} from "@lokdarpan/domain";
import { LEVEL_LABEL } from "@lokdarpan/domain";
import { displayTitle, mayRepublish } from "@lokdarpan/domain";
import type { Queryable } from "./published-fact.repository";

/**
 * Geography, read from PostGIS.
 *
 * Every spatial operation happens here in SQL, indexed by GIST. None of it is
 * done in the client: a containment test over a district's boundary is a few
 * milliseconds in the database and a frozen browser tab in JavaScript.
 *
 * Geometry is simplified on the way out and serialised at a precision matched
 * to that simplification, never at the default of nine decimal places.
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
/**
 * How complete our holdings are at one level.
 *
 * `not_collected` and an empty list are different claims. The first says nobody
 * looked; the second says nothing was found. Only the first can be true at the
 * same time as the places existing.
 */
export type CoverageStatus = "complete" | "partial" | "not_collected";

export interface LevelCoverage {
  readonly level: AdminUnitLevel;
  readonly status: CoverageStatus;
  /** Why, for anything short of complete. Shown to the reader as written. */
  readonly note: string | null;
  readonly sourceId: string;
  readonly checkedAt: string;
  /** The finding was recorded against an ancestor of the unit asked about. */
  readonly inherited: boolean;
}

// The overview tolerance (0.005°) is not here: a whole level is drawn from
// `geometry_overview`, simplified once when the boundary was written
// (migration 0033). Only a single unit's outline is simplified per request.
const TOLERANCE_DETAIL = 0.0005;

/**
 * Decimal places to serialise coordinates at.
 *
 * Matched to what survives simplification rather than left at the PostGIS
 * default of 9. Nine places is 0.1mm; the overview tolerance above has already
 * moved every vertex by up to 0.005 degrees, which is around 550m. Writing the
 * remaining digits describes a position to the millimetre that was rounded to
 * the half-kilometre one function call earlier — and a reader on a metered
 * connection pays for every one of them.
 *
 * Five places is roughly a metre: still some 500x finer than the overview
 * tolerance and 50x finer than the detail tolerance, so nothing that survived
 * simplification is lost.
 */
const COORDINATE_DIGITS = 5;

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
  /** A pool, or a client inside `readLedger`'s snapshot. */
  constructor(private readonly db: Queryable) {}

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
         SELECT geometry, area_m2 FROM admin_unit_boundary WHERE admin_unit_id = $1
       )
       SELECT ${UNIT_COLUMNS}
         FROM admin_unit u
         JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
         CROSS JOIN parent p
        WHERE u.id <> $1
          AND b.geometry && p.geometry
          -- A unit is never inside a smaller one. Without this, a state whose
          -- interior point happened to fall in one of its own districts was
          -- listed as that district's child: 79 such pairs in the ledger.
          AND b.area_m2 < p.area_m2
          -- A boundary that merely brushes a neighbour is not inside it. The
          -- label point is the centre of the child's largest inscribed circle,
          -- so it lies inside the child by construction, and it is stored
          -- (migration 0032) rather than computed per child per request.
          AND ST_Contains(p.geometry, b.label_point)
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

  /**
   * What we know about how complete our holdings are inside this unit.
   *
   * Pune district holds 14 talukas and no urban local body. Pune Municipal
   * Corporation plainly exists, so an interface that shows only the count is
   * reporting our holdings and will be read as a statement about Pune. This is
   * the record that lets it say which it means.
   *
   * Coverage is recorded against the state, because it is a property of a
   * source's treatment of a level across the state rather than of one district:
   * OpenStreetMap tags few of Maharashtra's municipal bodies everywhere, not
   * specially in Pune. A district therefore inherits its state's finding, and
   * the nearest ancestor carrying one wins so a future district-scoped
   * assessment would override it.
   */
  async coverageIn(unitId: number): Promise<readonly LevelCoverage[]> {
    const result = await this.db.query<{
      level: AdminUnitLevel;
      status: CoverageStatus;
      note: string | null;
      source_id: string;
      checked_at: string;
      depth: number;
    }>(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_id, 0 AS depth FROM admin_unit WHERE id = $1
         UNION ALL
         SELECT a.id, a.parent_id, c.depth + 1
           FROM admin_unit a JOIN chain c ON a.id = c.parent_id
       ),
       found AS (
         SELECT g.level, g.status, g.note, g.source_id, g.checked_at, c.depth,
                row_number() OVER (PARTITION BY g.level ORDER BY c.depth) AS nearest
           FROM geography_coverage g JOIN chain c ON c.id = g.admin_unit_id
       )
       SELECT level, status, note, source_id, checked_at, depth
         FROM found WHERE nearest = 1
        ORDER BY level`,
      [unitId],
    );

    return result.rows.map((r) => ({
      level: r.level,
      status: r.status,
      note: r.note,
      sourceId: r.source_id,
      checkedAt: r.checked_at,
      /** True when the finding was recorded against an ancestor, not this unit. */
      inherited: r.depth > 0,
    }));
  }

  /**
   * The LGD code of the state a unit sits in, or null where there is none.
   *
   * The explorer's URL carries a state and a unit independently, so a shared or
   * edited link can name a state and a unit in a different one. Nothing checked
   * that: `?state=27&unit=<a Kerala district>` rendered the state selector as
   * Maharashtra, framed the map on Kerala, and drew Kerala's breadcrumb under a
   * Maharashtra heading. Every part was individually correct and the page as a
   * whole said something false.
   *
   * Walks the recorded parent chain rather than testing geometry: a unit belongs
   * to the state that the directory places it under, and a containment test
   * would answer a different question at every border.
   *
   * A unit that is itself a state answers with its own code, so the check needs
   * no special case for selecting a state directly.
   */
  async stateCodeOf(unitId: number): Promise<string | null> {
    const result = await this.db.query<{ lgd_code: string | null }>(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_id, level, lgd_code FROM admin_unit WHERE id = $1
         UNION ALL
         SELECT a.id, a.parent_id, a.level, a.lgd_code
           FROM admin_unit a JOIN chain c ON a.id = c.parent_id
       )
       SELECT lgd_code FROM chain WHERE level = 'state' LIMIT 1`,
      [unitId],
    );
    return result.rows[0]?.lgd_code ?? null;
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
                  'sourceName', b.source_name,
                  'labelPoint', jsonb_build_array(
                    round(ST_X(b.label_point)::numeric, $2),
                    round(ST_Y(b.label_point)::numeric, $2)
                  ),
                  'areaM2', round(b.area_m2)
                ),
                'geometry', ST_AsGeoJSON(b.geometry_overview, $2)::jsonb
              ) AS feature
         FROM admin_unit u
         JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
        WHERE u.parent_id = $1
        ORDER BY u.name_en`,
      [parentId, COORDINATE_DIGITS],
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
  /**
   * Places, reports, verified figures and report pages matching what a reader typed.
   *
   * Each kind has its own indexed query (migration 0039) and its own cap, so a
   * common word cannot crowd out the one place a reader meant. Places match a
   * substring or a near-miss spelling, in English or the local script. Figures
   * and pages match whole words, as written, in any script.
   *
   * Only what may be shown is searched: a figure no person has verified is not
   * a result, and a document whose publisher has not permitted republication
   * is filtered exactly as its own page is (`mayRepublish`). Tender titles are
   * not searched at all while their details are withheld (ADR-056).
   */
  async search(term: string, limit: number): Promise<readonly SearchResult[]> {
    const trimmed = term.trim().replace(/\s+/gu, " ");
    if (trimmed.length < 2) return [];
    // One after another: every read in a request shares the snapshot's client
    // (ADR-053), and a client runs one query at a time.
    const places = await this.searchPlaces(trimmed, limit);
    const records = await this.searchRecords(trimmed, limit);
    const figures = await this.searchFigures(trimmed, limit);
    const passages = await this.searchPassages(trimmed, limit);
    return [...places, ...records, ...figures, ...passages];
  }

  private async searchPlaces(term: string, limit: number): Promise<SearchResult[]> {
    const escaped = term.replace(/[\\%_]/gu, (c) => `\\${c}`);
    const result = await this.db.query<{
      id: string;
      name_en: string;
      level: AdminUnitLevel;
      state_code: string | null;
      state_name: string | null;
      has_boundary: boolean;
    }>(
      // The best matches first, then the state for those few alone: walking
      // ancestors per candidate row would cost a recursive query for every
      // village that shares a syllable with the term.
      `WITH hits AS (
         SELECT u.id, u.name_en, u.level,
                (b.admin_unit_id IS NOT NULL) AS has_boundary,
                -- coalesce: with no local-script name, false OR NULL is NULL,
                -- and a descending sort puts NULL first — a non-match on top.
                coalesce(u.name_en ILIKE $3 OR u.name_local ILIKE $3, false) AS prefix,
                coalesce(u.name_en ILIKE $2 OR u.name_local ILIKE $2, false) AS contains,
                greatest(similarity(u.name_en, $1), similarity(coalesce(u.name_local, ''), $1)) AS score,
                coalesce(ST_Area(b.geometry), 0) AS area
           FROM admin_unit u
           LEFT JOIN admin_unit_boundary b ON b.admin_unit_id = u.id
          WHERE u.name_en ILIKE $2 OR u.name_local ILIKE $2
             OR u.name_en % $1 OR u.name_local % $1
          ORDER BY prefix DESC, contains DESC, score DESC, area DESC, u.name_en
          LIMIT $4
       )
       SELECT h.id, h.name_en, h.level::text AS level, h.has_boundary,
              s.lgd_code AS state_code, s.name_en AS state_name
         FROM hits h
         LEFT JOIN LATERAL (
           WITH RECURSIVE up AS (
             SELECT a.id, a.parent_id, a.level, a.lgd_code, a.name_en, 0 AS depth
               FROM admin_unit a WHERE a.id = h.id
             UNION ALL
             SELECT a.id, a.parent_id, a.level, a.lgd_code, a.name_en, up.depth + 1
               FROM admin_unit a JOIN up ON a.id = up.parent_id
              WHERE up.depth < 10
           )
           SELECT lgd_code, name_en FROM up WHERE level = 'state' LIMIT 1
         ) s ON TRUE
        ORDER BY h.prefix DESC, h.contains DESC, h.score DESC, h.area DESC, h.name_en`,
      [term, `%${escaped}%`, `${escaped}%`, limit],
    );
    return result.rows.map((r) => ({
      kind: "place" as const,
      id: Number(r.id),
      title: r.name_en,
      subtitle: LEVEL_LABEL[r.level],
      context: r.state_name,
      stateCode: r.state_code,
      hasBoundary: r.has_boundary,
      documentId: null,
      pageNumber: null,
      excerpt: null,
    }));
  }

  private async searchRecords(term: string, limit: number): Promise<SearchResult[]> {
    const escaped = term.replace(/[\\%_]/gu, (c) => `\\${c}`);
    const result = await this.db.query<{
      id: string;
      title: string;
      issuing_authority: string | null;
      source_id: string;
    }>(
      `SELECT d.id, d.title, d.issuing_authority, a.source_id
         FROM document d JOIN source_artifact a ON a.sha256 = d.source_sha256
        WHERE d.title ILIKE $2 OR d.title % $1
        ORDER BY (d.title ILIKE $2) DESC, similarity(d.title, $1) DESC, d.title
        LIMIT $3`,
      [term, `%${escaped}%`, limit],
    );
    return result.rows
      .filter((r) => mayRepublish(r.source_id))
      .map((r) => ({
        kind: "record" as const,
        id: Number(r.id),
        title: displayTitle(r.title),
        subtitle: "Audit report",
        context: r.issuing_authority,
        stateCode: null,
        hasBoundary: false,
        documentId: Number(r.id),
        pageNumber: null,
        excerpt: null,
      }));
  }

  private async searchFigures(term: string, limit: number): Promise<SearchResult[]> {
    const result = await this.db.query<{
      id: string;
      document_id: string;
      page_number: number;
      raw_text: string;
      title: string;
      source_id: string;
    }>(
      // The predicate repeats the partial index's (0039), so the planner can
      // use it; a figure with no value is not shown on its page, so not here.
      // One sentence often states several verified figures: it is one result,
      // not the same line repeated.
      `SELECT id, document_id, page_number, raw_text, title, source_id FROM (
         SELECT DISTINCT ON (f.document_id, f.page_number, f.raw_text)
                f.id, f.document_id, f.page_number, f.raw_text, d.title, a.source_id,
                ts_rank(to_tsvector('simple', f.raw_text), q) AS rank
           FROM document_fact f
           JOIN document d ON d.id = f.document_id
           JOIN source_artifact a ON a.sha256 = d.source_sha256,
                websearch_to_tsquery('simple', $1) q
          WHERE f.verification_status IN ('verified', 'corrected')
            AND to_tsvector('simple', f.raw_text) @@ q
            AND coalesce(f.corrected_value, f.normalised_value) IS NOT NULL
          ORDER BY f.document_id, f.page_number, f.raw_text, f.id
       ) one_per_sentence
       ORDER BY rank DESC, id
       LIMIT $2`,
      [term, limit],
    );
    return result.rows
      .filter((r) => mayRepublish(r.source_id))
      .map((r) => ({
        kind: "figure" as const,
        id: Number(r.id),
        title: displayTitle(r.title),
        subtitle: `Page ${String(r.page_number)} · verified figures`,
        context: null,
        stateCode: null,
        hasBoundary: false,
        documentId: Number(r.document_id),
        pageNumber: r.page_number,
        excerpt: r.raw_text,
      }));
  }

  private async searchPassages(term: string, limit: number): Promise<SearchResult[]> {
    const result = await this.db.query<{
      document_id: string;
      page_number: number;
      title: string;
      source_id: string;
      excerpt: string | null;
    }>(
      // Ranked first and excerpted after: building an excerpt reads the whole
      // page, so it is done for the few pages shown, not every page that matched.
      `WITH q AS (SELECT websearch_to_tsquery('simple', $1) AS q),
       ranked AS (
         SELECT p.document_id, p.page_number, p.content,
                ts_rank(to_tsvector('simple', coalesce(p.content, '')), q.q) AS rank
           FROM document_page p, q
          WHERE to_tsvector('simple', coalesce(p.content, '')) @@ q.q
          ORDER BY rank DESC, p.document_id, p.page_number
          LIMIT $2
       )
       SELECT r.document_id, r.page_number, d.title, a.source_id,
              ts_headline('simple', r.content, q.q,
                          'MaxFragments=1, MinWords=12, MaxWords=28, StartSel="", StopSel=""') AS excerpt
         FROM ranked r, q
         JOIN document d ON TRUE
         JOIN source_artifact a ON a.sha256 = d.source_sha256
        WHERE d.id = r.document_id
        ORDER BY r.rank DESC, r.document_id, r.page_number`,
      [term, limit],
    );
    return result.rows
      .filter((r) => mayRepublish(r.source_id))
      .map((r) => ({
        kind: "passage" as const,
        id: Number(r.document_id),
        title: displayTitle(r.title),
        subtitle: `Page ${String(r.page_number)}`,
        context: null,
        stateCode: null,
        hasBoundary: false,
        documentId: Number(r.document_id),
        pageNumber: r.page_number,
        excerpt: r.excerpt === null ? null : r.excerpt.replace(/\s+/gu, " ").trim(),
      }));
  }

  /** Detailed geometry for one unit, for framing and highlighting it. */
  async boundaryOf(id: number): Promise<unknown> {
    const result = await this.db.query<{ geometry: unknown }>(
      `SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, $2), $3)::jsonb AS geometry
         FROM admin_unit_boundary WHERE admin_unit_id = $1`,
      [id, TOLERANCE_DETAIL, COORDINATE_DIGITS],
    );
    return result.rows[0]?.geometry ?? null;
  }
}
