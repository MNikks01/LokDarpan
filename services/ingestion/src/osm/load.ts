import type pg from "pg";
import { OSM_ATTRIBUTION, OSM_LICENCE, type FetchedArtifact } from "./overpass";
import { lgdKindMatchesLevel, type ParsedUnit } from "./boundaries";

/**
 * Load parsed OSM boundaries into the ledger.
 *
 * GEOMETRY IS ASSEMBLED BY POSTGIS, NOT BY US.
 * The rings arrive as coordinate arrays; turning them into a valid MultiPolygon
 * — deciding which ring is a hole, repairing self-touching linework, orienting
 * the result — is exactly the work a spatial database exists to do correctly.
 * Reimplementing it in TypeScript would be slower, wronger, and would move the
 * failure away from the constraint that catches it.
 *
 * The unit and its boundary are written in one transaction. A unit whose
 * geometry failed to store would be a place the explorer offers and then cannot
 * draw, which reads as a broken map rather than an honest absence.
 */

export interface LoadResult {
  readonly inserted: number;
  readonly updated: number;
  readonly failed: readonly { readonly osmRelationId: number; readonly reason: string }[];
}

export interface LoadOptions {
  readonly units: readonly ParsedUnit[];
  readonly artifact: FetchedArtifact;
  readonly datasetDescription: string;
  /** Ledger id of the unit these sit inside, when known. */
  readonly parentId: number | null;
}

function ringsToWkt(unit: ParsedUnit): string {
  const rings = unit.rings
    .map((ring) => `(${ring.map(([lon, lat]) => `${String(lon)} ${String(lat)}`).join(",")})`)
    .join(",");
  return `POLYGON(${rings})`;
}

/**
 * Let a relation take over the unit the directory already named.
 *
 * IDENTITY COMES FROM LGD, SHAPE COMES FROM OPENSTREETMAP.
 *
 * The directory is the authoritative registry of what places exist, and its
 * units sit in the ledger already, named and identified but without geometry.
 * A relation carrying that unit's LGD code is the same place, so it claims the
 * existing row instead of inserting beside it. Otherwise every state would be
 * held twice — once named by the registry, once by the map — and `admin_unit`
 * would stop being the one hierarchy everything downstream resolves against.
 *
 * Only where the tag names a code for this level, and only where the row has
 * not already been claimed: see `lgdKindMatchesLevel` for why the register
 * cannot be inferred from a bare number.
 */
async function claimDirectoryUnit(db: pg.Client, unit: ParsedUnit): Promise<void> {
  if (unit.lgdCode === null || unit.lgdCodeKind === null) return;
  if (!lgdKindMatchesLevel(unit.lgdCodeKind, unit.level)) return;
  await db.query(
    `UPDATE admin_unit
        SET osm_relation_id = $1
      WHERE lgd_code = $2
        AND level = $3::admin_unit_level
        AND osm_relation_id IS NULL`,
    [unit.osmRelationId, unit.lgdCode, unit.level],
  );
}

export async function loadBoundaries(db: pg.Client, options: LoadOptions): Promise<LoadResult> {
  const { units, artifact, parentId } = options;
  const failed: { osmRelationId: number; reason: string }[] = [];
  let inserted = 0;
  let updated = 0;

  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO source_artifact (sha256, source_id, source_url, retrieved_at, http_status, content_type, byte_size, storage_path)
       VALUES ($1, 'openstreetmap-overpass', $2, $3, 200, 'application/json', $4, $5)
       ON CONFLICT (sha256) DO NOTHING`,
      [
        artifact.sha256,
        artifact.sourceUrl,
        artifact.retrievedAt,
        artifact.byteSize,
        `osm/${artifact.sha256}.json`,
      ],
    );

    const version = await db.query<{ id: string }>(
      `INSERT INTO dataset_version (description) VALUES ($1) RETURNING id`,
      [options.datasetDescription],
    );
    const datasetVersionId = version.rows[0]?.id;
    if (datasetVersionId === undefined) throw new Error("could not open a dataset version");

    for (const unit of units) {
      // A savepoint per unit, because the recovery below is otherwise a lie.
      // Postgres aborts the whole transaction on the first failed statement, so
      // catching the error and carrying on produced 25P02 on every subsequent
      // unit and reported the symptom instead of the cause. Ladakh's six
      // districts were lost that way, under an error naming none of them.
      await db.query("SAVEPOINT unit");
      try {
        await claimDirectoryUnit(db, unit);

        const upserted = await db.query<{ id: string; inserted: boolean }>(
          `INSERT INTO admin_unit
             (lgd_code, level, name_en, parent_id, osm_relation_id,
              source_sha256, dataset_version_id, extraction_confidence, valid_from)
           VALUES ($1, $2::admin_unit_level, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
           ON CONFLICT (osm_relation_id) WHERE osm_relation_id IS NOT NULL
           DO UPDATE SET
             -- Deliberately NOT name_en. An existing row was named by whoever
             -- created it, and for a unit the directory identified that is the
             -- directory — the authoritative registry of what places are
             -- called. This ingest is here for geometry, and letting it rename
             -- places on every run would let a community edit quietly retitle a
             -- government body. A new unit still takes its name from OSM on
             -- insert, and a name that genuinely needs correcting is a delete
             -- and re-ingest, which is a deliberate act.
             lgd_code = COALESCE(admin_unit.lgd_code, EXCLUDED.lgd_code),
             parent_id = COALESCE(EXCLUDED.parent_id, admin_unit.parent_id),
             dataset_version_id = EXCLUDED.dataset_version_id
           RETURNING id, (xmax = 0) AS inserted`,
          [
            unit.lgdCode,
            unit.level,
            unit.name,
            parentId,
            unit.osmRelationId,
            artifact.sha256,
            datasetVersionId,
            // OSM boundaries are community-maintained. This is not a claim that
            // the shape is right; it records that the reading of the payload is
            // unambiguous, which is what the column measures.
            0.9,
          ],
        );

        const row = upserted.rows[0];
        if (row === undefined) throw new Error("upsert returned no row");
        if (row.inserted) inserted++;
        else updated++;

        await db.query(
          `INSERT INTO admin_unit_boundary
             (admin_unit_id, geometry, source_kind, source_name, source_licence,
              source_url, source_ref, authority, retrieved_at, dataset_version_id)
           VALUES (
             $1,
             ST_Multi(ST_MakeValid(ST_GeomFromText($2, 4326))),
             'open_dataset', $3, $4, $5, $6, NULL, $7, $8
           )
           ON CONFLICT (admin_unit_id) DO UPDATE SET
             geometry = EXCLUDED.geometry,
             source_ref = EXCLUDED.source_ref,
             retrieved_at = EXCLUDED.retrieved_at,
             dataset_version_id = EXCLUDED.dataset_version_id`,
          [
            row.id,
            ringsToWkt(unit),
            OSM_ATTRIBUTION,
            OSM_LICENCE,
            `https://www.openstreetmap.org/relation/${String(unit.osmRelationId)}`,
            `relation/${String(unit.osmRelationId)}`,
            artifact.retrievedAt,
            datasetVersionId,
          ],
        );
        await db.query("RELEASE SAVEPOINT unit");
      } catch (error: unknown) {
        // One malformed boundary must not abandon the rest of a state. Rewind
        // to the savepoint so the transaction is usable again, then record it.
        await db.query("ROLLBACK TO SAVEPOINT unit");
        failed.push({
          osmRelationId: unit.osmRelationId,
          reason: error instanceof Error ? (error.message.split("\n")[0] ?? "unknown") : "unknown",
        });
      }
    }

    await assignParentsSpatially(db);
    await db.query("COMMIT");
  } catch (error: unknown) {
    await db.query("ROLLBACK");
    throw error;
  }

  return { inserted, updated, failed };
}

/**
 * Level depth in SQL, matching `LEVEL_DEPTH` in the domain.
 *
 * Containment alone is not enough to name a parent. Nagpur City contains the
 * representative point of Nagpur Urban Taluka, so geometry alone filed a taluka
 * under a municipal corporation — which is true of the shapes and false of the
 * administration. A parent must also sit at a shallower level.
 */
const LEVEL_DEPTH_SQL = `CASE level
    WHEN 'country' THEN 0 WHEN 'state' THEN 1 WHEN 'district' THEN 2
    WHEN 'sub_district' THEN 3 WHEN 'block' THEN 4 WHEN 'urban_local_body' THEN 4
    WHEN 'gram_panchayat' THEN 5 WHEN 'village' THEN 5 WHEN 'ward' THEN 6
    ELSE 9 END`;

/**
 * Re-derive `parent_id` from geometry.
 *
 * The ingest is told which unit a query was scoped to, and writes that as the
 * parent for everything it finds — which is right for the level directly below
 * and wrong for everything under that. Scoping a query to a district gives its
 * talukas, its municipal bodies and its villages, and filing all three directly
 * under the district loses the structure.
 *
 * Containment recovers it without anyone naming a hierarchy: a unit's parent is
 * the smallest unit that contains it. A unit nothing contains keeps the parent
 * it was given, which is how districts stay under their state even though no
 * state boundary is held to test containment against.
 */
export async function assignParentsSpatially(db: pg.Client): Promise<number> {
  const result = await db.query(
    `WITH depth AS (
       SELECT id, ${LEVEL_DEPTH_SQL} AS d FROM admin_unit
     ),
     candidate AS (
       SELECT c.id AS child_id,
              p.id AS parent_id,
              ROW_NUMBER() OVER (
                PARTITION BY c.id ORDER BY ST_Area(pb.geometry) ASC
              ) AS rn
         FROM admin_unit c
         JOIN admin_unit_boundary cb ON cb.admin_unit_id = c.id
         JOIN depth cd ON cd.id = c.id
         JOIN admin_unit p  ON p.id <> c.id
         JOIN admin_unit_boundary pb ON pb.admin_unit_id = p.id
         JOIN depth pd ON pd.id = p.id
        WHERE pb.geometry && cb.geometry
          AND pd.d < cd.d
          AND ST_Area(pb.geometry) > ST_Area(cb.geometry)
          AND ST_Contains(pb.geometry, ST_PointOnSurface(cb.geometry))
     )
     UPDATE admin_unit u
        SET parent_id = candidate.parent_id
       FROM candidate
      WHERE candidate.child_id = u.id
        AND candidate.rn = 1
        AND u.parent_id IS DISTINCT FROM candidate.parent_id`,
  );
  return result.rowCount ?? 0;
}
