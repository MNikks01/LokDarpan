import {
  fetchWithLimits,
  RETRY_IDEMPOTENT,
  textOf,
  type BoundedResponse,
  type FetchLimits,
  type Http,
} from "../net/fetch-with-limits";
import { ROBOTS_TXT } from "../net/limits";
import { mayFetch, pathOf, readRobots, type RobotsPolicy } from "../net/robots";

/**
 * Fetching from Maharashtra agency websites, only where permitted and never
 * quickly.
 *
 * `.docs/04-data-engineering/maharashtra-tender-ingestion.md` §7: every host's
 * `robots.txt` is read once per run, and every path is checked against it
 * before it is requested — a path the policy refuses is never fetched, not
 * fetched and discarded. Requests to one host are spaced at least
 * `minIntervalMs` apart, and a host is never asked two things at once.
 *
 * Agency sites are small government servers. The interval is the difference
 * between a collector they never notice and one that shows up in their logs as
 * load.
 */

/** Identifies the project, so a publisher can see who is asking and write to us. */
export const USER_AGENT = "LokDarpan/0.1 (+https://github.com/MNikks01/LokDarpan)";

/** Two seconds between requests to one host (the backlog's backfill rate). */
export const MIN_INTERVAL_MS = 2_000;

export class PathNotPermitted extends Error {
  constructor(readonly url: string) {
    super(`robots.txt refuses ${url}; not fetched.`);
    this.name = "PathNotPermitted";
  }
}

export interface Fetched {
  readonly requestedUrl: string;
  readonly url: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly etag: string | null;
  readonly lastModified: string | null;
  readonly body: Buffer;
  readonly retrievedAt: Date;
}

export interface Validators {
  readonly etag?: string | null;
  readonly lastModified?: string | null;
}

export interface PoliteClientOptions {
  readonly http?: Http;
  readonly minIntervalMs?: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function conditionalHeaders(validators: Validators): Record<string, string> {
  const headers: Record<string, string> = {};
  if (validators.etag != null) headers["if-none-match"] = validators.etag;
  if (validators.lastModified != null) headers["if-modified-since"] = validators.lastModified;
  return headers;
}

export class PoliteClient {
  /** The pending or settled policy per origin: concurrent callers share one request. */
  private readonly policies = new Map<string, Promise<RobotsPolicy>>();
  private readonly lastRequestAt = new Map<string, number>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly http: Http | undefined;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: PoliteClientOptions = {}) {
    this.http = options.http;
    this.minIntervalMs = options.minIntervalMs ?? MIN_INTERVAL_MS;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? realSleep;
  }

  /** The host's policy, read once per run and then kept. */
  policyFor(origin: string): Promise<RobotsPolicy> {
    const known = this.policies.get(origin);
    if (known !== undefined) return known;
    const pending = this.request(origin, `${origin}/robots.txt`, ROBOTS_TXT, {}).then((response) =>
      readRobots(textOf(response), response.status, response.headers.get("content-type")),
    );
    this.policies.set(origin, pending);
    return pending;
  }

  /** Whether a URL may be fetched, by its host's policy. */
  async permits(url: string): Promise<boolean> {
    return mayFetch(await this.policyFor(new URL(url).origin), pathOf(url));
  }

  /**
   * Fetch one URL if its host's policy permits the path.
   *
   * Validators from an earlier sighting are sent when given, so an unchanged
   * document costs the host a 304 rather than its bytes.
   */
  async get(url: string, limits: FetchLimits, validators: Validators = {}): Promise<Fetched> {
    if (!(await this.permits(url))) throw new PathNotPermitted(url);

    const response = await this.request(
      new URL(url).origin,
      url,
      limits,
      conditionalHeaders(validators),
    );
    // A same-host redirect may land on another path; check it too. Cross-host
    // redirects are already refused by `fetchWithLimits`.
    if (response.url !== url && !(await this.permits(response.url))) {
      throw new PathNotPermitted(response.url);
    }
    return {
      requestedUrl: url,
      url: response.url,
      status: response.status,
      contentType: response.headers.get("content-type"),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      body: response.body,
      retrievedAt: new Date(this.now()),
    };
  }

  /** One request, after the host's previous one has finished and the interval has passed. */
  private request(
    origin: string,
    url: string,
    limits: FetchLimits,
    extraHeaders: Record<string, string>,
  ): Promise<BoundedResponse> {
    const previous = this.queues.get(origin) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const last = this.lastRequestAt.get(origin);
        if (last !== undefined) {
          const wait = last + this.minIntervalMs - this.now();
          if (wait > 0) await this.sleep(wait);
        }
        try {
          return await fetchWithLimits({
            url,
            limits,
            retry: RETRY_IDEMPOTENT,
            sleep: this.sleep,
            ...(this.http === undefined ? {} : { http: this.http }),
            init: { headers: { "user-agent": USER_AGENT, ...extraHeaders } },
          });
        } finally {
          this.lastRequestAt.set(origin, this.now());
        }
      });
    this.queues.set(origin, next);
    return next;
  }
}
