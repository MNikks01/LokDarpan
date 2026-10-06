---
"@lokdarpan/database": minor
"@lokdarpan/ingestion": minor
---

A scanned tender notice's facts are read from its OCR reading, as candidates a person must check
(migration 0043, ADR-072). Each names the reading it came from (`document_fact.page_reading_id`),
is always marked for review, and has a confidence scaled by the engine's least confident word of
the value. `published_fact` withholds every fact read from a scan, verified or not. MHADA's Marathi
schedule is read: publication, bid deadline, bid openings, pre-bid meeting and notice reference.
