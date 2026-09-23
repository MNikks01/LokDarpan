/**
 * The browser's copy of what the API has said, keyed by what it was read from.
 *
 * Three defects this exists to prevent:
 *
 * - **Duplicate reads.** Two panels asking for the same URL in the same render
 *   used to make two requests. Concurrent reads of one URL share one promise.
 * - **Re-reads on the way back.** Drilling into a district and out again is the
 *   normal path; it re-downloaded the state's level every time. A settled read
 *   is kept and served synchronously, so returning draws without a spinner.
 * - **Version-mixed pages.** Each panel reads separately, and a load can commit
 *   between two of those reads, or an HTTP cache (`max-age=300`) can hand one
 *   panel a response older than another's. The page would then show two
 *   states of the ledger side by side. Every response names its version
 *   (ADR-053); the highest one seen is the watermark, anything cached from
 *   below it is dropped, and subscribers are told so they read again.
 *
 * Failures are never cached, and a failed read evicts only its own entry —
 * never a newer request for the same URL that started after it. Adapted from
 * God's Eye View's single-flight loader (`.docs/decisions/gods-eye-view-adoption.md`).
 *
 * No React here, so it is tested without a DOM. `use-resource.ts` binds it.
 */

export interface Versioned<T> {
  readonly data: T;
  readonly datasetVersion: number;
  readonly asOf: string | null;
}

export type Fetcher = (url: string, init: { readonly cache: RequestCache }) => Promise<Response>;

export class ResourceError extends Error {
  constructor(
    readonly url: string,
    readonly status: number | null,
    reason: string,
  ) {
    super(`${url}: ${reason}`);
    this.name = "ResourceError";
  }
}

interface Entry {
  readonly promise: Promise<Versioned<unknown>>;
  settled: Versioned<unknown> | null;
}

/** Enough for a reader's session of drilling in and out; a level is ~60 KB. */
const DEFAULT_CAPACITY = 64;

export class ResourceCache {
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<(watermark: number) => void>();
  private highest = 0;

  constructor(
    private readonly fetcher: Fetcher = (url, init) => fetch(url, init),
    private readonly capacity = DEFAULT_CAPACITY,
  ) {}

  /** The newest dataset version any response has named. */
  get watermark(): number {
    return this.highest;
  }

  /** A settled read of `url`, if one is held. Never starts a request. */
  peek<T>(url: string): Versioned<T> | null {
    return (this.entries.get(url)?.settled as Versioned<T> | null | undefined) ?? null;
  }

  read<T>(url: string): Promise<Versioned<T>> {
    const existing = this.entries.get(url);
    if (existing !== undefined) {
      // Re-inserted so eviction drops the least recently used, not the oldest.
      this.entries.delete(url);
      this.entries.set(url, existing);
      return existing.promise as Promise<Versioned<T>>;
    }

    const promise = this.load(url).then(
      (result) => {
        entry.settled = result;
        this.advance(result.datasetVersion);
        return result;
      },
      (error: unknown) => {
        // Only this request's entry. A later read of the same URL may already
        // have replaced it, and evicting that one would throw away a good result.
        if (this.entries.get(url) === entry) this.entries.delete(url);
        throw error;
      },
    );
    const entry: Entry = { promise, settled: null };
    this.entries.set(url, entry);
    this.trim();
    return promise as Promise<Versioned<T>>;
  }

  /** Called with the new watermark whenever it rises. Returns an unsubscribe. */
  subscribe(listener: (watermark: number) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async load(url: string): Promise<Versioned<unknown>> {
    const first = await this.request(url, "default");
    if (first.datasetVersion >= this.highest) return first;
    // Older than something already shown: most likely the HTTP cache. Asked once
    // more past it, and whatever comes back is accepted, so a server that is
    // itself behind cannot put this into a loop.
    return this.request(url, "reload");
  }

  private async request(url: string, cache: RequestCache): Promise<Versioned<unknown>> {
    const response = await this.fetcher(url, { cache });
    if (!response.ok) throw new ResourceError(url, response.status, "request failed");
    const body = (await response.json()) as {
      readonly data?: unknown;
      readonly meta?: { readonly datasetVersion?: unknown; readonly asOf?: unknown };
    };
    const version = body.meta?.datasetVersion;
    // A payload that does not say which ledger it came from cannot be placed
    // against the others on the page, so it is refused rather than guessed at.
    if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
      throw new ResourceError(url, response.status, "response names no dataset version");
    }
    const asOf = body.meta?.asOf;
    return {
      data: body.data,
      datasetVersion: version,
      asOf: typeof asOf === "string" ? asOf : null,
    };
  }

  private advance(version: number): void {
    if (version <= this.highest) return;
    this.highest = version;
    for (const [url, entry] of this.entries) {
      if (entry.settled !== null && entry.settled.datasetVersion < version) {
        this.entries.delete(url);
      }
    }
    for (const listener of this.listeners) listener(version);
  }

  private trim(): void {
    for (const url of this.entries.keys()) {
      if (this.entries.size <= this.capacity) return;
      this.entries.delete(url);
    }
  }
}
