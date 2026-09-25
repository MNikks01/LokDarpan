import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CrawlNotPermitted,
  PortalSession,
  isStaleSession,
  permitsCrawling,
} from "../src/gepnic/fetch";

const BASE = "https://tenders.example.test";

interface Seen {
  readonly url: string;
  readonly headers: Record<string, string>;
}

/**
 * Stands in for the network: answers each request from a route table and
 * records what was asked, so a test can assert on the order and the headers.
 */
function portal(routes: Record<string, () => Response>): Seen[] {
  const seen: Seen[] = [];
  vi.stubGlobal("fetch", (url: string, init: { headers: Record<string, string> }) => {
    seen.push({ url, headers: init.headers });
    const route = routes[new URL(url).pathname];
    return Promise.resolve(route === undefined ? new Response("", { status: 404 }) : route());
  });
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("robots.txt", () => {
  it("reads a missing policy as permission, and an unreadable one as refusal", () => {
    expect(permitsCrawling("", 404)).toBe(true);
    // A policy we could not read is not a policy we may assume.
    expect(permitsCrawling("", 500)).toBe(false);
    expect(permitsCrawling("", 403)).toBe(false);
  });

  it("stops on a site-wide disallow addressed to every agent", () => {
    expect(permitsCrawling("User-agent: *\nDisallow: /", 200)).toBe(false);
  });

  it("ignores a disallow addressed to some other crawler", () => {
    const policy = "User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private";
    expect(permitsCrawling(policy, 200)).toBe(true);
  });

  it("reads through comments and Windows line endings", () => {
    expect(permitsCrawling("# policy\r\nUser-agent: * # all\r\nDisallow: / # none\r\n", 200)).toBe(
      false,
    );
  });
});

describe("a lapsed session", () => {
  it("is recognised, because it would otherwise parse as an office that advertised nothing", () => {
    expect(isStaleSession("<html><b>Stale Session</b></html>")).toBe(true);
    expect(isStaleSession("Your session has timed out.")).toBe(true);
    expect(isStaleSession("<table><tr><td>Tender</td></tr></table>")).toBe(false);
  });
});

describe("PortalSession", () => {
  it("checks the policy before the first page, and carries the session's cookies forward", async () => {
    const seen = portal({
      "/nicgep/app": () =>
        new Response("<html>landing</html>", {
          headers: [
            ["set-cookie", "JSESSIONID=abc123; Path=/nicgep; HttpOnly"],
            // A date carries a comma: joined and split on commas, it would corrupt.
            ["set-cookie", "route=r1; Expires=Wed, 21 Oct 2026 07:28:00 GMT"],
          ],
        }),
      "/nicgep/detail": () => new Response("<html>detail</html>"),
    });

    const { session, landing } = await PortalSession.open(BASE);
    expect(seen.map((s) => new URL(s.url).pathname)).toEqual(["/robots.txt", "/nicgep/app"]);
    expect(landing.body).toBe("<html>landing</html>");
    expect(landing.sourceUrl).toBe(`${BASE}/nicgep/app`);
    expect(landing.byteSize).toBe(20);
    expect(landing.sha256).toMatch(/^[0-9a-f]{64}$/);
    // The landing page is requested cold, with no referer.
    expect(seen[1]?.headers["cookie"]).toBeUndefined();
    expect(seen[1]?.headers["referer"]).toBeUndefined();

    const detail = await session.get(`${BASE}/nicgep/detail`);
    expect(detail.body).toBe("<html>detail</html>");
    const request = seen[2]?.headers ?? {};
    expect(request["cookie"]).toBe("JSESSIONID=abc123; route=r1");
    expect(request["referer"]).toBe(`${BASE}/nicgep/app`);
    // Named on every request, and the header the portal answers 500 without.
    expect(request["user-agent"]).toMatch(/^LokDarpan\//);
    expect(request["accept-language"]).toBe("en-IN,en;q=0.9");
  });

  it("fetches nothing further from a host that disallows crawling", async () => {
    const seen = portal({
      "/robots.txt": () => new Response("User-agent: *\nDisallow: /"),
    });
    await expect(PortalSession.open(BASE)).rejects.toBeInstanceOf(CrawlNotPermitted);
    expect(seen).toHaveLength(1);
  });

  it("refuses a page that failed rather than digesting its error text", async () => {
    portal({
      "/nicgep/app": () => new Response("landing"),
      "/nicgep/broken": () => new Response("<html>error</html>", { status: 403 }),
    });
    const { session } = await PortalSession.open(BASE);
    await expect(session.get(`${BASE}/nicgep/broken`)).rejects.toThrow(/returned 403/);
  });
});
