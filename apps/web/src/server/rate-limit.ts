import "server-only";

import { timingSafeEqual } from "node:crypto";
import { checkRateLimit } from "@vercel/firewall";

/**
 * A limit on the requests that reach the database, and only those.
 *
 * WHAT IT PROTECTS
 * Since PR #154 a cached answer is served by Vercel's CDN and never runs this
 * code. What arrives here is a cache miss: a place nobody has asked for this
 * hour, or a search nobody has typed — and each costs a Neon query and metered
 * transfer. On 29 September that transfer ran out and the site went down. An
 * endless stream of unique `?q=` searches would do the same, and caching cannot
 * stop it.
 *
 * WHY THE BUCKET IS THE CLIENT'S IP, AND GENEROUS
 * `.docs/11-api/client-api-contract.md` §6 warns that Indian carriers put many
 * phones behind one address (CGNAT), so a per-IP limit can throttle strangers
 * together. The mobile app will get a per-install bucket; the web has no install
 * to key on. What makes an IP bucket tolerable here is what it counts: misses
 * only. A reader browsing costs a few misses a minute, so the ceiling (set on
 * the rule in Vercel's Firewall, not here) sits far above what a shared address
 * produces and far below what a loop does. See
 * `.docs/16-operations/rate-limiting.md`.
 *
 * WHY OUR OWN PAGES ARE EXEMPT
 * Server-rendered pages fetch this API through the public domain, so to the
 * limiter every page on the site arrives from a handful of Vercel addresses. In
 * one bucket they would throttle the whole site at once. They carry a shared
 * secret instead, set only on the server (`INTERNAL_API_TOKEN`), and are not
 * counted: the reader's request that caused them was the thing to limit.
 *
 * FAILS OPEN
 * No rule configured, the check unreachable, an answer it does not understand:
 * the request proceeds, and the reason is logged. A limiter that can take the
 * site down is a second outage waiting for the first.
 */

/** The rule's name in the Firewall: a `@vercel/firewall` condition must match it. */
export const ORIGIN_RATE_LIMIT_ID = "api-origin";

/** Header a server-side fetch carries to identify itself. Never sent by a browser. */
export const INTERNAL_HEADER = "x-lokdarpan-internal";

/** Seconds a limited client is told to wait: the rule's window. */
export const RETRY_AFTER_SECONDS = 60;

export type RateLimitCheck = typeof checkRateLimit;

function sameSecret(offered: string, expected: string): boolean {
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Whether this request comes from one of our own pages. */
export function isInternal(
  request: Request,
  token: string | undefined = process.env["INTERNAL_API_TOKEN"],
): boolean {
  // An unset or short token exempts nobody: an empty header must not match an
  // empty secret.
  if (token === undefined || token.length < 32) return false;
  const offered = request.headers.get(INTERNAL_HEADER);
  return offered !== null && sameSecret(offered, token);
}

function log(message: string, detail: Record<string, unknown>): void {
  process.stdout.write(
    `${JSON.stringify({ level: "warn", message, ...detail, time: new Date().toISOString() })}\n`,
  );
}

/** True only when the Firewall has said this client is over its limit. */
export async function originLimited(
  request: Request,
  check: RateLimitCheck = checkRateLimit,
): Promise<boolean> {
  if (isInternal(request)) return false;
  try {
    const { rateLimited, error } = await check(ORIGIN_RATE_LIMIT_ID, { request });
    if (error === "not-found") {
      log("rate_limit.rule_missing", { rule: ORIGIN_RATE_LIMIT_ID });
    }
    return rateLimited;
  } catch (cause: unknown) {
    log("rate_limit.check_failed", {
      rule: ORIGIN_RATE_LIMIT_ID,
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    return false;
  }
}
