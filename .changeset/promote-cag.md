---
"@lokdarpan/ingestion": minor
---

`promote:cag` copies the reviewed CAG ledger from one database to another: report bytes to the raw
store, then documents, pages, every figure with its review decision, same-figure links and review
history, in one transaction checked against the source. A dry run unless `--commit` is given. Page
text-item geometry is not carried; each figure keeps its own rectangle (ADR-070).
