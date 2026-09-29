---
"@lokdarpan/web": minor
---

The API refuses a client that sends too many uncached requests, with `429 RATE_LIMITED` and
`Retry-After: 60`, before the database is touched. Only cache misses are counted, per IP, against a
Vercel Firewall rule (`api-origin`); the site's own server-rendered pages are exempt by
`INTERNAL_API_TOKEN`. It fails open: with no rule configured, or the check unavailable, every request
proceeds and the reason is logged. Setup in `.docs/16-operations/rate-limiting.md`.
