---
"@lokdarpan/ingestion": minor
---

A path-aware `robots.txt` reader (`net/robots.ts`) for sources whose policies refuse some paths and
not others, as the Maharashtra agency sites do. Stricter than RFC 9309 where it differs: rules
addressed to `*` and to LokDarpan are merged, a tie goes to Disallow, a site-wide `Disallow: /`
refuses the host even beside narrower Allows, and a policy that cannot be read — any status but
200, 404 or 410, or an HTML page served in its place — is a refusal. `permitsCrawling` keeps its
behaviour and now calls it.
