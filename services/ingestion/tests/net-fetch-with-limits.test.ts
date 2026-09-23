import { describe, expect, it } from "vitest";

import { BeamsClient } from "../src/beams/client";
import { CagClient } from "../src/cag/client";
import {
  FetchLimitExceeded,
  fetchWithLimits,
  textOf,
  type FetchLimits,
  type Http,
} from "../src/net/fetch-with-limits";

const QUICK: FetchLimits = {
  maxBytes: 64,
  headersTimeoutMs: 200,
  idleTimeoutMs: 200,
  totalTimeoutMs: 1_000,
};

const encoder = new TextEncoder();

function sleep(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

/** A body that yields the given chunks, each after a delay, and records how many were pulled. */
function streamed(
  chunks: readonly string[],
  gapMs = 0,
): { readonly body: ReadableStream<Uint8Array>; readonly pulled: () => number } {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      if (gapMs > 0) await sleep(gapMs);
      controller.enqueue(encoder.encode(chunks[index] ?? ""));
      index += 1;
    },
  });
  return { body, pulled: () => index };
}

function answer(body: string | ReadableStream<Uint8Array> | null, init: ResponseInit = {}): Http {
  return () => Promise.resolve(new Response(body, init));
}

async function limitOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    if (error instanceof FetchLimitExceeded) return error.limit;
    throw error;
  }
  return "none";
}

describe("fetchWithLimits", () => {
  it("returns a body within the limits, decoded as Response.text() would", async () => {
    const response = await fetchWithLimits({
      url: "https://example.test/a",
      init: { headers: {} },
      limits: QUICK,
      http: answer("\uFEFFhello", { status: 200 }),
    });
    expect(response.status).toBe(200);
    expect(textOf(response)).toBe("hello");
  });

  it("refuses a declared size over the limit without reading the body", async () => {
    const { body, pulled } = streamed(["x".repeat(10)]);
    const http = answer(body, { headers: { "content-length": "100000" } });
    expect(
      await limitOf(fetchWithLimits({ url: "u", init: { headers: {} }, limits: QUICK, http })),
    ).toBe("bytes");
    expect(pulled()).toBeLessThanOrEqual(1);
  });

  // The case that matters most: no content-length, or one describing compressed
  // bytes that expand. Only the running count of decoded bytes catches it.
  it("stops a body with no declared size once it passes the limit", async () => {
    const { body, pulled } = streamed(Array.from({ length: 50 }, () => "0123456789"));
    expect(
      await limitOf(
        fetchWithLimits({ url: "u", init: { headers: {} }, limits: QUICK, http: answer(body) }),
      ),
    ).toBe("bytes");
    expect(pulled()).toBeLessThan(50);
  });

  it("gives up on a server that never answers", async () => {
    const http: Http = () => new Promise<Response>(() => undefined);
    expect(
      await limitOf(fetchWithLimits({ url: "u", init: { headers: {} }, limits: QUICK, http })),
    ).toBe("headers-timeout");
  });

  it("aborts the request signal when a limit is reached", async () => {
    let seen: AbortSignal | undefined;
    const http: Http = (_url, init) => {
      seen = init.signal;
      return new Promise<Response>(() => undefined);
    };
    await limitOf(fetchWithLimits({ url: "u", init: { headers: {} }, limits: QUICK, http }));
    expect(seen?.aborted).toBe(true);
  });

  it("gives up on a body that goes silent", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("first chunk, then nothing"));
      },
    });
    expect(
      await limitOf(
        fetchWithLimits({ url: "u", init: { headers: {} }, limits: QUICK, http: answer(body) }),
      ),
    ).toBe("idle-timeout");
  });

  // Each chunk arrives inside the idle window, so only the total catches a trickle.
  it("gives up on a trickle that never finishes", async () => {
    const { body } = streamed(
      Array.from({ length: 40 }, () => "."),
      100,
    );
    const limits: FetchLimits = { ...QUICK, idleTimeoutMs: 500, totalTimeoutMs: 600 };
    expect(
      await limitOf(
        fetchWithLimits({ url: "u", init: { headers: {} }, limits, http: answer(body) }),
      ),
    ).toBe("total-timeout");
  });

  it("lets the caller refuse a response before its body is read", async () => {
    const { body, pulled } = streamed(["<html>not found</html>"]);
    const work = fetchWithLimits({
      url: "u",
      init: { headers: {} },
      limits: QUICK,
      http: answer(body, { status: 404 }),
      accept: (r) => {
        if (r.status !== 200) throw new Error(`refused ${String(r.status)}`);
      },
    });
    await expect(work).rejects.toThrow("refused 404");
    expect(pulled()).toBeLessThanOrEqual(1);
  });
});

describe("collectors use the limits", () => {
  it("CAG refuses an HTML error page for a report without downloading it", async () => {
    const { body, pulled } = streamed(Array.from({ length: 100 }, () => "<p>error</p>"));
    const http = answer(body, { status: 200, headers: { "content-type": "text/html" } });
    const client = new CagClient("https://example.test", http);
    await expect(client.fetchReport("https://example.test/r.pdf")).rejects.toThrow(
      /Expected a PDF/,
    );
    expect(pulled()).toBeLessThanOrEqual(1);
  });

  it("BEAMS reports an oversized export as a limit, not as data", async () => {
    const chunk = "x".repeat(1024 * 1024);
    const { body } = streamed(Array.from({ length: 6 }, () => chunk));
    const client = new BeamsClient("https://example.test", answer(body, { status: 200 }));
    const failure = await client.fetchDepartmentYear("A", 2024).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(FetchLimitExceeded);
    expect((failure as FetchLimitExceeded).limit).toBe("bytes");
  });
});
