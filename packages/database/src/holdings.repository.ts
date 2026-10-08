import {
  LEVELS_BELOW,
  type AdminUnitLevel,
  type BoundaryInput,
  type FiledInput,
  type TenderCollectionInput,
} from "@lokdarpan/domain";

import { PostgresGeographyRepository } from "./geography.repository";
import type { Queryable } from "./published-fact.repository";
import { PostgresTenderRepository } from "./tender.repository";

/**
 * What the ledger holds for one unit, as the inputs to its checklist (LD-009,
 * ADR-076). The publication gate is not applied here: it reads the deployment's
 * switches, which belong to the server, so this returns what is held and the
 * caller decides what may be shown.
 *
 * Records filed by state — audit reports, budgets, tender collection — are read
 * for the state the unit sits in. A district page says "30 reports are held for
 * Maharashtra" rather than "none for Pune", because the second sentence would
 * be about our filing, read as a fact about Pune.
 */

export interface UnitHoldingsInputs {
  readonly unitId: number;
  readonly level: AdminUnitLevel;
  /** The state the unit sits in, itself if it is one; null above state level. */
  readonly state: {
    readonly unitId: number;
    readonly name: string;
    readonly lgdCode: string;
  } | null;
  readonly boundaries: readonly BoundaryInput[];
  /** Null above state level, where nothing is filed. */
  readonly audit: FiledInput | null;
  readonly budget: FiledInput | null;
  readonly tenders: TenderCollectionInput | null;
}

interface StateRow {
  readonly id: string;
  readonly name_en: string;
  readonly lgd_code: string;
}

export class PostgresHoldingsRepository {
  constructor(private readonly db: Queryable) {}

  /** Null when no such unit exists. */
  async inputsFor(unitId: number): Promise<UnitHoldingsInputs | null> {
    const unit = await this.db.query<{ level: AdminUnitLevel }>(
      `SELECT level FROM admin_unit WHERE id = $1`,
      [unitId],
    );
    const level = unit.rows[0]?.level;
    if (level === undefined) return null;

    const state = await this.stateOf(unitId);
    const boundaries = await this.boundaries(unitId, level);
    if (state === null) {
      return { unitId, level, state: null, boundaries, audit: null, budget: null, tenders: null };
    }

    const stateId = Number(state.id);
    const filedUnder = stateId === unitId ? null : { unitId: stateId, name: state.name_en };
    const collection = await new PostgresTenderRepository(this.db).collectionForState(
      state.lgd_code,
    );
    return {
      unitId,
      level,
      state: { unitId: stateId, name: state.name_en, lgdCode: state.lgd_code },
      boundaries,
      audit: { ...(await this.auditReports(stateId)), filedUnder },
      budget: { ...(await this.budgetDepartments(stateId)), filedUnder },
      tenders: {
        status: collection.status,
        portalCode: collection.portalCode,
        collectingSince: collection.collectingSince,
        lastSuccessAt: collection.lastSuccessAt,
        lastCheckedAt: collection.lastCheckedAt,
      },
    };
  }

  /**
   * Walks `parent_id` rather than reading `admin_unit_closure`, which no loader
   * writes (issue #192): a join on it silently finds nothing.
   */
  private async stateOf(unitId: number): Promise<StateRow | null> {
    const result = await this.db.query<StateRow>(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_id, level, name_en, lgd_code FROM admin_unit WHERE id = $1
         UNION ALL
         SELECT a.id, a.parent_id, a.level, a.name_en, a.lgd_code
           FROM admin_unit a JOIN chain c ON a.id = c.parent_id
       )
       SELECT id, name_en, lgd_code FROM chain WHERE level = 'state' LIMIT 1`,
      [unitId],
    );
    return result.rows[0] ?? null;
  }

  /** Units held one level down, with the nearest recorded coverage finding for each level. */
  private async boundaries(
    unitId: number,
    level: AdminUnitLevel,
  ): Promise<readonly BoundaryInput[]> {
    const below = LEVELS_BELOW[level];
    if (below.length === 0) return [];
    const counts = await this.db.query<{ level: AdminUnitLevel; held: string }>(
      `SELECT level, count(*)::text AS held FROM admin_unit
        WHERE parent_id = $1 AND valid_to IS NULL
        GROUP BY level`,
      [unitId],
    );
    const held = new Map(counts.rows.map((r) => [r.level, Number(r.held)]));
    const coverage = await new PostgresGeographyRepository(this.db).coverageIn(unitId);
    return below.map((l) => {
      const finding = coverage.find((c) => c.level === l);
      return {
        level: l,
        held: held.get(l) ?? 0,
        coverage:
          finding === undefined
            ? null
            : {
                status: finding.status,
                note: finding.note,
                sourceId: finding.sourceId,
                checkedAt: finding.checkedAt,
              },
      };
    });
  }

  /** CAG reports filed under the state by the publisher's own classification. */
  private async auditReports(stateId: number): Promise<Omit<FiledInput, "filedUnder">> {
    const result = await this.db.query<{ held: string; last_at: string | null }>(
      `SELECT count(*)::text AS held, to_json(max(s.retrieved_at)) #>> '{}' AS last_at
         FROM document d
         JOIN source_artifact s ON s.sha256 = d.source_sha256
        WHERE d.admin_unit_id = $1 AND s.source_id = 'cag'`,
      [stateId],
    );
    const row = result.rows[0];
    return { held: Number(row?.held ?? 0), lastAt: row?.last_at ?? null };
  }

  /** Departments of the state with at least one budget line held. */
  private async budgetDepartments(stateId: number): Promise<Omit<FiledInput, "filedUnder">> {
    const result = await this.db.query<{ held: string; last_at: string | null }>(
      `SELECT count(DISTINCT dep.id)::text AS held, to_json(max(s.retrieved_at)) #>> '{}' AS last_at
         FROM department dep
         JOIN department_finance f ON f.department_id = dep.id
         JOIN source_artifact s    ON s.sha256 = f.source_sha256
        WHERE dep.admin_unit_id = $1`,
      [stateId],
    );
    const row = result.rows[0];
    return { held: Number(row?.held ?? 0), lastAt: row?.last_at ?? null };
  }
}
