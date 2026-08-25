import { z } from "zod";

/**
 * Configuration is validated once, at startup, and the process refuses to
 * start if it is invalid. A service that boots with a missing DATABASE_URL and
 * fails on the first request is harder to diagnose than one that never boots.
 */
const ConfigSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]),
  // 0 is valid and means "bind an ephemeral port" — used by tests and by
  // socket-activated deployments. Rejecting it would be wrong, not strict.
  port: z.coerce.number().int().min(0).max(65535),
  logLevel: z.enum(["debug", "info", "warn", "error"]),
  /** Build identifier, echoed on every log line so a line maps to a deploy. */
  serviceVersion: z.string().min(1),
  databaseUrl: z.string().url().optional(),
  /** Dataset version pinning; surfaced on every response for reproducibility. */
  datasetVersion: z.coerce.number().int().nonnegative(),
});

export type Config = Readonly<z.infer<typeof ConfigSchema>>;

export class ConfigError extends Error {
  public override readonly name = "ConfigError";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse({
    nodeEnv: env["NODE_ENV"] ?? "development",
    port: env["PORT"] ?? 4000,
    logLevel: env["LOG_LEVEL"] ?? "info",
    serviceVersion: env["SERVICE_VERSION"] ?? "dev",
    databaseUrl: env["DATABASE_URL"],
    datasetVersion: env["DATASET_VERSION"] ?? 0,
  });

  if (!parsed.success) {
    // Report every problem at once — fixing one variable at a time is miserable.
    const detail = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Invalid configuration:\n${detail}`);
  }
  return Object.freeze(parsed.data);
}

/** DI token — Config is an interface, so it needs an explicit token. */
export const CONFIG = Symbol.for("Config");
