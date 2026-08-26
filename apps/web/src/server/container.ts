import "server-only";

// Deep import, deliberately: the package barrel also exports the migration
// runner, which reads the filesystem. A route handler has no business pulling
// that in, and a serverless bundle has no business carrying it.
import { PostgresAdminUnitRepository } from "@lokdarpan/database/repository";
import pg from "pg";
import { UnitService } from "@lokdarpan/domain";

/**
 * Composition for the serverless runtime.
 *
 * No DI container: `.docs/adr/014-dependency-injection.md` keeps tsyringe out
 * of `apps/web`, because a module-scoped container in a request-per-isolate
 * runtime becomes shared mutable state across requests. Plain construction is
 * what that ADR asks for, and the classes are decorator-free precisely so this
 * is possible.
 *
 * The repository is memoised per isolate rather than per request: a connection
 * pool built on every invocation would open a new connection each time and
 * exhaust a free-tier Postgres in minutes.
 */
let repository: PostgresAdminUnitRepository | undefined;
let sharedPool: pg.Pool | undefined;

function databaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (url === undefined || url === "") {
    throw new Error("DATABASE_URL is not set.");
  }
  return url;
}

/**
 * One pool per isolate, not per request. A pool built on every invocation opens
 * a new connection each time and exhausts a free-tier Postgres in minutes.
 */
export function pool(): pg.Pool {
  sharedPool ??= new pg.Pool({
    connectionString: databaseUrl(),
    max: 1,
    idleTimeoutMillis: 5_000,
  });
  return sharedPool;
}

export function unitService(): UnitService {
  repository ??= new PostgresAdminUnitRepository({
    connectionString: databaseUrl(),
    runtime: "serverless",
  });
  // Contract violations are counted by the platform's log-derived metrics here:
  // an in-process counter cannot survive an isolate that is frozen between
  // invocations (.docs/adr/018-telemetry-without-identifiers.md, and see
  // .docs/adr/020-vercel-deployment.md for why /metrics is not served).
  return new UnitService(repository, (kind) => {
    process.stdout.write(
      `${JSON.stringify({
        level: "error",
        message: "contract_violation",
        kind,
        service: "web",
        env: process.env["VERCEL_ENV"] ?? "development",
        time: new Date().toISOString(),
      })}\n`,
    );
  });
}
