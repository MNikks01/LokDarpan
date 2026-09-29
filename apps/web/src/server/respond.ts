import "server-only";

import { AppError, toEnvelope } from "@lokdarpan/errors";
import { randomUUID } from "node:crypto";
import { datasetVersionOpenedAt } from "./container";
import { RETRY_AFTER_SECONDS, originLimited } from "./rate-limit";

export interface Produced {
  readonly data: unknown;
  readonly datasetVersion: number;
  /**
   * When `datasetVersion` was opened. Omitted by handlers whose version comes
   * from their rows, and looked up here. Never the time of the response: that
   * described the request, and read as a statement about the data.
   */
  readonly asOf?: string | null;
}

/**
 * How long a successful answer may be reused, and by whom.
 *
 * `Cache-Control` alone reaches only the reader's browser: Vercel's CDN does not
 * cache a function's response on `max-age`, only on `s-maxage` or its own
 * header. Until 30 September 2026 every first request for a unit went to the
 * database, and on Neon's free plan each one spent metered transfer — the
 * allowance the builds exhausted on 29 September, taking the site down.
 *
 * - An hour at the CDN. The ledger changes by nightly load, and every payload
 *   states its `datasetVersion` and `asOf`, so a cached answer says exactly how
 *   old it is. A publication switch (`publishable.ts`) takes up to an hour to
 *   show for the same reason.
 * - `stale-while-revalidate`: past the hour, the next reader gets the cached
 *   answer at once while the CDN refreshes it.
 * - `stale-if-error`: if the database refuses — a quota, an outage — readers
 *   get the last good answer, still stamped with its version, for up to a week,
 *   rather than an error for something already known.
 *
 * Errors are never cached: see `no-store` below.
 */
export const SUCCESS_CACHE: Readonly<Record<string, string>> = {
  "cache-control": "public, max-age=300",
  "vercel-cdn-cache-control": "max-age=3600, stale-while-revalidate=86400, stale-if-error=604800",
};

async function asOfFor(produced: Produced): Promise<string | null> {
  if (produced.asOf !== undefined) return produced.asOf;
  return produced.datasetVersion > 0 ? datasetVersionOpenedAt(produced.datasetVersion) : null;
}

/**
 * One response shape for every handler, so the correlation id, the error
 * envelope and the cache policy cannot drift apart between routes.
 */
export async function respond(
  request: Request,
  produce: () => Promise<Produced>,
  limited: (request: Request) => Promise<boolean> = originLimited,
): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  try {
    // Before the database is touched: the limit exists to spare it (rate-limit.ts).
    if (await limited(request)) {
      throw new AppError("RATE_LIMITED", "Too many requests. Please try again in a minute.");
    }
    const produced = await produce();
    const { data, datasetVersion } = produced;
    const asOf = await asOfFor(produced);
    return Response.json(
      { data, meta: { datasetVersion, asOf } },
      {
        status: 200,
        headers: { "x-request-id": requestId, ...SUCCESS_CACHE },
      },
    );
  } catch (error) {
    const { status, body, internal } = toEnvelope(error, requestId);
    // Internal detail to the log, never to the client. Vercel captures stdout.
    process.stdout.write(
      `${JSON.stringify({
        level: status >= 500 ? "error" : "info",
        message: status >= 500 ? "request.failed" : "request.rejected",
        status,
        requestId,
        code: body.error.code,
        ...(status >= 500 ? { internal } : {}),
        time: new Date().toISOString(),
      })}\n`,
    );
    return Response.json(body, {
      status,
      headers: {
        "x-request-id": requestId,
        "cache-control": "no-store",
        ...(status === 429 ? { "retry-after": String(RETRY_AFTER_SECONDS) } : {}),
      },
    });
  }
}

export { AppError };
