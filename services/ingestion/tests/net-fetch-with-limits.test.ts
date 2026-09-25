import { describe, expect, it } from "vitest";

import { BeamsClient } from "../src/beams/client";
import { CagClient } from "../src/cag/client";
import {
  FetchLimitExceeded,
  FetchRefused,
  RETRY_IDEMPOTENT,
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

/** A server that answers from a script, one response per request, recording what was asked. */
type Step = Error | (() => Response);

function scripted(steps: readonly Step[]) {
  const asked: { url: string; method: string; redirect: string | undefined }[] = [];
  let i = 0;
  const http: Http = (url, init) => {
    asked.push({ url, method: init.method ?? "GET", redirect: init.redirect });
    const step = steps[Math.min(i, steps.length - 1)];
    i += 1;
    // A fresh response per request, as a real server sends: an earlier attempt
    // may have cancelled the body of the one before.
    if (step === undefined) return Promise.resolve(new Response("?"));
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step());
  };
  return { http, asked };
}

const moved =
  (location: string, status = 302) =>
  () =>
    new Response(null, { status, headers: { location } });
const reply =
  (body: string | null, init: ResponseInit = {}) =>
  () =>
    new Response(body, init);

describe("redirects stay on the host that was asked", () => {
  it("follows a redirect within the host, and within www.", async () => {
    const { http, asked } = scripted([
      moved("/en"),
      moved("https://www.cag.gov.in/en/reports"),
      reply("ok"),
    ]);
    const response = await fetchWithLimits({
      url: "https://cag.gov.in/",
      init: { headers: {} },
      limits: QUICK,
      http,
    });
    expect(textOf(response)).toBe("ok");
    expect(asked.map((a) => a.url)).toEqual([
      "https://cag.gov.in/",
      "https://cag.gov.in/en",
      "https://www.cag.gov.in/en/reports",
    ]);
    // Never left to fetch itself: the rules above are the only ones applied.
    expect(asked.every((a) => a.redirect === "manual")).toBe(true);
  });

  it("refuses a redirect to another host", async () => {
    const { http } = scripted([moved("https://elsewhere.example/doc.pdf")]);
    await expect(
      fetchWithLimits({
        url: "https://cag.gov.in/doc.pdf",
        init: { headers: {} },
        limits: QUICK,
        http,
      }),
    ).rejects.toThrow(/another host, elsewhere\.example/);
  });

  it("refuses a redirect from https down to http", async () => {
    const { http } = scripted([moved("http://cag.gov.in/doc.pdf")]);
    await expect(
      fetchWithLimits({
        url: "https://cag.gov.in/doc.pdf",
        init: { headers: {} },
        limits: QUICK,
        http,
      }),
    ).rejects.toBeInstanceOf(FetchRefused);
  });

  it("stops following after five redirects", async () => {
    const { http } = scripted([moved("/again")]);
    await expect(
      fetchWithLimits({ url: "https://cag.gov.in/", init: { headers: {} }, limits: QUICK, http }),
    ).rejects.toThrow(/more than 5 redirects/);
  });

  it("fetches a 303's target with GET", async () => {
    const { http, asked } = scripted([moved("/result", 303), reply("done")]);
    await fetchWithLimits({
      url: "https://lgdirectory.gov.in/search",
      init: { headers: {}, method: "POST", body: "q=1" },
      limits: QUICK,
      http,
    });
    expect(asked.map((a) => a.method)).toEqual(["POST", "GET"]);
  });
});

describe("a failure that may pass is tried again", () => {
  const waits: number[] = [];
  const sleep = (ms: number): Promise<void> => {
    waits.push(ms);
    return Promise.resolve();
  };
  const run = (steps: readonly Step[], method = "GET") => {
    waits.length = 0;
    const { http, asked } = scripted(steps);
    return {
      asked,
      result: fetchWithLimits({
        url: "https://wbtenders.gov.in/nicgep/app",
        init: { headers: {}, method },
        limits: QUICK,
        http,
        retry: RETRY_IDEMPOTENT,
        sleep,
      }),
    };
  };

  it("retries a dropped connection, then succeeds", async () => {
    const { result, asked } = run([new TypeError("fetch failed"), reply("landing")]);
    expect(textOf(await result)).toBe("landing");
    expect(asked).toHaveLength(2);
    expect(waits).toEqual([2_000]);
  });

  it("retries a 503, honouring Retry-After but never past the cap", async () => {
    const { result } = run([
      reply("busy", { status: 503, headers: { "retry-after": "5" } }),
      reply("busy", { status: 503, headers: { "retry-after": "3600" } }),
      reply("landing"),
    ]);
    expect((await result).status).toBe(200);
    expect(waits).toEqual([5_000, 60_000]);
  });

  it("hands back the server's own answer when the last try is still refused", async () => {
    const { result, asked } = run([reply("busy", { status: 503 })]);
    const response = await result;
    expect(response.status).toBe(503);
    expect(textOf(response)).toBe("busy");
    expect(asked).toHaveLength(3);
  });

  it("does not retry a 404, which will be a 404 again", async () => {
    const { result, asked } = run([reply("gone", { status: 404 })]);
    expect((await result).status).toBe(404);
    expect(asked).toHaveLength(1);
  });

  it("does not retry a body that passed its limit", async () => {
    const { result, asked } = run([reply("x".repeat(200))]);
    await expect(result).rejects.toBeInstanceOf(FetchLimitExceeded);
    expect(asked).toHaveLength(1);
  });

  it("never retries a POST, which may have taken effect", async () => {
    const { result, asked } = run([new TypeError("fetch failed"), reply("ok")], "POST");
    await expect(result).rejects.toBeInstanceOf(TypeError);
    expect(asked).toHaveLength(1);
  });

  it("does not retry without a policy", async () => {
    const { http, asked } = scripted([new TypeError("fetch failed"), reply("ok")]);
    await expect(
      fetchWithLimits({ url: "https://x.gov.in/", init: { headers: {} }, limits: QUICK, http }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(asked).toHaveLength(1);
  });
});
