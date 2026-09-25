import "server-only";

/**
 * The API is called from Server Components only. Nothing here reaches the
 * browser: no API host, no fetch waterfall on the client, and the page ships
 * effectively no JavaScript for its content (.docs/02-architecture/web-architecture.md).
 */
/**
 * Empty by default: the API is served by this same deployment's Route Handlers,
 * so a relative fetch stays in-process and needs no origin, no CORS and no
 * second host. Set API_BASE_URL only to point at a separately hosted
 * `services/api` — the self-hosted shape `.docs/adr/011-web-framework.md`
 * requires to remain possible.
 */
const API_BASE = process.env["API_BASE_URL"] ?? "";

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

/**
 * Where a server-side fetch reaches this deployment's own route handlers.
 *
 * A relative URL is not valid in a server-side fetch, so an absolute origin is
 * needed even when the handler lives in this deployment. Not `VERCEL_URL` in
 * production: that names the per-deployment address, which Vercel's deployment
 * protection answers with a redirect to its login, so every page that fetched
 * through it failed with a 500. The production domain is public.
 */
function apiOrigin(): string {
  if (API_BASE !== "") return API_BASE;
  const production = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
  if (process.env["VERCEL_ENV"] === "production" && production !== undefined) {
    return `https://${production}`;
  }
  const deployment = process.env["VERCEL_URL"];
  if (deployment !== undefined) return `https://${deployment}`;
  return `http://localhost:${process.env["PORT"] ?? "3000"}`;
}

/**
 * A preview deployment is protected too, and has no public domain to fall back
 * on. Vercel sets this secret when "Protection Bypass for Automation" is enabled
 * for the project; without it, preview pages that fetch still fail.
 */
function protectionBypass(): Record<string, string> {
  const secret = process.env["VERCEL_AUTOMATION_BYPASS_SECRET"];
  return secret === undefined || secret === "" ? {} : { "x-vercel-protection-bypass": secret };
}

async function get(path: string): Promise<{ data: unknown; datasetVersion: number }> {
  const response = await fetch(`${apiOrigin()}${path}`, {
    headers: { accept: "application/json", ...protectionBypass() },
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

/**
 * Raw read for routes without a named helper. The caller asserts the shape at
 * its own boundary, matching `getUnit` and `listUnitsByLevel`.
 */
export async function getJson(path: string): Promise<{ data: unknown; datasetVersion: number }> {
  return get(path);
}
