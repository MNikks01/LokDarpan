import { describe, expect, it } from "vitest";

import { BeamsClient, type HttpLike } from "../src/beams/client";

interface Call {
  readonly url: string;
  readonly headers: Record<string, string>;
}

function stub(responses: readonly { status: number; body: string; setCookie?: string }[]): {
  http: HttpLike;
  calls: Call[];
} {
  const calls: Call[] = [];
  let i = 0;
  const http: HttpLike = (url, init) => {
    calls.push({ url, headers: init.headers });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    const headers = new Headers();
    if (r?.setCookie !== undefined) headers.set("set-cookie", r.setCookie);
    return Promise.resolve(new Response(r?.body ?? "", { status: r?.status ?? 200, headers }));
  };
  return { http, calls };
}

const OK = { status: 200, body: "<html>report</html>" };

describe("BeamsClient", () => {
  it("identifies itself on every request", async () => {
    const { http, calls } = stub([OK]);
    await new BeamsClient("https://example.test", http).openSession();
    expect(calls[0]?.headers["user-agent"]).toMatch(/LokDarpan/);
  });

  it("carries the session cookie and a Referer to the export", async () => {
    const { http, calls } = stub([
      { ...OK, setCookie: "JSESSIONID=abc; Path=/" },
      { status: 200, body: "<table>data</table>" },
    ]);
    const client = new BeamsClient("https://example.test", http);
    await client.openSession();
    await client.fetchDepartmentYear("H", 2024);
    expect(calls[1]?.headers["cookie"]).toBe("JSESSIONID=abc");
    expect(calls[1]?.headers["referer"]).toMatch(/DepartmentExp1\.jsp$/u);
    expect(calls[1]?.url).toContain("year=2024&dept=H");
  });

  // BEAMS answers 200 with an empty body when the session or Referer is
  // rejected. Reading that as "this department has no data" would publish an
  // empty year as though the government had spent nothing.
  it("treats an empty body as a failure, not as an empty dataset", async () => {
    const { http } = stub([OK, { status: 200, body: "" }]);
    const client = new BeamsClient("https://example.test", http);
    await client.openSession();
    await expect(client.fetchDepartmentYear("H", 2024)).rejects.toThrow(/empty body/i);
    await expect(client.fetchDepartmentYear("H", 2024)).rejects.toThrow(
      /does not mean there is no data/i,
    );
  });

  it("refuses a department code it does not recognise", async () => {
    const { http } = stub([OK]);
    const client = new BeamsClient("https://example.test", http);
    await expect(client.fetchDepartmentYear("'; DROP TABLE--", 2024)).rejects.toThrow(
      /not a BEAMS department code/i,
    );
    await expect(client.fetchDepartmentYear("", 2024)).rejects.toThrow();
  });

  it("refuses a non-200 export", async () => {
    const { http } = stub([OK, { status: 503, body: "" }]);
    const client = new BeamsClient("https://example.test", http);
    await client.openSession();
    await expect(client.fetchDepartmentYear("H", 2024)).rejects.toThrow(/503/);
  });

  it("refuses when the parent report is unavailable", async () => {
    const { http } = stub([{ status: 500, body: "" }]);
    await expect(new BeamsClient("https://example.test", http).openSession()).rejects.toThrow(
      /500/,
    );
  });

  it("hashes the retrieved bytes", async () => {
    const { http } = stub([OK, { status: 200, body: "<table>x</table>" }]);
    const client = new BeamsClient("https://example.test", http);
    await client.openSession();
    const page = await client.fetchDepartmentYear("H", 2024);
    expect(page.sha256).toMatch(/^[0-9a-f]{64}$/u);
  });
});
