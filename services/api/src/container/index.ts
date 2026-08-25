import { container as rootContainer, type DependencyContainer } from "tsyringe";
import { CONFIG, loadConfig, type Config } from "../config/index.js";
import { LOGGER, StructuredLogger, type Logger } from "../logging/logger.js";
import {
  PROJECT_REPOSITORY,
  InMemoryProjectRepository,
} from "../modules/projects/project.repository.js";
import { ProjectService } from "../modules/projects/project.service.js";
import {
  ADMIN_UNIT_REPOSITORY,
  PostgresAdminUnitRepository,
} from "../modules/units/unit.repository.js";
import { UnitService } from "../modules/units/unit.service.js";
import { METRICS, MetricsRegistry } from "@lokdarpan/observability";

/**
 * Composition root — the single place that knows which concrete implementation
 * satisfies each port. Nothing else imports a concrete adapter.
 *
 * Returns a child container so tests can build an isolated graph and override
 * a single registration without global state leaking between test files.
 */
export function buildContainer(config: Config = loadConfig()): DependencyContainer {
  const c = rootContainer.createChildContainer();
  c.registerInstance<Config>(CONFIG, config);
  c.registerInstance<Logger>(LOGGER, StructuredLogger.fromConfig(config));
  c.register(PROJECT_REPOSITORY, { useClass: InMemoryProjectRepository });
  c.register(ProjectService, { useClass: ProjectService });
  // Units are served from Postgres. The one-line swap the port existed for.
  c.register(ADMIN_UNIT_REPOSITORY, { useClass: PostgresAdminUnitRepository });
  c.register(UnitService, { useClass: UnitService });
  c.registerInstance<MetricsRegistry>(METRICS, new MetricsRegistry());
  return c;
}
