import "server-only";

// Deep import, deliberately: the package barrel also exports the migration
// runner, which reads the filesystem. A route handler has no business pulling
// that in, and a serverless bundle has no business carrying it.
import { PostgresAdminUnitRepository } from "@lokdarpan/database/repository";
import { PostgresGeographyRepository } from "@lokdarpan/database/geography";
import { PostgresPublishedFactRepository } from "@lokdarpan/database/published-fact";
import { PostgresTenderRepository } from "@lokdarpan/database/tender";
import { readLedger, versionOpenedAt } from "@lokdarpan/database/ledger";
import pg from "pg";

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
let facts: PostgresPublishedFactRepository | undefined;
let geography: PostgresGeographyRepository | undefined;
let tenders: PostgresTenderRepository | undefined;
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

/**
 * Reads only the `published_fact` view, so nothing unreviewed can be served.
 * Shares the isolate's pool: a pool per invocation exhausts a small Postgres.
 */
export function publishedFactRepository(): PostgresPublishedFactRepository {
  facts ??= new PostgresPublishedFactRepository(pool());
  return facts;
}

/**
 * Administrative geography from PostGIS. Shares the isolate's pool for the same
 * reason the others do: a pool per invocation exhausts a small Postgres.
 */
export function geographyRepository(): PostgresGeographyRepository {
  geography ??= new PostgresGeographyRepository(pool());
  return geography;
}

/**
 * Tenders advertised on state e-procurement portals. Shares the isolate's pool
 * for the same reason the others do.
 */
export function tenderRepository(): PostgresTenderRepository {
  tenders ??= new PostgresTenderRepository(pool());
  return tenders;
}

/** Read-side repositories bound to one ledger snapshot. */
export interface LedgerRepositories {
  readonly units: PostgresAdminUnitRepository;
  readonly geography: PostgresGeographyRepository;
  readonly tenders: PostgresTenderRepository;
  readonly facts: PostgresPublishedFactRepository;
}

export interface VersionedResult<T> {
  readonly data: T;
  readonly datasetVersion: number;
  readonly asOf: string | null;
}

/**
 * Run a handler's reads against one consistent ledger state, and report which.
 *
 * Every query inside `read` sees the same snapshot as the version it is
 * reported with, so a load that commits mid-request cannot put rows from one
 * state under the version of another (.docs/adr/053-every-explorer-payload-states-its-dataset-version.md).
 */
export async function inLedger<T>(
  read: (repositories: LedgerRepositories) => Promise<T>,
): Promise<VersionedResult<T>> {
  const { value, ledger } = await readLedger(pool(), (db) =>
    read({
      units: new PostgresAdminUnitRepository({ db }),
      geography: new PostgresGeographyRepository(db),
      tenders: new PostgresTenderRepository(db),
      facts: new PostgresPublishedFactRepository(db),
    }),
  );
  return { data: value, datasetVersion: ledger.datasetVersion, asOf: ledger.asOf };
}

/** When a dataset version was opened, for responses that name one from their rows. */
export function datasetVersionOpenedAt(datasetVersion: number): Promise<string | null> {
  return versionOpenedAt(pool(), datasetVersion);
}
