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
}

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

/**
 * Fetch one URL within limits, or fail saying which limit was reached.
 *
 * The abort signal is passed to `http` so a real `fetch` stops the socket, and
 * every wait is also raced against its own timer, so an implementation that
 * ignores the signal still cannot outlive the deadline.
 */
export async function fetchWithLimits(request: BoundedRequest): Promise<BoundedResponse> {
  const { url, init, limits, accept } = request;
  const http: Http = request.http ?? fetch;
  const controller = new AbortController();

  const exchange = async (): Promise<BoundedResponse> => {
    const response = await within(
      http(url, { ...init, signal: controller.signal }),
      limits.headersTimeoutMs,
      () =>
        new FetchLimitExceeded(
          url,
          "headers-timeout",
          `no response within ${String(limits.headersTimeoutMs)} ms`,
        ),
    );
    if (accept !== undefined) {
      try {
        accept(response);
      } catch (refusal) {
        await cancelBody(response);
        throw refusal;
      }
    }
    const body = await readCapped(response, url, limits);
    return { url, status: response.status, headers: response.headers, body };
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
