import type pg from "pg";

import type { ReadableRawStore } from "../raw-store";
import { statedFields } from "./detail";

/**
 * Fills `tender.detail_fields` (0048) for tenders collected before it existed,
 * from the detail pages already in the raw store: nothing is fetched from a
 * portal again (ADR-069). Each page is read by the hash the tender cites, and
 * the store refuses bytes that no longer match it, so a page that changed or
 * went missing is counted as a failure, never parsed.
 *
 * Only tenders whose fields are still empty are touched; a later collection
 * that wrote them is not overwritten with an older page.
 */
export interface RefillResult {
  readonly read: number;
  readonly filled: number;
  readonly failed: number;
}

export async function refillDetailFields(
  db: pg.ClientBase,
  store: ReadableRawStore,
  options: { readonly limit?: number } = {},
): Promise<RefillResult> {
  const pending = await db.query<{ id: string; storage_path: string; sha256: string }>(
    `SELECT t.id, s.storage_path, s.sha256
       FROM tender t
       JOIN source_artifact s ON s.sha256 = t.detail_sha256
      WHERE t.detail_fields IS NULL
      ORDER BY t.id
      LIMIT $1`,
    [options.limit ?? 100_000],
  );

  let filled = 0;
  let failed = 0;
  for (const row of pending.rows) {
    let fields: Readonly<Record<string, string>>;
    try {
      fields = statedFields((await store.get(row.storage_path, row.sha256)).toString("utf8"));
    } catch {
      failed += 1;
      continue;
    }
    const r = await db.query(
      `UPDATE tender SET detail_fields = $2::jsonb WHERE id = $1 AND detail_fields IS NULL RETURNING 1`,
      [row.id, JSON.stringify(fields)],
    );
    filled += r.rows.length;
  }
  return { read: pending.rows.length, filled, failed };
}
