/**
 * What a host's `robots.txt` lets LokDarpan fetch.
 *
 * `.docs/06-government-sources/access-and-permissions.md` makes honouring it
 * non-negotiable. The GePNIC connector only ever needed one question — does the
 * host refuse everything? — and answered it in `permitsCrawling`. The
 * Maharashtra agency sources need a second one, because their policies are
 * path-specific: MHADA and MMRDA disallow `/search/`, MEDA `/search` and
 * `/admin`, CIDCO `/login` and `/*?q=`. An adapter must be able to ask "may I
 * fetch this path?" and get an answer.
 *
 * The reading follows RFC 9309 where following it is the stricter choice, and
 * departs from it where the RFC would permit more:
 *
 * - **Groups.** Rules come from every group addressed to `*` or to our product
 *   token (`lokdarpan`), merged. The RFC would use only the most specific
 *   group; merging means a rule aimed at us and a rule aimed at everyone both
 *   bind us.
 * - **Longest match wins**, as in the RFC, with `*` and a trailing `$`
 *   honoured. **A tie goes to Disallow**, where the RFC prefers Allow.
 * - **A site-wide `Disallow: /` addressed to us refuses the whole host**, even
 *   if narrower Allow lines follow. That is how `permitsCrawling` has always
 *   read it: a publisher who writes `Disallow: /` has said the thing that
 *   matters, and an Allow carved out of it is too fine a reading to act on.
 * - **A policy we could not read is a refusal.** 404 and 410 mean no policy is
 *   stated, which the access findings record as permission. Any other non-200
 *   status, or a 200 whose body is an HTML page rather than a policy — two
 *   Maharashtra hosts answer `/robots.txt` with their single-page app — is a
 *   policy we cannot read, and so a refusal.
 */

export type RobotsPolicy =
  | { readonly kind: "none" }
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "rules"; readonly rules: readonly RobotsRule[] };

export interface RobotsRule {
  readonly allow: boolean;
  readonly pattern: string;
}

/** The product token our user agent carries, lower-cased for matching. */
export const PRODUCT_TOKEN = "lokdarpan";

/** Whether a body is an HTML page rather than a plain-text policy. */
function looksLikeHtml(body: string, contentType: string | null): boolean {
  if (contentType !== null && /text\/html/i.test(contentType)) return true;
  return /^\s*(<!doctype html|<html)/i.test(body);
}

/** Whether a group's `User-agent` line addresses us. */
function addressesUs(agent: string): boolean {
  return agent === "*" || (agent !== "" && PRODUCT_TOKEN.startsWith(agent));
}

/** What the response itself says before its body is read, or null to read on. */
function policyFromResponse(
  body: string,
  status: number,
  contentType: string | null,
): RobotsPolicy | null {
  if (status === 404 || status === 410) return { kind: "none" };
  if (status !== 200) return { kind: "unreadable", reason: `HTTP ${String(status)}` };
  if (looksLikeHtml(body, contentType)) {
    return { kind: "unreadable", reason: "an HTML page was served instead of a policy" };
  }
  return null;
}

/** One `field: value` line, lower-cased field, comment stripped; null if not a directive. */
function directiveOf(raw: string): { readonly key: string; readonly value: string } | null {
  const line = (raw.split("#")[0] ?? "").trim();
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  return { key: line.slice(0, colon).trim().toLowerCase(), value: line.slice(colon + 1).trim() };
}

/**
 * Read a fetched `robots.txt` into the rules that bind us.
 *
 * Groups are consecutive `User-agent` lines followed by their rules; a
 * `User-agent` line after a rule starts a new group. Unknown fields
 * (`Sitemap`, `Crawl-delay`, `Host`) are ignored, as are comments.
 */
export function readRobots(
  body: string,
  status: number,
  contentType: string | null = null,
): RobotsPolicy {
  const early = policyFromResponse(body, status, contentType);
  if (early !== null) return early;

  const rules: RobotsRule[] = [];
  let agents: string[] = [];
  let inRules = false;

  for (const raw of body.split(/\r?\n/)) {
    const directive = directiveOf(raw);
    if (directive === null) continue;
    const { key, value } = directive;

    if (key === "user-agent") {
      if (inRules) agents = [];
      inRules = false;
      agents.push(value.toLowerCase());
      continue;
    }
    if (key !== "allow" && key !== "disallow") continue;
    inRules = true;

    // An empty Disallow permits everything and adds no rule; an empty Allow
    // says nothing.
    if (value === "" || !agents.some(addressesUs)) continue;
    rules.push({ allow: key === "allow", pattern: value });
  }

  return { kind: "rules", rules };
}

/** Whether a rule's path pattern matches a path, with `*` and a trailing `$`. */
export function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${regex}${anchored ? "$" : ""}`, "u").test(path);
}

/** How specific a pattern is: its length without wildcards, as the RFC counts it. */
function specificity(pattern: string): number {
  return pattern.replace(/[*$]/g, "").length;
}

/** Whether the policy refuses the whole host: unreadable, or `Disallow: /` (or `/*`) addressed to us. */
export function refusesEverything(policy: RobotsPolicy): boolean {
  if (policy.kind === "none") return false;
  if (policy.kind === "unreadable") return true;
  return policy.rules.some(
    (rule) => !rule.allow && (rule.pattern === "/" || rule.pattern === "/*"),
  );
}

/**
 * Whether one path may be fetched.
 *
 * `pathAndQuery` is the URL's path plus its query string, as the RFC matches
 * it (`/mr/tenders?page=2`), and must begin with `/`.
 */
export function mayFetch(policy: RobotsPolicy, pathAndQuery: string): boolean {
  if (!pathAndQuery.startsWith("/")) {
    throw new Error(`Expected a path beginning with "/", got ${JSON.stringify(pathAndQuery)}`);
  }
  if (refusesEverything(policy)) return false;
  if (policy.kind !== "rules") return true;

  let best: RobotsRule | null = null;
  for (const rule of policy.rules) {
    if (!patternMatches(rule.pattern, pathAndQuery)) continue;
    if (best === null) {
      best = rule;
      continue;
    }
    const a = specificity(rule.pattern);
    const b = specificity(best.pattern);
    // Longer wins; on a tie, Disallow wins.
    if (a > b || (a === b && !rule.allow)) best = rule;
  }
  return best === null || best.allow;
}

/** The path and query of a URL, as `mayFetch` expects them. */
export function pathOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}
