import { AppError } from "@lokdarpan/errors";

import {
  ADMIN_UNIT_LEVELS,
  type AdminUnit,
  type AdminUnitLevel,
  type AdminUnitRepository,
} from "./admin-unit";

export interface UnitView {
  readonly unit: AdminUnit;
  readonly children: readonly AdminUnit[];
}

export function parseLevel(raw: string): AdminUnitLevel {
  const level = ADMIN_UNIT_LEVELS.find((l) => l === raw);
  if (level === undefined) {
    throw AppError.badRequest(`Unknown administrative level "${raw}".`);
  }
  return level;
}

/**
 * The newest load any of these units came from, for a caller that cannot read
 * the ledger's watermark. Never older than anything in the payload, so it never
 * claims a vintage the payload does not have.
 *
 * Units read from several loads are served, each carrying its own
 * `provenance.datasetVersion`. This used to be refused as a "mixed" payload,
 * but geography is loaded district by district, so a state's units always span
 * loads: the rule failed every real request. A payload's version is the
 * ledger's watermark (ADR-053); which load a row came from is its provenance.
 */
export function newestDatasetVersion(units: readonly AdminUnit[]): number {
  return units.reduce((newest, u) => Math.max(newest, u.provenance.datasetVersion), 0);
}

export class UnitService {
  constructor(private readonly units: AdminUnitRepository) {}

  async getUnit(rawId: string): Promise<UnitView> {
    if (!/^\d+$/u.test(rawId)) {
      throw AppError.badRequest("A unit id must be a positive integer.");
    }
    const unit = await this.units.findById(Number(rawId));
    const children = await this.units.listChildren(unit.id);
    return { unit, children };
  }

  async listByLevel(rawLevel: string): Promise<{ readonly units: readonly AdminUnit[] }> {
    return { units: await this.units.listByLevel(parseLevel(rawLevel)) };
  }
}
