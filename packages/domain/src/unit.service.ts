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
  /** The single dataset version every fact in this payload came from. */
  readonly datasetVersion: number;
}

export function parseLevel(raw: string): AdminUnitLevel {
  const level = ADMIN_UNIT_LEVELS.find((l) => l === raw);
  if (level === undefined) {
    throw AppError.badRequest(`Unknown administrative level "${raw}".`);
  }
  return level;
}

/**
 * One payload carries one `datasetVersion`.
 *
 * If a unit and its children came from different ingests, two figures on the
 * same page would carry different provenance vintages while appearing equally
 * current. That is a traceability defect, so it is refused rather than served
 * with a caveat (.docs/adr/012-web-api-strategy.md).
 */
export function singleDatasetVersion(
  units: readonly AdminUnit[],
  onViolation?: () => void,
): number {
  const versions = new Set(units.map((u) => u.provenance.datasetVersion));
  if (versions.size > 1) {
    // An integrity alarm, not a usage number
    // (.docs/13-observability/observability.md §Guardrail telemetry).
    onViolation?.();
    throw AppError.internal(
      "This response could not be assembled from a single dataset version.",
      `Payload mixes dataset versions ${[...versions].sort((a, b) => a - b).join(", ")}.`,
    );
  }
  const [only] = versions;
  if (only === undefined) {
    throw AppError.internal(
      "This response could not be assembled from a single dataset version.",
      "Empty payload has no dataset version.",
    );
  }
  return only;
}

/** Raised when a payload mixes provenance vintages, for the caller to count. */
export type ViolationSink = (kind: "mixed_dataset_version") => void;

export class UnitService {
  constructor(
    private readonly units: AdminUnitRepository,
    private readonly onViolation: ViolationSink = () => undefined,
  ) {}

  private readonly mixed = (): void => {
    this.onViolation("mixed_dataset_version");
  };

  async getUnit(rawId: string): Promise<UnitView> {
    if (!/^\d+$/u.test(rawId)) {
      throw AppError.badRequest("A unit id must be a positive integer.");
    }
    const unit = await this.units.findById(Number(rawId));
    const children = await this.units.listChildren(unit.id);
    return {
      unit,
      children,
      datasetVersion: singleDatasetVersion([unit, ...children], this.mixed),
    };
  }

  async listByLevel(rawLevel: string): Promise<{
    readonly units: readonly AdminUnit[];
    readonly datasetVersion: number;
  }> {
    const units = await this.units.listByLevel(parseLevel(rawLevel));
    return { units, datasetVersion: singleDatasetVersion(units, this.mixed) };
  }
}
