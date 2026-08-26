/**
 * A closed error model. Callers switch on `code`; nothing leaks an internal
 * message or a stack trace to a client (.docs/12-security/security.md).
 */
export const ERROR_CODES = [
  "BAD_REQUEST",
  "NOT_FOUND",
  "RATE_LIMITED",
  "CURSOR_STALE",
  "UPGRADE_REQUIRED",
  "DATASET_REBUILDING",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS: Readonly<Record<ErrorCode, number>> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  CURSOR_STALE: 409,
  UPGRADE_REQUIRED: 426,
  DATASET_REBUILDING: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  public override readonly name = "AppError";
  public readonly code: ErrorCode;
  public readonly status: number;
  /** Safe to show a client. Never contains internals. */
  public readonly publicMessage: string;

  constructor(code: ErrorCode, publicMessage: string, options?: { cause?: unknown }) {
    super(publicMessage, options);
    this.code = code;
    this.status = STATUS[code];
    this.publicMessage = publicMessage;
  }

  static notFound(what: string): AppError {
    return new AppError("NOT_FOUND", `${what} is not in the published dataset.`);
  }
  static badRequest(why: string): AppError {
    return new AppError("BAD_REQUEST", why);
  }
  /**
   * `publicMessage` must stay free of internals; put the diagnostic detail in
   * `cause`, which reaches the log and never the response.
   */
  static internal(publicMessage: string, cause?: unknown): AppError {
    return new AppError("INTERNAL", publicMessage, { cause });
  }
}

export interface ErrorEnvelope {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly requestId: string;
  };
}

/**
 * Convert anything thrown into a client-safe envelope.
 * An unrecognised throwable becomes INTERNAL with a generic message — the real
 * detail goes to the log, keyed by requestId, never to the response.
 */
export function toEnvelope(
  err: unknown,
  requestId: string,
): {
  status: number;
  body: ErrorEnvelope;
  internal: string;
} {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.publicMessage, requestId } },
      internal: err.message,
    };
  }
  const internal = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL",
        message: "Something went wrong. It is not your connection.",
        requestId,
      },
    },
    internal,
  };
}
