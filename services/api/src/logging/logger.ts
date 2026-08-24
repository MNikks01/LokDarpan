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

function redact(context: LogContext): Record<string, LogValue> {
  const out: Record<string, LogValue> = {};
  for (const [k, v] of Object.entries(context)) {
    out[k] = REDACTED.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return out;
}

export class StructuredLogger implements Logger {
  constructor(
    private readonly minLevel: LogLevel,
    private readonly base: LogContext = {},
    private readonly sink: (line: string) => void = (l) => process.stdout.write(l + "\n"),
  ) {}

  static fromConfig(config: Config): StructuredLogger {
    return new StructuredLogger(config.logLevel, { env: config.nodeEnv });
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
        message,
        time: new Date().toISOString(),
        ...redact(this.base),
        ...(context ? redact(context) : {}),
      }),
    );
  }
}
