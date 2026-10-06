---
"@lokdarpan/database": minor
"@lokdarpan/domain": minor
"@lokdarpan/ingestion": minor
"@lokdarpan/web": minor
---

A verified fact read from a scanned page is published, marked as one: the document page and `/api/v1/documents/:id` carry which engine read it and whether its characters were clearly legible (migration 0044, ADR-072). The engine's confidence is stored apart from the parser's, and a scan fact without it is never shown.
