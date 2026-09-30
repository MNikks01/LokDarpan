---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": minor
---

A daily check (`check:collection`, workflow **Check collection**) opens a GitHub issue when tender
collection is failing, stale, not running, stuck, or the database is unreachable, and closes it when
collection is healthy again. The freshness rule is now one exported function, `collectionStatusOf`,
used by both the site and the check so they cannot disagree.
