import { describe, expect, it, vi } from "vitest";
import { ResourceCache, ResourceError, type Fetcher } from "./resource-cache";

const envelope = (data: unknown, datasetVersion: unknown, asOf: string | null = null): Response =>
  Response.json({ data, meta: { datasetVersion, asOf } });

/** A fetcher whose responses the test releases by hand, in any order. */
function manualFetcher() {
  const pending: { url: string; cache: RequestCache; resolve: (r: Response) => void }[] = [];
  const fetcher = vi.fn<Fetcher>(
    (url, init) =>
      new Promise<Response>((resolve) => {
        pending.push({ url, cache: init.cache, resolve });
      }),
  );
  return { fetcher, pending };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ResourceCache", () => {
  it("shares one request between concurrent reads of a URL", async () => {
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve(envelope("a", 3)));
    const cache = new ResourceCache(fetcher);

    const [first, second] = await Promise.all([cache.read("/a"), cache.read("/a")]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(first).toEqual({ data: "a", datasetVersion: 3, asOf: null });
  });

  it("serves a settled read synchronously and without a request", async () => {
    const fetcher = vi.fn<Fetcher>(() => Promise.resolve(envelope("a", 3, "2026-09-17T00:00:00Z")));
    const cache = new ResourceCache(fetcher);
    expect(cache.peek("/a")).toBeNull();

    await cache.read("/a");
    await cache.read("/a");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.peek("/a")).toEqual({
      data: "a",
      datasetVersion: 3,
      asOf: "2026-09-17T00:00:00Z",
    });
  });

  it("does not keep a failure, so the next read asks again", async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(envelope("a", 3));
    const cache = new ResourceCache(fetcher);

    await expect(cache.read("/a")).rejects.toBeInstanceOf(ResourceError);
    await expect(cache.read("/a")).resolves.toMatchObject({ data: "a" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("evicts only the failed request's own entry, never a newer one for the same URL", async () => {
    const { fetcher, pending } = manualFetcher();
    const cache = new ResourceCache(fetcher, 1);

    const failing = cache.read("/a");
    cache.read("/b").catch(() => undefined); // pushes /a out: capacity 1
    const replacement = cache.read("/a");

    pending[0]?.resolve(new Response(null, { status: 500 }));
    await expect(failing).rejects.toBeInstanceOf(ResourceError);
    pending[2]?.resolve(envelope("fresh", 2));
    await replacement;

    expect(cache.peek("/a")).toMatchObject({ data: "fresh" });
  });

  it("refuses a payload that names no dataset version", async () => {
    const cache = new ResourceCache(() => Promise.resolve(Response.json({ data: "a" })));
    await expect(cache.read("/a")).rejects.toThrow("names no dataset version");
  });

  it("drops what it holds from older versions when a newer one is seen, and says so", async () => {
    const versions: Record<string, number> = { "/a": 3, "/b": 4 };
    const cache = new ResourceCache((url) => Promise.resolve(envelope(url, versions[url])));
    const heard = vi.fn();
    cache.subscribe(heard);

    await cache.read("/a");
    expect(heard).toHaveBeenLastCalledWith(3);
    await cache.read("/b");

    expect(heard).toHaveBeenLastCalledWith(4);
    expect(cache.watermark).toBe(4);
    expect(cache.peek("/a")).toBeNull();
    expect(cache.peek("/b")).not.toBeNull();
  });

  it("asks past the HTTP cache once when a response is older than one already shown", async () => {
    const { fetcher, pending } = manualFetcher();
    const cache = new ResourceCache(fetcher);

    const newer = cache.read("/b");
    pending[0]?.resolve(envelope("b", 5));
    await newer;

    const older = cache.read("/a");
    await flush();
    pending[1]?.resolve(envelope("a-stale", 4));
    await flush();
    expect(pending[2]).toMatchObject({ url: "/a", cache: "reload" });
    pending[2]?.resolve(envelope("a-fresh", 5));

    await expect(older).resolves.toMatchObject({ data: "a-fresh", datasetVersion: 5 });
  });

  it("accepts a second older answer rather than asking forever", async () => {
    const fetcher = vi.fn<Fetcher>((url) => Promise.resolve(envelope(url, url === "/b" ? 5 : 4)));
    const cache = new ResourceCache(fetcher);
    await cache.read("/b");

    await expect(cache.read("/a")).resolves.toMatchObject({ datasetVersion: 4 });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(cache.watermark).toBe(5);
  });

  it("stops telling a listener once it unsubscribes", async () => {
    const cache = new ResourceCache(() => Promise.resolve(envelope("a", 7)));
    const heard = vi.fn();
    const unsubscribe = cache.subscribe(heard);
    unsubscribe();

    await cache.read("/a");
    expect(heard).not.toHaveBeenCalled();
  });

  it("evicts the least recently used entry past its capacity", async () => {
    const fetcher = vi.fn<Fetcher>((url) => Promise.resolve(envelope(url, 1)));
    const cache = new ResourceCache(fetcher, 2);

    await cache.read("/a");
    await cache.read("/b");
    await cache.read("/a"); // /a is now the most recent
    await cache.read("/c");

    expect(cache.peek("/a")).not.toBeNull();
    expect(cache.peek("/b")).toBeNull();
    expect(cache.peek("/c")).not.toBeNull();
  });
});
