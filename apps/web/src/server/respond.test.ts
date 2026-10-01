import { describe, expect, it, vi } from "vitest";

// `server-only` throws outside a server bundle, and the container opens a
// database pool. Neither is what these tests are about.
vi.mock("server-only", () => ({}));
vi.mock("./container", () => ({
  datasetVersionOpenedAt: () => Promise.resolve("2026-09-29T00:00:00.000Z"),
}));

const { AppError, respond } = await import("./respond");

const request = (): Request => new Request("https://lokdarpan.example.invalid/api/v1/units/1");

describe("respond: what may be cached, and where", () => {
  // On 29 September the database refused connections after a day of uncached
  // traffic and builds spent its transfer allowance. A browser-only header was
  // why every first request reached it.
  it("lets Vercel's CDN keep a successful answer, not only the browser", async () => {
    const response = await respond(request(), () =>
      Promise.resolve({ data: {}, datasetVersion: 7 }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    const cdn = response.headers.get("vercel-cdn-cache-control") ?? "";
    expect(cdn).toMatch(/(^|, )max-age=3600(,|$)/);
    expect(cdn).toContain("stale-while-revalidate=");
    // An outage serves the last good answer, which states its own version.
    expect(cdn).toContain("stale-if-error=");
  });

  it("says in the body how old a cached answer is", async () => {
    const response = await respond(request(), () =>
      Promise.resolve({ data: {}, datasetVersion: 7 }),
    );
    const body = (await response.json()) as { meta: { datasetVersion: number; asOf: string } };
    expect(body.meta).toEqual({ datasetVersion: 7, asOf: "2026-09-29T00:00:00.000Z" });
  });

  // The limit exists to spare the database, so a limited request must not
  // reach it — and the refusal must not be cached, or the CDN would go on
  // refusing everyone who asks for that URL.
  it("refuses a limited client before any database work, and says when to retry", async () => {
    const produce = vi.fn(() => Promise.resolve({ data: {}, datasetVersion: 7 }));
    const response = await respond(request(), produce, () => Promise.resolve(true));

    expect(response.status).toBe(429);
    expect(produce).not.toHaveBeenCalled();
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vercel-cdn-cache-control")).toBeNull();
    const body = (await response.json()) as { error: { code: string; requestId: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.requestId).toBeTruthy();
  });

  // A cached error would keep answering "not found" or "failed" after the cause
  // was gone, and the CDN's stale-if-error must have a good answer to fall back to.
  it("never lets an error be cached, anywhere", async () => {
    for (const failure of [AppError.notFound("Unit 999999"), new Error("database refused")]) {
      const response = await respond(request(), () => Promise.reject(failure));
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("vercel-cdn-cache-control")).toBeNull();
    }
  });
});
