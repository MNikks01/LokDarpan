import { scrubValue } from "@lokdarpan/observability";

import type { Config } from "../config/index.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Values safe to serialise into a log line. No `any`. */
export type LogValue = string | number | boolean | null | undefined;
export type LogContext = Readonly<Record<string, LogValue>>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** A child logger carrying correlation fields on every line. */
  child(context: LogContext): Logger;
}

export const LOGGER = Symbol.for("Logger");

const ORDER: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Keys never written to a log, at any level. Observability must not become an
 * exfiltration path (.docs/13-observability/observability.md).
 */
const REDACTED = new Set([
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "query",
  "q",
  "question",
  "lat",
  "lon",
  "latitude",
  "longitude",
  "email",
]);

/**
 * Two passes, because they catch different failures.
 *
 * Redacting by key name protects a value someone deliberately put under a known
 * key. It does nothing for an error message that happens to contain a
 * connection string because the driver put it there — and that is the line an
 * exception handler writes, not one anybody chose. Scrubbing the value catches
 * the second case.
 */
function redact(context: LogContext): Record<string, LogValue> {
  const out: Record<string, LogValue> = {};
  for (const [k, v] of Object.entries(context)) {
    out[k] = REDACTED.has(k.toLowerCase()) ? "[redacted]" : scrubValue(v);
  }
  return out;
}

export class StructuredLogger implements Logger {
  constructor(
    private readonly minLevel: LogLevel,
    private readonly base: LogContext = {},
    private readonly sink: (line: string) => void = (l) => process.stdout.write(l + "\n"),
  ) {}

  /**
   * Identity fields a log shipper needs to route and filter without parsing the
   * message: which service, which build, which environment.
   */
  static fromConfig(config: Config): StructuredLogger {
    return new StructuredLogger(config.logLevel, {
      service: "api",
      version: config.serviceVersion,
      env: config.nodeEnv,
    });
  }

  child(context: LogContext): Logger {
    return new StructuredLogger(this.minLevel, { ...this.base, ...context }, this.sink);
  }

  debug(m: string, c?: LogContext): void {
    this.write("debug", m, c);
  }
  info(m: string, c?: LogContext): void {
    this.write("info", m, c);
  }
  warn(m: string, c?: LogContext): void {
    this.write("warn", m, c);
  }
  error(m: string, c?: LogContext): void {
    this.write("error", m, c);
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    if (ORDER[level] < ORDER[this.minLevel]) return;
    this.sink(
      JSON.stringify({
        level,
        // The message is a stable event key, never interpolated free text, so
        // it is safe to index and group on. Detail belongs in the context.
        message: scrubValue(message),
        time: new Date().toISOString(),
        ...redact(this.base),
        ...(context ? redact(context) : {}),
      }),
    );
  }
}
