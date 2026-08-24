import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "reflect-metadata";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { buildContainer } from "../src/container/index.js";
import { createApiServer } from "../src/http/server.js";
import { loadConfig } from "../src/config/index.js";

let server: Server;
let base: string;

beforeAll(async () => {
  const config = loadConfig({ NODE_ENV: "test", PORT: "0", LOG_LEVEL: "error" });
  server = createApiServer(buildContainer(config));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});
afterAll(async () => {
  await new Promise<void>((r) =>
    server.close(() => {
      r();
    }),
  );
});

describe("API integration", () => {
  it("serves liveness and readiness separately", async () => {
    expect((await fetch(`${base}/livez`)).status).toBe(200);
    const ready = await fetch(`${base}/readyz`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ status: "ok" });
  });

  it("returns a project with its dataset version", async () => {
    const res = await fetch(`${base}/api/v1/projects/501`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      data: { id: 501 },
      meta: { datasetVersion: 0 },
    });
  });

  it("echoes a client-supplied correlation id", async () => {
    const res = await fetch(`${base}/api/v1/projects/501`, {
      headers: { "x-request-id": "trace-1" },
    });
    expect(res.headers.get("x-request-id")).toBe("trace-1");
  });

  it("mints a correlation id when the client sends none", async () => {
    const res = await fetch(`${base}/livez`);
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects a malformed id at the boundary", async () => {
    const res = await fetch(`${base}/api/v1/projects/not-a-number`);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "BAD_REQUEST" } });
  });

  it("404s an unknown project without leaking internals", async () => {
    const res = await fetch(`${base}/api/v1/projects/999999`);
    expect(res.status).toBe(404);
    const body: unknown = await res.json();
    expect(body).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(JSON.stringify(body)).not.toMatch(/stack|at Object|node_modules/);
  });

  it("rejects non-GET methods", async () => {
    expect((await fetch(`${base}/livez`, { method: "POST" })).status).toBe(400);
  });

  it("never sets a cacheable header on an error", async () => {
    const res = await fetch(`${base}/api/v1/projects/999999`);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
