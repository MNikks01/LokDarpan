import { createHash } from "node:crypto";

/**
 * Fetching from a GePNIC deployment, politely and only where permitted.
 *
 * WHY THIS HOLDS A COOKIE JAR
 * A tender's detail page is reachable without any interactive check, but only
 * inside a live session: requested cold it answers "Stale Session". So the
 * landing page is fetched first and its cookies are carried forward. That is
 * ordinary browsing, not a circumvention — nothing is being worked around, and
 * where a page does demand an interactive check this module stops.
 *
 * WHY ROBOTS.TXT IS RE-READ EVERY RUN
 * `.docs/06-government-sources/access-and-permissions.md` makes honouring it
 * non-negotiable, and a policy that was permissive in August can change. Two of
 * the thirty-six state portals already serve `Disallow: /`. Checking once at
 * design time and trusting it forever is how a connector ends up crawling a
 * host that has since asked it not to.
 */

export interface FetchedArtifact {
  readonly body: string;
  readonly sha256: string;
  readonly retrievedAt: string;
  readonly sourceUrl: string;
  readonly byteSize: number;
}

/** Identifies the project, so abuse can be traced to us rather than an IP. */
const USER_AGENT =
  "LokDarpan/0.1 (public-infrastructure transparency; +https://github.com/MNikks01/LokDarpan)";

/**
 * Sent on every request because this GePNIC deployment requires it.
 *
 * Without an `accept-language` header the Tamil Nadu portal answers 500 with
 * its own error page — the request reaches the application and the application
 * refuses it. Isolated by elimination on 2026-09-01: `accept`, `accept-encoding`,
 * `connection`, `upgrade-insecure-requests` and the HTTP version all make no
 * difference, and this header alone turns 500 into 200. curl sends nothing of
 * the sort and still succeeds, so the requirement is a quirk of how the app
 * handles the header's absence rather than a policy.
 *
 * This is compatibility, not evasion: the user agent above still says plainly
 * who we are, and a portal that wished to refuse us could still do so.
 */
const ACCEPT_LANGUAGE = "en-IN,en;q=0.9";

export class CrawlNotPermitted extends Error {
  constructor(readonly host: string) {
    super(`${host} disallows crawling in robots.txt. Collection stopped.`);
    this.name = "CrawlNotPermitted";
  }
}

/**
 * Does this host's `robots.txt` permit us?
 *
 * Deliberately simple and deliberately strict: any `Disallow: /` under a
 * wildcard agent stops the run. A more permissive reading — parsing paths,
 * matching the most specific rule — would be defensible for a search crawler
 * and is the wrong instinct here. Where a publisher's intent is ambiguous, the
 * answer is to not collect.
 *
 * A 404 means no policy is stated, which the access findings record as
 * permitted; thirty-four of thirty-six portals are in that position. Any other
 * status is treated as a refusal, because a policy we could not read is not a
 * policy we may assume.
 */
export function permitsCrawling(robotsTxt: string, status: number): boolean {
  if (status === 404) return true;
  if (status !== 200) return false;

  let wildcardAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.split("#")[0]?.trim() ?? "";
    const [field, ...rest] = line.split(":");
    const key = (field ?? "").trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") wildcardAgent = value === "*";
    else if (key === "disallow" && wildcardAgent && value === "/") return false;
  }
  return true;
}

function digest(body: string, url: string): FetchedArtifact {
  return {
    body,
    sha256: createHash("sha256").update(body).digest("hex"),
    retrievedAt: new Date().toISOString(),
    sourceUrl: url,
    byteSize: Buffer.byteLength(body),
  };
}

/**
 * Whether a page is the portal telling us the session has lapsed.
 *
 * Worth naming, because such a page is a well-formed 200 that parses to zero
 * tenders. Read as data it says "this office advertised nothing", which is a
 * false statement about a government rather than a failed request.
 */
export function isStaleSession(body: string): boolean {
  return /stale session|your session has timed out/i.test(body);
}

/**
 * A live session against one portal.
 *
 * Cookies are kept in memory for the run and never written anywhere: they
 * identify a browsing session, and persisting them would outlive the purpose
 * they were issued for.
 */
export class PortalSession {
  private readonly cookies = new Map<string, string>();

  private constructor(readonly baseUrl: string) {}

  /**
   * Check the policy, then open a session by fetching the landing page.
   *
   * The check precedes the first page fetch, because otherwise that fetch is
   * itself the violation it was meant to prevent.
   */
  static async open(
    baseUrl: string,
  ): Promise<{ readonly session: PortalSession; readonly landing: FetchedArtifact }> {
    const host = new URL(baseUrl).origin;
    const robots = await fetch(`${host}/robots.txt`, {
      headers: { "user-agent": USER_AGENT, "accept-language": ACCEPT_LANGUAGE },
    });
    if (!permitsCrawling(await robots.text(), robots.status)) {
      throw new CrawlNotPermitted(host);
    }

    const session = new PortalSession(baseUrl);
    const landing = await session.get(`${baseUrl}/nicgep/app`);
    return { session, landing };
  }

  private storeCookies(response: Response): void {
    // `getSetCookie` keeps multiple Set-Cookie headers apart; joining them into
    // one string and splitting on commas corrupts any cookie carrying a date.
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(";")[0] ?? "";
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  async get(url: string): Promise<FetchedArtifact> {
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": ACCEPT_LANGUAGE,
        ...(cookie === "" ? {} : { cookie }),
        ...(url.endsWith("/nicgep/app") ? {} : { referer: `${this.baseUrl}/nicgep/app` }),
      },
    });
    if (!response.ok) throw new Error(`${url} returned ${String(response.status)}`);
    this.storeCookies(response);
    return digest(await response.text(), url);
  }
}
