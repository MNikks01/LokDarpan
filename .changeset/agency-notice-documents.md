---
"@lokdarpan/ingestion": minor
---

Held agency notices become `tender_notice` documents with their pages, through the extractor and
loader the CAG reports use, read back from the raw store rather than fetched again. Raw stores can
now give bytes back (`ReadableRawStore.get`), verified against the hash they are addressed by. Scanned
notices are loaded with every page counted as without text and reported as awaiting OCR.
