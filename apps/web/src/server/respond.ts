import "server-only";

import { AppError, toEnvelope } from "@lokdarpan/errors";
import { randomUUID } from "node:crypto";
import { datasetVersionOpenedAt } from "./container";

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
): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  try {
    const produced = await produce();
    const { data, datasetVersion } = produced;
    const asOf = await asOfFor(produced);
    return Response.json(
      { data, meta: { datasetVersion, asOf } },
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
