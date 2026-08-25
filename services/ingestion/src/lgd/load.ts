import type { SqlClient } from "@lokdarpan/database";

import type { RawArtifact } from "../raw-store.js";
import type { LgdState } from "./parse.js";

export interface LoadResult {
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
}

/**
 * LGD is an authoritative directory read directly from its own tables — there
 * is no OCR, no inference and no layout heuristic between the published value
 * and the stored one. Extraction confidence is therefore 1.
 *
 * This is deliberately a named constant rather than a literal at the call site:
 * every other source will need a considered value, and copying `1.0` around is
 * how an OCR'd PDF ends up claiming certainty.
 */
const LGD_EXTRACTION_CONFIDENCE = 1;

export async function recordArtifact(client: SqlClient, artifact: RawArtifact): Promise<void> {
  await client.query(
    `INSERT INTO source_artifact
       (sha256, source_id, source_url, retrieved_at, http_status, content_type, byte_size, storage_path)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (sha256) DO NOTHING`,
    [
      artifact.sha256,
      artifact.sourceId,
      artifact.sourceUrl,
      artifact.retrievedAt,
      artifact.httpStatus,
      artifact.contentType,
      artifact.byteSize,
      artifact.storagePath,
    ],
  );
}

export async function openDatasetVersion(client: SqlClient, description: string): Promise<number> {
  const result = await client.query(
    `INSERT INTO dataset_version (description) VALUES ($1) RETURNING id`,
    [description],
  );
  const row = result.rows[0] as { id: string } | undefined;
  if (row === undefined) throw new Error("dataset_version insert returned no id.");
  return Number(row.id);
}

export async function sealDatasetVersion(client: SqlClient, id: number): Promise<void> {
  await client.query(`UPDATE dataset_version SET sealed_at = now() WHERE id = $1`, [id]);
}

/**
 * Loads States/UTs into `admin_unit`.
 *
 * Upsert on `(lgd_code, level)`: LGD is a living directory whose names are
 * corrected over time, and re-running an ingest must converge rather than
 * duplicate. Provenance is rewritten on every change so a unit always names
 * the artefact its *current* values came from.
 */
export interface LoadContext {
  readonly artifact: RawArtifact;
  readonly datasetVersionId: number;
  /** The date from which these values are asserted to hold. */
  readonly validFrom: string;
}

export async function loadStates(
  client: SqlClient,
  states: readonly LgdState[],
  context: LoadContext,
): Promise<LoadResult> {
  const { artifact, datasetVersionId, validFrom } = context;
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const state of states) {
    const result = await client.query(
      `INSERT INTO admin_unit
         (lgd_code, level, name_en, name_local, source_sha256, dataset_version_id,
          extraction_confidence, valid_from)
       VALUES ($1, 'state', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (lgd_code, level) DO UPDATE SET
         name_en               = EXCLUDED.name_en,
         name_local            = EXCLUDED.name_local,
         source_sha256         = EXCLUDED.source_sha256,
         dataset_version_id    = EXCLUDED.dataset_version_id,
         extraction_confidence = EXCLUDED.extraction_confidence
       WHERE admin_unit.name_en    IS DISTINCT FROM EXCLUDED.name_en
          OR admin_unit.name_local IS DISTINCT FROM EXCLUDED.name_local
       RETURNING (xmax = 0) AS was_insert`,
      [
        state.lgdCode,
        state.nameEn,
        state.nameLocal,
        artifact.sha256,
        datasetVersionId,
        LGD_EXTRACTION_CONFIDENCE,
        validFrom,
      ],
    );

    const row = result.rows[0] as { was_insert: boolean } | undefined;
    if (row === undefined) unchanged += 1;
    else if (row.was_insert) inserted += 1;
    else updated += 1;
  }

  return { inserted, updated, unchanged };
}
