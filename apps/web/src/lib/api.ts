import "server-only";

/**
 * The API is called from Server Components only. Nothing here reaches the
 * browser: no API host, no fetch waterfall on the client, and the page ships
 * effectively no JavaScript for its content (.docs/02-architecture/web-architecture.md).
 */
const API_BASE = process.env["API_BASE_URL"] ?? "http://localhost:4319";

export interface Provenance {
  readonly sourceSha256: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly extractionConfidence: number;
  readonly datasetVersion: number;
}

export interface AdminUnit {
  readonly id: number;
  readonly lgdCode: string;
  readonly level: string;
  readonly nameEn: string;
  /** `null` when the source publishes no local-language name. Never a placeholder. */
  readonly nameLocal: string | null;
  readonly parentId: number | null;
  readonly provenance: Provenance;
}

export interface UnitView {
  readonly unit: AdminUnit;
  readonly children: readonly AdminUnit[];
  readonly datasetVersion: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function get(path: string): Promise<{ data: unknown; datasetVersion: number }> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json" },
    // Revalidated by datasetVersion cache tag, never by a timer.
    next: { tags: ["dataset"], revalidate: false },
  });

  if (!response.ok) {
    throw new ApiError(`API returned ${String(response.status)} for ${path}`, response.status);
  }

  const body = (await response.json()) as { data: unknown; meta: { datasetVersion: number } };
  return { data: body.data, datasetVersion: body.meta.datasetVersion };
}

export async function getUnit(id: string): Promise<{ data: UnitView; datasetVersion: number }> {
  const { data, datasetVersion } = await get(`/api/v1/units/${encodeURIComponent(id)}`);
  return { data: data as UnitView, datasetVersion };
}

export async function listUnitsByLevel(
  level: string,
): Promise<{ data: { units: readonly AdminUnit[] }; datasetVersion: number }> {
  const { data, datasetVersion } = await get(`/api/v1/units?level=${encodeURIComponent(level)}`);
  return { data: data as { units: readonly AdminUnit[] }, datasetVersion };
}
