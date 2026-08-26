import "server-only";

import { AppError, toEnvelope } from "@lokdarpan/errors";
import { randomUUID } from "node:crypto";

/**
 * One response shape for every handler, so the correlation id, the error
 * envelope and the cache policy cannot drift apart between routes.
 */
export async function respond(
  request: Request,
  produce: () => Promise<{ data: unknown; datasetVersion: number }>,
): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  try {
    const { data, datasetVersion } = await produce();
    return Response.json(
      { data, meta: { datasetVersion, asOf: new Date().toISOString() } },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
          "cache-control": "public, max-age=300",
        },
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
      headers: { "x-request-id": requestId, "cache-control": "no-store" },
    });
  }
}

export { AppError };
