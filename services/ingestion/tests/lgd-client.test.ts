import { describe, expect, it } from "vitest";

import { LgdClient, type HttpLike } from "../src/lgd/client.js";

const HOME_WITH_TOKEN = `<a href="x.do?OWASP_CSRFTOKEN=AAAA-BBBB-CCCC">go</a>`;

interface Call {
  readonly url: string;
  readonly headers: Record<string, string>;
}

function stubHttp(responses: readonly { status: number; body: string; setCookie?: string }[]): {
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
    headers.set("content-type", "text/html;charset=UTF-8");
    return Promise.resolve(new Response(r?.body ?? "", { status: r?.status ?? 200, headers }));
  };
  return { http, calls };
}

describe("LgdClient", () => {
  it("identifies itself on every request", async () => {
    const { http, calls } = stubHttp([{ status: 200, body: HOME_WITH_TOKEN }]);
    const client = new LgdClient("https://example.test", http);
    await client.openSession();
    expect(calls[0]?.headers["user-agent"]).toMatch(/LokDarpan/);
  });

  it("captures the CSRF token and sends it on the citizen view", async () => {
    const { http, calls } = stubHttp([
      { status: 200, body: HOME_WITH_TOKEN, setCookie: "JSESSIONID=abc; Path=/" },
      { status: 200, body: "<table></table>" },
    ]);
    const client = new LgdClient("https://example.test", http);
    await client.openSession();
    await client.fetchStates();
    expect(calls[1]?.url).toContain("OWASP_CSRFTOKEN=AAAA-BBBB-CCCC");
  });

  it("carries the session cookie forward", async () => {
    const { http, calls } = stubHttp([
      { status: 200, body: HOME_WITH_TOKEN, setCookie: "JSESSIONID=abc; Path=/; HttpOnly" },
      { status: 200, body: "<table></table>" },
    ]);
    const client = new LgdClient("https://example.test", http);
    await client.openSession();
    await client.fetchStates();
    expect(calls[1]?.headers["cookie"]).toBe("JSESSIONID=abc");
  });

  it("hashes the retrieved bytes", async () => {
    const { http } = stubHttp([
      { status: 200, body: HOME_WITH_TOKEN },
      { status: 200, body: "<table>x</table>" },
    ]);
    const client = new LgdClient("https://example.test", http);
    await client.openSession();
    const page = await client.fetchStates();
    expect(page.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(page.body.toString("utf8")).toBe("<table>x</table>");
  });

  // Guessing a token would send a request the site did not authorise.
  it("refuses when no CSRF token is present", async () => {
    const { http } = stubHttp([{ status: 200, body: "<html>no token here</html>" }]);
    const client = new LgdClient("https://example.test", http);
    await expect(client.openSession()).rejects.toThrow(/No CSRF token/i);
  });

  it("refuses when the home page does not return 200", async () => {
    const { http } = stubHttp([{ status: 503, body: "" }]);
    const client = new LgdClient("https://example.test", http);
    await expect(client.openSession()).rejects.toThrow(/503/);
  });

  it("refuses to fetch a citizen view before a session exists", async () => {
    const { http } = stubHttp([{ status: 200, body: "" }]);
    const client = new LgdClient("https://example.test", http);
    await expect(client.fetchStates()).rejects.toThrow(/openSession/);
  });

  it("refuses a non-200 state listing rather than parsing an error page", async () => {
    const { http } = stubHttp([
      { status: 200, body: HOME_WITH_TOKEN },
      { status: 500, body: "<html>error</html>" },
    ]);
    const client = new LgdClient("https://example.test", http);
    await client.openSession();
    await expect(client.fetchStates()).rejects.toThrow(/500/);
  });
});
