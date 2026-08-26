import { PostgresAdminUnitRepository } from "@lokdarpan/database";
import { UnitService, type AdminUnitRepository } from "@lokdarpan/domain";
import { METRICS, type MetricsRegistry } from "@lokdarpan/observability";
import type { DependencyContainer } from "tsyringe";

import { CONFIG, type Config } from "../../config/index.js";
import { LOGGER, type Logger } from "../../logging/logger.js";

export const ADMIN_UNIT_REPOSITORY = Symbol.for("AdminUnitRepository");
export const UNIT_SERVICE = Symbol.for("UnitService");

/**
 * The DI seam, and the only place tsyringe meets the shared layer.
 *
 * `UnitService` and the Postgres adapter carry no decorators — they are plain
 * classes in `@lokdarpan/domain` and `@lokdarpan/database` so the serverless
 * Route Handlers can construct them directly
 * (`.docs/adr/014-dependency-injection.md` keeps DI out of `apps/web`).
 * Factories bridge the two without either side knowing about the other.
 */
export function registerUnits(container: DependencyContainer): void {
  container.register<PostgresAdminUnitRepository>(ADMIN_UNIT_REPOSITORY, {
    useFactory: (c) => {
      const config = c.resolve<Config>(CONFIG);
      const logger = c.resolve<Logger>(LOGGER);
      if (config.databaseUrl === undefined) {
        throw new Error("DATABASE_URL is required to serve administrative units.");
      }
      return new PostgresAdminUnitRepository({
        connectionString: config.databaseUrl,
        runtime: "server",
        onNotFound: (id) => {
          logger.info("unit.not_found", { unitId: id });
        },
      });
    },
  });

  container.register<UnitService>(UNIT_SERVICE, {
    useFactory: (c) =>
      new UnitService(c.resolve<AdminUnitRepository>(ADMIN_UNIT_REPOSITORY), (kind) => {
        c.resolve<MetricsRegistry>(METRICS).recordContractViolation(kind);
      }),
  });
}
