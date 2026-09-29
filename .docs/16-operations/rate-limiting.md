# Rate limiting the public API

**Written:** 30 September 2026 · **Code:** `apps/web/src/server/rate-limit.ts` · **Requirement:** [`11-api/client-api-contract.md`](../11-api/client-api-contract.md) §6

## What is limited, and why that and nothing else

Every `/api/v1` answer is cached at Vercel's CDN for an hour (PR #154). A cached answer never runs
our code and never touches Neon. What does reach Neon is a **cache miss**: a place nobody asked for
this hour, or a search nobody typed. Misses are what cost metered transfer, and on 29 September
2026 that transfer ran out and took the site down. An endless stream of unique `?q=` searches
produces nothing but misses, and caching cannot stop it.

So the limit counts **misses only**. It is checked inside `respond()`, before the database is
touched, which means a request served from the cache is never counted at all.

| Request                                          | Counted?                           |
| ------------------------------------------------ | ---------------------------------- |
| Served from the CDN cache                        | No: it never reaches the function  |
| A miss from a browser or script                  | Yes, per client IP                 |
| A miss from one of our own server-rendered pages | No: exempt by `INTERNAL_API_TOKEN` |

**Why per IP, given CGNAT.** Indian carriers put many phones behind one address, so a per-IP limit
can throttle strangers together; the contract forbids it for the mobile app, which will key on a
per-install token instead. The web has no install to key on. An IP bucket is tolerable here only
because it counts misses: a person browsing produces a few a minute, and the ceiling below is set
far above what a shared address produces and far below what a loop does. Watch the logs (§3) before
lowering it.

**Why our own pages are exempt.** Server-rendered pages fetch the API through the public domain, so
every page on the site arrives from a handful of Vercel addresses. Counted, they would share one
bucket and throttle the whole site at once. They carry a secret header instead; the reader's own
request is the thing to limit.

**It fails open.** No rule configured, the check unreachable, an answer it does not understand: the
request proceeds and the reason is logged. A limiter that can take the site down is a second outage
waiting for the first.

## 1. The internal token (once, in Vercel)

Nothing is limited until this and §2 are both done. Until then the code logs
`rate_limit.rule_missing` and lets every request through.

Generate a secret and keep it in your password manager:

```bash
openssl rand -hex 32
```

Vercel → project `lok-darpan-web-ft68` → Settings → Environment Variables → add
`INTERNAL_API_TOKEN` for **Production** and **Preview**, marked **Sensitive**. Never prefix it
`NEXT_PUBLIC_`: it must not reach a browser. A token shorter than 32 characters exempts nobody, by
design.

Set it **before** creating the rule, or the site's own pages will be counted against Vercel's
addresses. It takes effect on the next deployment.

## 2. The Firewall rule (once, in Vercel)

Vercel → project → Firewall → Configure → **New Rule**:

| Field            | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Name             | `api-origin`                                               |
| If               | `@vercel/firewall` · Rate limit ID · equals · `api-origin` |
| Then             | **Rate Limit**                                             |
| Strategy         | Fixed window, **60 seconds**                               |
| Limit            | **300 requests**                                           |
| Key              | IP address                                                 |
| Follow-up action | Too Many Requests (429)                                    |

Save, then **Review Changes → Publish**. `RETRY_AFTER_SECONDS` in the code is 60 to match the
window; change both together.

Whether the Hobby plan includes this rule is not confirmed in Vercel's documentation. If the
dashboard refuses it, the code stays a no-op and the site behaves as before; nothing breaks.

### Checking it works

```bash
# A burst of unique searches, which the CDN cannot answer from cache:
for i in $(seq 1 320); do
  curl -s -o /dev/null -w "%{http_code}\n" "https://<production domain>/api/v1/search?q=probe$i"
done | sort | uniq -c
```

Expect about 300 × `200` and the rest `429`, each 429 carrying `Retry-After: 60`. Then open a few
pages on the site: they must still load, because they are exempt. Each probe is a real query; run
it once, not in a loop.

## 3. Watching it

Vercel → project → Logs, filtered on:

- `rate_limit.rule_missing`: the rule is not configured, or not published.
- `rate_limit.check_failed`: the check itself failed and the request was let through.
- `request.rejected` with `"code":"RATE_LIMITED"`: a client was refused. A steady trickle from many
  addresses, rather than a burst from one, is the sign the ceiling is too low for shared addresses.

## What this does not do

- It does not stop a distributed attack from many addresses. For that, Vercel's Attack Challenge
  Mode (Firewall → Attack Mode) is the tool, turned on while it lasts.
- It does not give the mobile app its per-install tier. That comes with the app.
