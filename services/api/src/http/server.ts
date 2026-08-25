import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { DependencyContainer } from "tsyringe";
import { CONFIG, type Config } from "../config/index.js";
import { LOGGER, type Logger } from "../logging/logger.js";
import { toEnvelope, AppError } from "../errors/index.js";
import { UnitService } from "../modules/units/unit.service.js";
import { METRICS, routePattern, type MetricsRegistry } from "@lokdarpan/observability";
import { ProjectService } from "../modules/projects/project.service.js";

/**
 * A plain node:http server. No framework: the surface is a handful of read-only
 * routes, and Express/Fastify would be a dependency without a job today.
 * Revisit when routing, middleware ordering, or body parsing become real needs.
 */
export function createApiServer(container: DependencyContainer): Server {
  const config = container.resolve<Config>(CONFIG);
  const logger = container.resolve<Logger>(LOGGER);
  const metrics = container.resolve<MetricsRegistry>(METRICS);

  return createServer((req: IncomingMessage, res: ServerResponse) => {
    // Correlation id: client-supplied if present, else minted. Echoed on every
    // response so a user report maps to a log line with no user identity.
    const requestId = req.headers["x-request-id"]?.toString() ?? randomUUID();
    const log = logger.child({ requestId, method: req.method ?? "GET" });
    const started = Date.now();

    // The route *pattern*, never the path: `/api/v1/units/:id`, not
    // `/api/v1/units/20`. Recording which unit was viewed would rebuild the
    // dataset .docs/13-observability/observability.md refuses to create.
    const route = routePattern(new URL(req.url ?? "/", "http://localhost").pathname);

    const send = (status: number, body: unknown): void => {
      const elapsed = Date.now() - started;

      // Prometheus scrapes text, not JSON.
      const asMetrics =
        typeof body === "object" && body !== null && "metrics" in body
          ? (body as { metrics: string }).metrics
          : null;

      res.writeHead(status, {
        "content-type":
          asMetrics === null ? "application/json; charset=utf-8" : "text/plain; version=0.0.4",
        "x-request-id": requestId,
        // Metrics are a point-in-time reading; caching one would serve a stale
        // count to the next scrape.
        "cache-control": asMetrics !== null || status !== 200 ? "no-store" : "public, max-age=300",
      });
      res.end(asMetrics ?? JSON.stringify(body));

      metrics.recordRequest(route, status, elapsed);
      // The correlated log keeps the exact duration: it is keyed by request id,
      // which identifies a request and never a person. Only the aggregate,
      // exportable series is bucketed.
      log.info("request.completed", { status, route, ms: elapsed });
    };

    const fail = (err: unknown): void => {
      const { status, body, internal } = toEnvelope(err, requestId);
      // Internal detail goes to the log, never to the client.
      if (status >= 500) log.error("request.failed", { status, internal });
      else log.info("request.rejected", { status, code: body.error.code });
      send(status, body);
    };

    void handle(req, container, config).then((body) => {
      send(200, body);
    }, fail);
  });
}

async function handle(
  req: IncomingMessage,
  container: DependencyContainer,
  config: Config,
): Promise<unknown> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (req.method !== "GET") throw AppError.badRequest("Only GET is supported.");

  // Liveness: is the process up. Readiness: can it serve traffic.
  if (path === "/livez") return { status: "ok" };
  if (path === "/readyz") {
    return { status: "ok", datasetVersion: config.datasetVersion };
  }

  const project = /^\/api\/v1\/projects\/([^/]+)$/.exec(path);
  if (project?.[1] !== undefined) {
    const data = await container.resolve(ProjectService).getProject(project[1]);
    return {
      data,
      meta: { datasetVersion: config.datasetVersion, asOf: new Date().toISOString() },
    };
  }

  // Plain text, not JSON: Prometheus scrapes this format. It carries no
  // identifier, no query text and no timestamp finer than the scrape itself.
  if (path === "/metrics") {
    return { metrics: container.resolve<MetricsRegistry>(METRICS).render() };
  }

  const unit = /^\/api\/v1\/units\/([^/]+)$/u.exec(path);
  if (unit?.[1] !== undefined) {
    const data = await container.resolve(UnitService).getUnit(unit[1]);
    // The dataset version comes from the data, not from configuration: the
    // envelope must state the vintage of what it actually contains.
    return {
      data,
      meta: { datasetVersion: data.datasetVersion, asOf: new Date().toISOString() },
    };
  }

  if (path === "/api/v1/units") {
    const level = url.searchParams.get("level");
    if (level === null) throw AppError.badRequest("A level is required, e.g. ?level=state.");
    const data = await container.resolve(UnitService).listByLevel(level);
    return {
      data,
      meta: { datasetVersion: data.datasetVersion, asOf: new Date().toISOString() },
    };
  }

  throw AppError.notFound("This route");
}
