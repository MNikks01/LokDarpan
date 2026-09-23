---
"@lokdarpan/domain": minor
"@lokdarpan/database": minor
"@lokdarpan/web": patch
"@lokdarpan/api": patch
---

Serve unit views whose units came from several loads (ADR-053 addendum).

`UnitService` no longer refuses a payload that spans loads. Geography is loaded district by district,
so it refused every real state. The web routes read inside the ledger snapshot and report its
watermark, and each unit keeps its own `provenance.datasetVersion`. `singleDatasetVersion` and
`ViolationSink` are removed; `newestDatasetVersion` replaces them for callers with no snapshot.
`PostgresAdminUnitRepository` accepts a snapshot client.
