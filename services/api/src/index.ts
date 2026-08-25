import "reflect-metadata";
import { buildContainer } from "./container/index.js";
import { createApiServer } from "./http/server.js";
import { CONFIG, ConfigError, type Config } from "./config/index.js";
import { scrubSecrets } from "@lokdarpan/observability";

import { LOGGER, type Logger } from "./logging/logger.js";
import {
  ADMIN_UNIT_REPOSITORY,
  type PostgresAdminUnitRepository,
} from "./modules/units/unit.repository.js";

async function main(): Promise<void> {
  let container;
  try {
    container = buildContainer();
  } catch (err) {
    // Fail fast and loudly: a misconfigured process must not start.
    if (err instanceof ConfigError) {
      // Scrubbed even here: this runs before the logger exists, and a
      // validation message naming a malformed DATABASE_URL would otherwise
      // print the credential to stderr — which the platform also ships.
      process.stderr.write(`${scrubSecrets(err.message)}\n`);
      process.exit(78); // EX_CONFIG
    }
    throw err;
  }

  const config = container.resolve<Config>(CONFIG);
  const logger = container.resolve<Logger>(LOGGER);
  // Before accepting a single request, prove this process cannot write to the
  // ledger. A misconfiguration here is a failed start, not a running service
  // holding unnoticed write access to the canonical record.
  if (config.databaseUrl !== undefined) {
    try {
      await container.resolve<PostgresAdminUnitRepository>(ADMIN_UNIT_REPOSITORY).assertReadOnly();
    } catch (err) {
      logger.error("db.readonly_check_failed", {
        reason: err instanceof Error ? err.message : String(err),
      });
      process.exit(78); // EX_CONFIG
    }
  }

  const server = createApiServer(container);

  server.listen(config.port, () => {
    logger.info("server.started", { port: config.port });
  });

  // Graceful shutdown: stop accepting, drain in-flight, then exit.
  const shutdown = (signal: string): void => {
    logger.info("server.shutdown_requested", { signal });
    server.close(() => {
      logger.info("server.stopped");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("server.shutdown_forced");
      process.exit(1);
    }, 10_000).unref();
  };
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
}

void main();
