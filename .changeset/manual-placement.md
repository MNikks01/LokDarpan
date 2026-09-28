---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": minor
---

Reviewed district aliases and manual tender placement.

`data/reference/district-aliases.json` holds names a chain uses for a district the ledger names
differently; only approved entries are used, and a placement through one says so. `tenders:place`
records a reviewer's signed, reasoned decision — a district of the tender's state, or "cannot be
placed" — in `tender_district_decision` (migration 0035), and the collector never overrides it.
`tenders:resolve` now re-reads stored chains with today's names and aliases, and leaves decided
tenders off the review list.
