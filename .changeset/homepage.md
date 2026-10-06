---
"@lokdarpan/web": minor
"@lokdarpan/database": minor
---

A homepage that says what LokDarpan is, what it holds today and what is planned, and leads to the
map. Its numbers are read from the ledger (a new `PostgresOverviewRepository`), never written into
the page: a map of India drawn from the ledger's own state geometry with the states holding audit
reports shaded, live counts with the dataset version they were read at, a preview of one state, one
verified figure with its full source trail, and an availability matrix whose statuses follow what
the ledger actually holds. When the ledger cannot be read, the page shows boundaries only and "Not
read" in place of each count. Revalidated hourly (see the dated addendum in
`.docs/02-architecture/web-architecture.md`).
