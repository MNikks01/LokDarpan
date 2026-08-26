/**
 * The administrative hierarchy, as the ledger holds it.
 *
 * Deliberately free of decorators, drivers and framework imports so that both
 * runtimes can share it: the self-hosted Node service wraps these with
 * tsyringe, and the serverless Route Handlers construct them directly.
 * `.docs/adr/014-dependency-injection.md` rules DI out of `apps/web`, and a
 * shared layer that carried `@injectable()` would smuggle it back in.
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

export const ADMIN_UNIT_LEVELS: readonly AdminUnitLevel[] = [
  "country",
  "state",
  "district",
  "sub_district",
  "block",
  "village",
  "urban_local_body",
  "ward",
  "gram_panchayat",
];

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

/** The port. Callers depend on this, never on a database driver. */
export interface AdminUnitRepository {
  findById(id: number): Promise<AdminUnit>;
  listByLevel(level: AdminUnitLevel): Promise<AdminUnit[]>;
  listChildren(parentId: number): Promise<AdminUnit[]>;
}
