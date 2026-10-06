---
"@lokdarpan/ingestion": minor
---

`raw:adopt` records where an old artefact's bytes are kept once they verify against its sha256; `ocr:read --source=…` reads any source's pages that have no text layer; the CAG fact parser now reads scanned pages' OCR readings too, as scan facts for review; and `extract:cag-facts -- --dry-run` shows what a run would change and keeps nothing.
