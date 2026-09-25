---
"@lokdarpan/ingestion": patch
---

Collectors follow redirects only within the host they asked, and retry a failure that may pass.

`fetchWithLimits` follows at most five redirects, only to the same host and never from https to
http, and refuses any other with `FetchRefused`. With `retry: RETRY_IDEMPOTENT`, which the CAG,
LGD, BEAMS and GePNIC collectors now pass, GET and HEAD requests are tried up to three times after
a dropped connection, a timeout before any response, 429, 502, 503 or 504. POSTs, size limits,
4xx and other 5xx are never retried. See the ADR-052 addendum.
