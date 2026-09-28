import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type pg from "pg";

import { districtKey } from "./detail";

/**
 * Reviewed alternative names for districts, from
 * `data/reference/district-aliases.json`.
 *
 * WHY A REVIEWED FILE AND NOT A LOOSER MATCH
 * "Muktsar" is Sri Muktsar Sahib and "Pauri" is Pauri Garhwal, but a rule that
 * matched a name inside a longer one would also turn "Kanpur" into whichever of
 * Kanpur Nagar or Kanpur Dehat it met first, and "Imphal" into East or West.
 * Each alias is a person's decision, recorded with its evidence, applied within
 * one state to one district, and used only once approved.
 */

export interface DistrictAliasEntry {
  readonly state_lgd_code: string;
  readonly alias: string;
  readonly district_lgd_code: string;
  readonly district_name: string;
  readonly evidence: string;
  readonly status: "proposed" | "approved";
  readonly reviewed_by: string | null;
  readonly reviewed_on: string | null;
}

/** An approved alias, resolved to the ledger unit it names. */
export interface ResolvedAlias {
  readonly adminUnitId: number;
  readonly alias: string;
  readonly districtName: string;
}

export const NO_ALIASES: ReadonlyMap<string, ResolvedAlias> = new Map();

const DEFAULT_PATH = fileURLToPath(
  new URL("../../../../data/reference/district-aliases.json", import.meta.url),
);

export function readAliases(path: string = DEFAULT_PATH): readonly DistrictAliasEntry[] {
  const file = JSON.parse(readFileSync(path, "utf8")) as { aliases?: DistrictAliasEntry[] };
  return file.aliases ?? [];
}

/**
 * The approved aliases of one state, keyed by `districtKey`, each pointing at
 * the ledger's unit for its district. An alias whose district the ledger does
 * not hold under that state is dropped rather than guessed at.
 */
export async function aliasesOfState(
  db: pg.ClientBase,
  stateLgdCode: string,
  entries: readonly DistrictAliasEntry[] = readAliases(),
): Promise<ReadonlyMap<string, ResolvedAlias>> {
  const approved = entries.filter(
    (e) => e.status === "approved" && e.state_lgd_code === stateLgdCode,
  );
  if (approved.length === 0) return NO_ALIASES;
  const units = await db.query<{ id: string; lgd_code: string; name_en: string }>(
    `SELECT d.id, d.lgd_code, d.name_en
       FROM admin_unit d
       JOIN admin_unit s ON s.id = d.parent_id
      WHERE d.level = 'district' AND s.level = 'state' AND s.lgd_code = $1
        AND d.lgd_code = ANY($2)`,
    [stateLgdCode, approved.map((e) => e.district_lgd_code)],
  );
  const byCode = new Map(units.rows.map((u) => [u.lgd_code, u]));
  const resolved = new Map<string, ResolvedAlias>();
  for (const entry of approved) {
    const unit = byCode.get(entry.district_lgd_code);
    if (unit === undefined) continue;
    resolved.set(districtKey(entry.alias), {
      adminUnitId: Number(unit.id),
      alias: entry.alias,
      districtName: unit.name_en,
    });
  }
  return resolved;
}
