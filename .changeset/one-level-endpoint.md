---
"@lokdarpan/web": minor
---

Read a level inside a place in one request, and keep explorer reads by dataset version (ADR-064).

`GET /api/v1/geo/units/:id/level` returns a place's units, coverage, sources and boundaries from one
ledger snapshot, so the rail and the map can no longer describe different versions. It replaces
`/geo/units/:id/children` and `/geo/units/:id/boundaries`, which are removed.

Every explorer read now goes through one browser cache: concurrent reads of a URL share a request,
a place the reader returns to draws without a request, failures are not kept, and a newer dataset
version seen by any panel drops older entries and makes the other panels read again.
