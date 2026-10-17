import type { SqlClient } from "@lokdarpan/database";
import { mayRepublish } from "@lokdarpan/domain";

import { openDatasetVersion, sealDatasetVersion } from "../lgd/load";
import { bareName, parsePlaceValue, type GazetteerEntry } from "./places";

/**
 * Places named on audit pages, from reviewed facts (ADR-077).
 *
 * The state of a document is found by walking `admin_unit.parent_id` up from
 * the unit it is filed under; `admin_unit_closure` is empty in every ledger
 * examined (#192), so a join on it silently finds nothing.
 */
const STATE_OF_DOCUMENT = `
  WITH RECURSIVE up (id, parent_id, level, lgd_code) AS (
    SELECT a.id, a.parent_id, a.level, a.lgd_code
      FROM admin_unit a JOIN document d ON d.admin_unit_id = a.id WHERE d.id = $1
    UNION ALL
    SELECT a.id, a.parent_id, a.level, a.lgd_code FROM admin_unit a JOIN up ON a.id = up.parent_id
  )
  SELECT id FROM up WHERE level = 'state' LIMIT 1`;

/** The state's districts and talukas, by the ids the ledger holds them under. */
const PLACES_OF_STATE = `
  SELECT a.id, a.name_en, a.level FROM admin_unit a
   WHERE a.valid_to IS NULL
     AND ((a.level = 'district' AND a.parent_id = $1)
       OR (a.level = 'sub_district'
           AND a.parent_id IN (SELECT id FROM admin_unit WHERE parent_id = $1 AND level = 'district')))`;

interface PlaceRow {
  readonly id: string;
  readonly name_en: string;
  readonly level: "district" | "sub_district";
}

async function placesOfState(client: SqlClient, stateId: string): Promise<PlaceRow[]> {
  const result = await client.query(PLACES_OF_STATE, [stateId]);
  return result.rows as PlaceRow[];
}

/**
 * The places a document's pages may be matched against: those of the state it
 * is filed under. A document filed under no state is matched against nothing,
 * which proposes no place rather than guessing one.
 */
export async function gazetteerForDocument(
  client: SqlClient,
  documentId: number,
): Promise<GazetteerEntry[]> {
  const state = (await client.query(STATE_OF_DOCUMENT, [documentId])).rows[0] as
    { id: string } | undefined;
  if (state === undefined) return [];
  return (await placesOfState(client, state.id)).map((p) => ({
    name: p.name_en,
    level: p.level,
  }));
}

export interface PlaceLoadResult {
  readonly mentionsAdded: number;
  readonly mentionsRemoved: number;
  /** Confirmed values that name no place the state holds, as the reviewer wrote them. */
  readonly unresolved: readonly string[];
}

interface ConfirmedRow {
  readonly fact_id: string;
  readonly value: string;
  readonly source_id: string;
  readonly state_id: string;
}

/**
 * Makes `place_mention` agree with the reviewed facts of one state: one mention
 * per confirmed fact, and none for a fact no longer decided in favour. The
 * caller owns the transaction (`places-cli.ts` runs it inside one).
 *
 * Idempotent: run twice, it writes nothing the second time.
 */
export async function loadPlaceMentions(
  client: SqlClient,
  options: { readonly stateLgdCode: string },
): Promise<PlaceLoadResult> {
  const state = (
    await client.query(
      `SELECT id FROM admin_unit WHERE level = 'state' AND lgd_code = $1 AND valid_to IS NULL`,
      [options.stateLgdCode],
    )
  ).rows[0] as { id: string } | undefined;
  if (state === undefined) return { mentionsAdded: 0, mentionsRemoved: 0, unresolved: [] };

  const places = await placesOfState(client, state.id);
  const byName = new Map(places.map((p) => [`${p.level}:${bareName(p.name_en)}`, p.id]));

  // Facts read from a scan are left out, as `published_fact` withholds them (ADR-072).
  const confirmed = (
    await client.query(
      `SELECT f.id AS fact_id, btrim(COALESCE(f.corrected_value, f.normalised_value)) AS value,
              s.source_id, d.admin_unit_id AS state_id
         FROM document_fact f
         JOIN document d        ON d.id = f.document_id
         JOIN source_artifact s ON s.sha256 = d.source_sha256
        WHERE f.kind = 'place_reference'
          AND f.verification_status IN ('verified', 'corrected')
          AND f.page_reading_id IS NULL
          AND d.admin_unit_id = $1
        ORDER BY f.id`,
      [state.id],
    )
  ).rows as ConfirmedRow[];

  const version = await openDatasetVersion(client, "Places named on reviewed CAG pages (ADR-077)");
  const wanted = new Set<string>();
  const unresolved: string[] = [];
  for (const row of confirmed) {
    if (!mayRepublish(row.source_id)) continue;
    const place = parsePlaceValue(row.value);
    const unitId = place === null ? undefined : byName.get(`${place.level}:${place.name}`);
    if (unitId === undefined) {
      unresolved.push(row.value);
      continue;
    }
    wanted.add(`${unitId}:${row.fact_id}`);
  }

  let mentionsAdded = 0;
  for (const key of wanted) {
    const [unitId, factId] = key.split(":");
    const r = await client.query(
      `INSERT INTO place_mention (admin_unit_id, document_fact_id, dataset_version_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1`,
      [unitId, factId, version],
    );
    mentionsAdded += r.rows.length;
  }

  // Withdrawn mentions, scoped to this state's documents so loading one state
  // never removes another's.
  const existing = (
    await client.query(
      `SELECT m.admin_unit_id, m.document_fact_id
         FROM place_mention m
         JOIN document_fact f ON f.id = m.document_fact_id
         JOIN document d      ON d.id = f.document_id
        WHERE d.admin_unit_id = $1`,
      [state.id],
    )
  ).rows as { admin_unit_id: string; document_fact_id: string }[];
  let mentionsRemoved = 0;
  for (const row of existing) {
    if (wanted.has(`${row.admin_unit_id}:${row.document_fact_id}`)) continue;
    const r = await client.query(
      `DELETE FROM place_mention WHERE admin_unit_id = $1 AND document_fact_id = $2 RETURNING 1`,
      [row.admin_unit_id, row.document_fact_id],
    );
    mentionsRemoved += r.rows.length;
  }

  await sealDatasetVersion(client, version);
  return { mentionsAdded, mentionsRemoved, unresolved };
}
