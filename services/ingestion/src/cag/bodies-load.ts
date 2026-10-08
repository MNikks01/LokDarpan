import type { SqlClient } from "@lokdarpan/database";
import { mayRepublish } from "@lokdarpan/domain";

import { openDatasetVersion, sealDatasetVersion } from "../lgd/load";

/**
 * Public bodies from reviewed mentions (ADR-074).
 *
 * A body exists in the ledger because a person confirmed that a CAG page names
 * it. This reads every `body_reference` fact decided in favour — verified, or
 * corrected to the name the page actually prints — and makes the ledger agree:
 * one body per name under the territory it governs, and one mention per
 * confirmed fact.
 *
 * The caller owns the transaction: run it inside one, so a failure part-way
 * leaves the ledger as it was (`bodies-cli.ts` does).
 *
 * It is idempotent and convergent. Run twice, it writes nothing the second
 * time; run after a reviewer rejects or corrects a mention, it removes the
 * mention that decision withdrew. It never renames a body: a corrected name is
 * a different body, and the old one stops being shown once nothing confirms it.
 */

export interface BodyLoadResult {
  readonly governments: number;
  readonly departments: number;
  readonly mentionsAdded: number;
  readonly mentionsRemoved: number;
  /** Confirmed mentions naming a government whose place is not in the hierarchy. */
  readonly unplaced: readonly string[];
}

export interface BodyLoadOptions {
  /** Only documents filed under this state (LGD code). All states when absent. */
  readonly stateLgdCode?: string;
}

interface MentionRow {
  readonly fact_id: string;
  readonly name: string;
  readonly source_id: string;
  readonly state_id: string;
  readonly state_name: string;
}

const GOVERNMENT_OF = "Government of ";

/**
 * Confirmed mentions, each with the state its document is filed under.
 *
 * The state is found by walking `admin_unit.parent_id` up from the document's
 * unit. `admin_unit_closure` would be the one-read answer, but no loader writes
 * it: it is empty in every ledger examined (7 October 2026), so a join on it
 * silently finds nothing.
 *
 * Facts read from a scan are left out: `published_fact` withholds them until a
 * surface can say how they were read (ADR-072), and a body created from one
 * would publish what the view withholds.
 */
async function confirmedMentions(
  client: SqlClient,
  stateLgdCode: string | undefined,
): Promise<MentionRow[]> {
  const result = await client.query(
    `SELECT f.id AS fact_id,
            btrim(COALESCE(f.corrected_value, f.normalised_value)) AS name,
            s.source_id,
            st.id AS state_id,
            st.name_en AS state_name
       FROM document_fact f
       JOIN document d           ON d.id = f.document_id
       JOIN source_artifact s    ON s.sha256 = d.source_sha256
       JOIN LATERAL (
         WITH RECURSIVE up (id, parent_id, level, lgd_code, name_en) AS (
           SELECT a.id, a.parent_id, a.level, a.lgd_code, a.name_en
             FROM admin_unit a WHERE a.id = d.admin_unit_id
           UNION ALL
           SELECT a.id, a.parent_id, a.level, a.lgd_code, a.name_en
             FROM admin_unit a JOIN up ON a.id = up.parent_id
         )
         SELECT id, lgd_code, name_en FROM up WHERE level = 'state' LIMIT 1
       ) st ON true
      WHERE f.kind = 'body_reference'
        AND f.verification_status IN ('verified', 'corrected')
        AND f.page_reading_id IS NULL
        AND COALESCE(f.corrected_value, f.normalised_value) IS NOT NULL
        AND ($1::text IS NULL OR st.lgd_code = $1)
      ORDER BY f.id`,
    [stateLgdCode ?? null],
  );
  return (result.rows as MentionRow[]).filter((r) => r.name !== "" && mayRepublish(r.source_id));
}

/** The unit a "Government of X" governs: the report's state, or India. */
async function placeOfGovernment(
  client: SqlClient,
  place: string,
  row: MentionRow,
): Promise<string | null> {
  if (place === row.state_name) return row.state_id;
  const result = await client.query(
    `SELECT id FROM admin_unit
      WHERE name_en = $1 AND level IN ('country', 'state') AND valid_to IS NULL
      ORDER BY level LIMIT 1`,
    [place],
  );
  const found = result.rows[0] as { id: string } | undefined;
  return found?.id ?? null;
}

interface BodySpec {
  readonly kind: "government" | "department";
  readonly name: string;
  readonly parentId: string | null;
  readonly unitId: string;
}

async function ensureBody(
  client: SqlClient,
  body: BodySpec,
  version: number,
): Promise<{ id: string; created: boolean }> {
  const existing = await client.query(
    `SELECT id FROM public_body
      WHERE jurisdiction_admin_unit_id = $1 AND kind = $2 AND name_en = $3`,
    [body.unitId, body.kind, body.name],
  );
  const row = existing.rows[0] as { id: string } | undefined;
  if (row !== undefined) return { id: row.id, created: false };
  const inserted = await client.query(
    `INSERT INTO public_body (kind, name_en, parent_body_id, jurisdiction_admin_unit_id, dataset_version_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [body.kind, body.name, body.parentId, body.unitId, version],
  );
  return { id: (inserted.rows[0] as { id: string }).id, created: true };
}

export async function loadPublicBodies(
  client: SqlClient,
  options: BodyLoadOptions = {},
): Promise<BodyLoadResult> {
  const mentions = await confirmedMentions(client, options.stateLgdCode);
  const version = await openDatasetVersion(
    client,
    "Public bodies from reviewed CAG mentions (ADR-074)",
  );

  let governments = 0;
  let departments = 0;
  const unplaced: string[] = [];
  const wanted = new Set<string>();

  for (const m of mentions) {
    let bodyId: string;
    if (m.name.startsWith(GOVERNMENT_OF)) {
      const place = m.name.slice(GOVERNMENT_OF.length).trim();
      const unitId = await placeOfGovernment(client, place, m);
      if (unitId === null) {
        unplaced.push(m.name);
        continue;
      }
      const gov = await ensureBody(
        client,
        { kind: "government", name: m.name, parentId: null, unitId },
        version,
      );
      if (gov.created) governments += 1;
      bodyId = gov.id;
    } else {
      // A department in a state's report belongs to that state's government.
      // The government row may exist before anything confirms its own name;
      // it is shown only once a reviewed mention does.
      const gov = await ensureBody(
        client,
        {
          kind: "government",
          name: `${GOVERNMENT_OF}${m.state_name}`,
          parentId: null,
          unitId: m.state_id,
        },
        version,
      );
      if (gov.created) governments += 1;
      const dept = await ensureBody(
        client,
        { kind: "department", name: m.name, parentId: gov.id, unitId: m.state_id },
        version,
      );
      if (dept.created) departments += 1;
      bodyId = dept.id;
    }
    wanted.add(`${bodyId}:${m.fact_id}`);
  }

  let mentionsAdded = 0;
  for (const key of wanted) {
    const [bodyId, factId] = key.split(":");
    const r = await client.query(
      `INSERT INTO public_body_mention (public_body_id, document_fact_id, dataset_version_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1`,
      [bodyId, factId, version],
    );
    mentionsAdded += r.rows.length;
  }

  // Withdrawn mentions: a fact no longer decided in favour, or now naming a
  // different body after a correction. Scoped to the state being loaded, so
  // loading one state never removes another's mentions.
  const existing = await client.query(
    `SELECT m.public_body_id, m.document_fact_id
         FROM public_body_mention m
         JOIN document_fact f      ON f.id = m.document_fact_id
         JOIN document d           ON d.id = f.document_id
         JOIN LATERAL (
           WITH RECURSIVE up (id, parent_id, level, lgd_code, name_en) AS (
             SELECT a.id, a.parent_id, a.level, a.lgd_code, a.name_en
               FROM admin_unit a WHERE a.id = d.admin_unit_id
             UNION ALL
             SELECT a.id, a.parent_id, a.level, a.lgd_code, a.name_en
               FROM admin_unit a JOIN up ON a.id = up.parent_id
           )
           SELECT id, lgd_code, name_en FROM up WHERE level = 'state' LIMIT 1
         ) st ON true
        WHERE ($1::text IS NULL OR st.lgd_code = $1)`,
    [options.stateLgdCode ?? null],
  );
  let mentionsRemoved = 0;
  for (const row of existing.rows as { public_body_id: string; document_fact_id: string }[]) {
    if (wanted.has(`${row.public_body_id}:${row.document_fact_id}`)) continue;
    const r = await client.query(
      `DELETE FROM public_body_mention
          WHERE public_body_id = $1 AND document_fact_id = $2 RETURNING 1`,
      [row.public_body_id, row.document_fact_id],
    );
    mentionsRemoved += r.rows.length;
  }

  await sealDatasetVersion(client, version);
  return { governments, departments, mentionsAdded, mentionsRemoved, unplaced };
}
