---
"@lokdarpan/database": minor
---

`migrate -- --status` lists applied and pending migrations without applying anything, inside a READ
ONLY transaction, and still fails on a changed or unknown migration. The production runbook
(`.docs/16-operations/applying-migrations.md`) uses it before and after applying 0040–0043.
