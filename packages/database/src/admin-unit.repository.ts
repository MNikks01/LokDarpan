import type { AdminUnit, AdminUnitLevel, AdminUnitRepository, Provenance } from "@lokdarpan/domain";
import { AppError } from "@lokdarpan/errors";
import pg from "pg";

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
  const provenance: Provenance = {
    sourceSha256: row.source_sha256,
    sourceUrl: row.source_url,
    retrievedAt: row.retrieved_at.toISOString(),
    extractionConfidence: Number(row.extraction_confidence),
    datasetVersion: Number(row.dataset_version_id),
  };
  return {
    id: Number(row.id),
    lgdCode: row.lgd_code,
    level: row.level,
    nameEn: row.name_en,
    nameLocal: row.name_local,
    parentId: row.parent_id === null ? null : Number(row.parent_id),
    provenance,
  };
}

/**
 * Pool size differs by runtime, and getting it wrong is how a serverless
 * deployment exhausts a database.
 *
 * A long-lived server multiplexes many requests over a few connections. A
 * serverless invocation is one request; several may run concurrently, each in
 * its own isolate with its own pool. Ten connections per isolate against a free
 * Postgres tier's connection cap is an outage, so serverless keeps one and
 * relies on the provider's pooled endpoint to fan in.
 */
export interface RepositoryOptions {
  readonly connectionString: string;
  /** `"serverless"` caps the pool at one connection per isolate. */
  readonly runtime?: "server" | "serverless";
  readonly onNotFound?: (id: number) => void;
}

export class PostgresAdminUnitRepository implements AdminUnitRepository {
  private readonly pool: pg.Pool;
  private readonly onNotFound: (id: number) => void;

  constructor(options: RepositoryOptions) {
    this.pool = new pg.Pool({
      connectionString: options.connectionString,
      max: options.runtime === "serverless" ? 1 : 10,
      // A serverless isolate is frozen between invocations; a connection held
      // open across that gap is usually dead by the next one.
      idleTimeoutMillis: options.runtime === "serverless" ? 5_000 : 30_000,
    });
    this.onNotFound = options.onNotFound ?? ((): void => undefined);
  }

  async findById(id: number): Promise<AdminUnit> {
    const result = await this.pool.query<UnitRow>(`${SELECT} WHERE a.id = $1`, [id]);
    const row = result.rows[0];
    if (row === undefined) {
      this.onNotFound(id);
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

  /**
   * Refuses to serve from credentials that can write to the ledger.
   *
   * Migration 0002 makes the database enforce read-only, but nothing stops an
   * operator handing this a connection string for the owner. Checking turns
   * that misconfiguration into a visible failure rather than a service quietly
   * holding write access to the canonical record.
   */
  async assertReadOnly(): Promise<void> {
    const result = await this.pool.query<{ writable: boolean }>(
      `SELECT bool_or(p) AS writable FROM (
         SELECT has_table_privilege(current_user, 'admin_unit', 'INSERT') AS p
         UNION ALL SELECT has_table_privilege(current_user, 'admin_unit', 'UPDATE')
         UNION ALL SELECT has_table_privilege(current_user, 'admin_unit', 'DELETE')
         UNION ALL SELECT has_table_privilege(current_user, 'source_artifact', 'INSERT')
       ) AS checks`,
    );
    if (result.rows[0]?.writable === true) {
      throw new Error(
        "The API's database user can write to the ledger. ETL is the only write path; " +
          "point DATABASE_URL at a user granted lokdarpan_readonly (see migration 0002).",
      );
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
