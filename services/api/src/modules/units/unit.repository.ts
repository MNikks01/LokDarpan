import pg from "pg";
import { inject, injectable } from "tsyringe";

import { CONFIG, type Config } from "../../config/index.js";
import { AppError } from "../../errors/index.js";
import { LOGGER, type Logger } from "../../logging/logger.js";

/**
 * Provenance travels with the fact, never beside it. A unit that cannot name
 * the artefact its values came from is not returned.
 */
export interface Provenance {
  readonly sourceSha256: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly extractionConfidence: number;
  readonly datasetVersion: number;
}

export type AdminUnitLevel =
  | "country"
  | "state"
  | "district"
  | "sub_district"
  | "block"
  | "village"
  | "urban_local_body"
  | "ward"
  | "gram_panchayat";

export interface AdminUnit {
  readonly id: number;
  readonly lgdCode: string;
  readonly level: AdminUnitLevel;
  readonly nameEn: string;
  /** `null` when the source publishes no local-language name. Never a placeholder. */
  readonly nameLocal: string | null;
  readonly parentId: number | null;
  readonly provenance: Provenance;
}

/** The port. Callers depend on this, never on a driver. */
export interface AdminUnitRepository {
  findById(id: number): Promise<AdminUnit>;
  listByLevel(level: AdminUnitLevel): Promise<AdminUnit[]>;
  listChildren(parentId: number): Promise<AdminUnit[]>;
}

export const ADMIN_UNIT_REPOSITORY = Symbol.for("AdminUnitRepository");

interface UnitRow {
  readonly id: string;
  readonly lgd_code: string;
  readonly level: AdminUnitLevel;
  readonly name_en: string;
  readonly name_local: string | null;
  readonly parent_id: string | null;
  readonly source_sha256: string;
  readonly source_url: string;
  readonly retrieved_at: Date;
  readonly extraction_confidence: string;
  readonly dataset_version_id: string;
}

const SELECT = `
  SELECT a.id, a.lgd_code, a.level, a.name_en, a.name_local, a.parent_id,
         a.source_sha256, a.extraction_confidence, a.dataset_version_id,
         s.source_url, s.retrieved_at
    FROM admin_unit a
    JOIN source_artifact s ON s.sha256 = a.source_sha256
`;

function toUnit(row: UnitRow): AdminUnit {
  return {
    id: Number(row.id),
    lgdCode: row.lgd_code,
    level: row.level,
    nameEn: row.name_en,
    nameLocal: row.name_local,
    parentId: row.parent_id === null ? null : Number(row.parent_id),
    provenance: {
      sourceSha256: row.source_sha256,
      sourceUrl: row.source_url,
      retrievedAt: row.retrieved_at.toISOString(),
      extractionConfidence: Number(row.extraction_confidence),
      datasetVersion: Number(row.dataset_version_id),
    },
  };
}

/**
 * Postgres adapter. The API's database role is read-only — ETL is the only
 * write path to the ledger — so this class contains no statement that writes.
 */
@injectable()
export class PostgresAdminUnitRepository implements AdminUnitRepository {
  private readonly pool: pg.Pool;

  constructor(
    @inject(CONFIG) config: Config,
    @inject(LOGGER) private readonly logger: Logger,
  ) {
    if (config.databaseUrl === undefined) {
      throw new Error("DATABASE_URL is required to serve administrative units.");
    }
    this.pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
  }

  async findById(id: number): Promise<AdminUnit> {
    const result = await this.pool.query<UnitRow>(`${SELECT} WHERE a.id = $1`, [id]);
    const row = result.rows[0];
    if (row === undefined) {
      this.logger.info("unit.not_found", { unitId: id });
      throw AppError.notFound("This administrative unit");
    }
    return toUnit(row);
  }

  async listByLevel(level: AdminUnitLevel): Promise<AdminUnit[]> {
    const result = await this.pool.query<UnitRow>(
      `${SELECT} WHERE a.level = $1 ORDER BY a.name_en`,
      [level],
    );
    return result.rows.map(toUnit);
  }

  async listChildren(parentId: number): Promise<AdminUnit[]> {
    const result = await this.pool.query<UnitRow>(
      `${SELECT} WHERE a.parent_id = $1 ORDER BY a.name_en`,
      [parentId],
    );
    return result.rows.map(toUnit);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
