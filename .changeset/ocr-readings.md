---
"@lokdarpan/database": minor
"@lokdarpan/ingestion": minor
---

Pages with no text layer can be read by the OCR service, and each engine's reading is stored beside
the page in `page_reading` (migration 0042, ADR-071), never in its text. A reading names its
engine, version, models, languages and render; two engines leave two readings; a refusal is
recorded with its reason. `ingest:agency --ocr` runs it, and it is off by default.
