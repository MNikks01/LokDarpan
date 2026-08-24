import "reflect-metadata";
import { buildContainer } from "./container/index.js";
import { createApiServer } from "./http/server.js";
import { CONFIG, ConfigError, type Config } from "./config/index.js";
import { LOGGER, type Logger } from "./logging/logger.js";

function main(): void {
  let container;
  try {
    container = buildContainer();
  } catch (err) {
    // Fail fast and loudly: a misconfigured process must not start.
    if (err instanceof ConfigError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(78); // EX_CONFIG
    }
    throw err;
  }

  const config = container.resolve<Config>(CONFIG);
  const logger = container.resolve<Logger>(LOGGER);
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

main();
