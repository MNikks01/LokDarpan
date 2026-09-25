import type { ReadableStreamDefaultReader } from "node:stream/web";

/**
 * Bounded HTTP for collectors.
 *
 * WHY THIS EXISTS
 * Every collector used to read a response whole — `arrayBuffer()` or `text()` —
 * with no ceiling on its size and no deadline on its arrival. A government host
 * that streams an endless body, trickles a byte a minute, or answers with a
 * multi-gigabyte error page would exhaust the scheduled sweep's memory or hold
 * it open until the runner is killed, and a killed runner writes no account of
 * why. `.docs/adr/052-a-download-that-does-not-finish-is-not-an-artifact.md`.
 *
 * WHAT IT GUARANTEES
 * - A body is never larger than `maxBytes`. The count is of DECODED bytes: Node's
 *   `fetch` undoes gzip and brotli before the stream yields, so a small compressed
 *   response that expands enormously is caught by the running count even though
 *   its `content-length` looked harmless.
 * - A response that has not started arriving within `headersTimeoutMs`, that
 *   goes silent between chunks for `idleTimeoutMs`, or that is still going after
 *   `totalTimeoutMs`, is abandoned.
 * - The caller can refuse a response from its status and headers BEFORE the
 *   body is read, so an HTML error page is not downloaded to discover that it is
 *   not the PDF that was asked for.
 *
 * - A redirect is followed only within the host that was asked for (`www.` or
 *   not), never from https down to http, and at most `MAX_REDIRECTS` times. A
 *   collector that asked a government host for a document has no business
 *   accepting one from somewhere else.
 * - With a `retry` policy, a failure that may pass — no connection, no answer in
 *   time, 429, 502, 503, 504 — is tried again after a pause. A limit reached
 *   mid-body, a 4xx or any other 5xx is not: it would fail the same way again.
 *
 * There is no partial result. A body that did not complete is a failure, and is
 * never handed to a parser or the raw store.
 */

export interface FetchLimits {
  /** Largest decoded body accepted, in bytes. */
  readonly maxBytes: number;
  /** Time allowed until the status line and headers arrive. */
  readonly headersTimeoutMs: number;
  /** Longest silence allowed between body chunks. */
  readonly idleTimeoutMs: number;
  /** Time allowed for the whole exchange, headers and body together. */
  readonly totalTimeoutMs: number;
}

export type LimitKind = "bytes" | "headers-timeout" | "idle-timeout" | "total-timeout";

/**
 * A limit was reached. Named separately from a network error because the two
 * mean different things to whoever reads the run log: a network error may pass
 * on retry, an oversized body will be oversized again.
 *
 * The reason leads the message and the URL follows, because run summaries keep
 * only the first line's opening characters (the GePNIC sweep keeps seventy), and
 * a truncated URL says nothing about which limit was reached.
 */
export class FetchLimitExceeded extends Error {
  constructor(
    readonly url: string,
    readonly limit: LimitKind,
    detail: string,
  ) {
    super(`${detail} (${url})`);
    this.name = "FetchLimitExceeded";
  }
}

export interface HttpInit {
  readonly headers: Record<string, string>;
  readonly method?: string;
  readonly body?: string;
  readonly signal?: AbortSignal;
  /** Always `manual` from here: redirects are followed by `fetchWithLimits`, under its own rules. */
  readonly redirect?: "manual";
}

/** A response refused for where it came from, not for its size or timing. */
export class FetchRefused extends Error {
  constructor(
    readonly url: string,
    reason: string,
  ) {
    super(`${reason} (${url})`);
    this.name = "FetchRefused";
  }
}

export interface RetryPolicy {
  /** Tries in total, the first included. */
  readonly attempts: number;
  /** Pause before each retry; the last value repeats if there are more retries than values. */
  readonly backoffMs: readonly number[];
  /** A server's `Retry-After` is honoured up to this, never longer. */
  readonly maxRetryAfterMs: number;
}

/**
 * Three tries, two and then eight seconds apart: long enough for a portal's
 * momentary refusal to pass, short enough that a sweep of twenty-one portals
 * still ends inside its job timeout if several are down.
 */
export const RETRY_IDEMPOTENT: RetryPolicy = {
  attempts: 3,
  backoffMs: [2_000, 8_000],
  maxRetryAfterMs: 60_000,
};

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const RETRY_STATUSES = new Set([429, 502, 503, 504]);

/** The shape of `fetch` the collectors use, so tests can stand in for it. */
export type Http = (url: string, init: HttpInit) => Promise<Response>;

export interface BoundedResponse {
  readonly url: string;
  readonly status: number;
  readonly headers: Headers;
  readonly body: Buffer;
}

export interface BoundedRequest {
  readonly url: string;
  readonly init: HttpInit;
  readonly limits: FetchLimits;
  readonly http?: Http;
  /**
   * Inspect status and headers before the body is read. Throw to refuse the
   * response; its body is then cancelled rather than downloaded.
   */
  readonly accept?: (response: Response) => void;
  /**
   * Try again after a failure that may pass. Applied to GET and HEAD only: a
   * POST repeated after a lost response may have taken effect the first time.
   */
  readonly retry?: RetryPolicy;
  /** How pauses are taken; replaced in tests so retries do not wait for real. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const MIB = 1024 * 1024;

function formatBytes(bytes: number): string {
  return bytes >= MIB ? `${(bytes / MIB).toFixed(1)} MiB` : `${String(bytes)} bytes`;
}

/**
 * Race work against a deadline.
 *
 * The timer is cleared whichever side settles first, and both promises have a
 * handler attached by `race`, so a late rejection from the losing side is never
 * reported as unhandled.
 */
function within<T>(work: Promise<T>, ms: number, fail: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(fail());
    }, ms);
  });
  return Promise.race([work, expiry]).finally(() => {
    clearTimeout(timer);
  });
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Already closed or errored: there is nothing left to release.
  }
}

function releaseReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    reader.releaseLock();
  } catch {
    // A reader cancelled mid-read may refuse release; the stream is closed either way.
  }
}

async function readCapped(response: Response, url: string, limits: FetchLimits): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limits.maxBytes) {
    await cancelBody(response);
    throw new FetchLimitExceeded(
      url,
      "bytes",
      `declared ${formatBytes(declared)}, over the ${formatBytes(limits.maxBytes)} limit`,
    );
  }
  if (response.body === null) return Buffer.alloc(0);

  // The repository compiles against ES2022 without DOM types, where the global
  // stream types resolve loosely; Node's own declaration keeps chunks typed.
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await within(
        reader.read(),
        limits.idleTimeoutMs,
        () =>
          new FetchLimitExceeded(
            url,
            "idle-timeout",
            `no data for ${String(limits.idleTimeoutMs)} ms after ${formatBytes(received)}`,
          ),
      );
      if (done) break;
      received += value.byteLength;
      if (received > limits.maxBytes) {
        throw new FetchLimitExceeded(
          url,
          "bytes",
          `body passed the ${formatBytes(limits.maxBytes)} limit`,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    releaseReader(reader);
  }
  return Buffer.concat(chunks, received);
}

/** The same host, allowing only a `www.` prefix to differ. */
function sameHost(from: URL, to: URL): boolean {
  const bare = (host: string): string => host.toLowerCase().replace(/^www\./, "");
  return bare(from.hostname) === bare(to.hostname);
}

/** Where a redirect may go, or why it may not. */
function redirectTarget(current: string, location: string | null, hops: number): string {
  if (location === null || location === "") {
    throw new FetchRefused(current, "redirect with no location");
  }
  if (hops >= MAX_REDIRECTS) {
    throw new FetchRefused(current, `more than ${String(MAX_REDIRECTS)} redirects`);
  }
  const from = new URL(current);
  const to = new URL(location, from);
  if (!sameHost(from, to)) {
    throw new FetchRefused(current, `redirect to another host, ${to.hostname}, refused`);
  }
  if (from.protocol === "https:" && to.protocol !== "https:") {
    throw new FetchRefused(current, "redirect from https to http refused");
  }
  return to.href;
}

/** A status worth retrying, raised inside an attempt that is not the last. */
class RetryableStatus extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(`HTTP ${String(status)}`);
  }
}

function retryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (raw === null) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(raw);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/** How long to wait before trying again, or null when this failure will not pass. */
function retryDelay(error: unknown, attempt: number, policy: RetryPolicy): number | null {
  if (attempt >= policy.attempts) return null;
  const backoff = policy.backoffMs[Math.min(attempt - 1, policy.backoffMs.length - 1)] ?? 0;
  if (error instanceof RetryableStatus) {
    return error.retryAfterMs === null
      ? backoff
      : Math.min(Math.max(error.retryAfterMs, backoff), policy.maxRetryAfterMs);
  }
  // No answer in time may pass. A body that stalled, or passed its size, was
  // answered and will be answered the same way again.
  if (error instanceof FetchLimitExceeded)
    return error.limit === "headers-timeout" ? backoff : null;
  if (error instanceof FetchRefused) return null;
  // `fetch` reports a refused or dropped connection as a TypeError.
  return error instanceof TypeError ? backoff : null;
}

/**
 * Fetch one URL within limits, or fail saying which limit was reached.
 *
 * The abort signal is passed to `http` so a real `fetch` stops the socket, and
 * every wait is also raced against its own timer, so an implementation that
 * ignores the signal still cannot outlive the deadline. Each attempt has the
 * full limits; a retry does not inherit the time the last one used.
 */
export async function fetchWithLimits(request: BoundedRequest): Promise<BoundedResponse> {
  const method = (request.init.method ?? "GET").toUpperCase();
  const policy: RetryPolicy =
    request.retry !== undefined && (method === "GET" || method === "HEAD")
      ? request.retry
      : { attempts: 1, backoffMs: [], maxRetryAfterMs: 0 };
  const pause =
    request.sleep ??
    ((ms: number) =>
      new Promise<void>((done) => {
        setTimeout(done, ms);
      }));

  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptOnce(request, attempt >= policy.attempts);
    } catch (error) {
      const wait = retryDelay(error, attempt, policy);
      if (wait === null) throw error;
      await pause(wait);
    }
  }
}

async function attemptOnce(request: BoundedRequest, last: boolean): Promise<BoundedResponse> {
  const { url, limits, accept } = request;
  const http: Http = request.http ?? fetch;
  const controller = new AbortController();

  const exchange = async (): Promise<BoundedResponse> => {
    let current = url;
    let init: HttpInit = request.init;
    for (let hops = 0; ; hops++) {
      const response = await within(
        http(current, { ...init, redirect: "manual", signal: controller.signal }),
        limits.headersTimeoutMs,
        () =>
          new FetchLimitExceeded(
            current,
            "headers-timeout",
            `no response within ${String(limits.headersTimeoutMs)} ms`,
          ),
      );
      if (REDIRECT_STATUSES.has(response.status)) {
        await cancelBody(response);
        current = redirectTarget(current, response.headers.get("location"), hops);
        // A 303, or a 301/302 after a POST, is fetched with GET, as browsers do.
        if (
          response.status === 303 ||
          ((response.status === 301 || response.status === 302) && init.method === "POST")
        ) {
          const { body: _dropped, ...rest } = init;
          init = { ...rest, method: "GET" };
        }
        continue;
      }
      if (!last && RETRY_STATUSES.has(response.status)) {
        await cancelBody(response);
        throw new RetryableStatus(response.status, retryAfterMs(response));
      }
      if (accept !== undefined) {
        try {
          accept(response);
        } catch (refusal) {
          await cancelBody(response);
          throw refusal;
        }
      }
      const body = await readCapped(response, current, limits);
      return { url, status: response.status, headers: response.headers, body };
    }
  };

  try {
    return await within(
      exchange(),
      limits.totalTimeoutMs,
      () =>
        new FetchLimitExceeded(
          url,
          "total-timeout",
          `not complete within ${String(limits.totalTimeoutMs)} ms`,
        ),
    );
  } finally {
    // Stops the socket on every exit — success, refusal or any limit.
    controller.abort();
  }
}

/** Decode a bounded body the way `Response.text()` does: UTF-8, leading BOM removed. */
export function textOf(response: BoundedResponse): string {
  return new TextDecoder().decode(response.body);
}
