---
"@lokdarpan/ingestion": minor
---

Measure both OCR engines on this corpus, and decide on the measurements.

The brief named 522 unread pages. Rendering all 522 and measuring the raster —
no recognition, just ink, images and layout — shows 428 are blank, 65 are report
covers, 9 are photographs, 9 are divider sheets, and **11 are pages of writing**.
The unread half of this corpus is eleven pages.

Ground truth is the page's own text layer on 120 sampled pages, so nothing was
transcribed by hand. Scoring runs the production extractor over OCR text and over
the page's text and compares the amounts, because for this project a false
numerical extraction is worse than an omission.

**Tesseract 5.5.3: 100% figure precision, 41.5% recall, zero false figures** over
104 trustworthy pages at 2.3 s/page. The precision is the extractor refusing what
it cannot read: Tesseract reads the rupee mark 44.1% of the time, and on Latin
pages figure recall is 1.9% as a result. On the eleven pages OCR exists for it
recovers 7,252 characters at 0.948 confidence and no money facts at all.

**PaddleOCR 3.7.0 could not be benchmarked here** — 471.77 s against Tesseract's
1.47 s on the same page, 321×. That is a throughput fact on CPU, not an accuracy
finding, and is recorded as one page of evidence.

Scoring also exposed a defect in the ledger rather than in OCR: **115 pages whose
text layer writes a backtick where the document prints ₹**, and `glyph_substitution`
flags none of them, because it looks for Latin letters inside Devanagari words.
Six of the ten figures that first looked like OCR errors were the engine reading a
figure the broken layer had lost.

Adds `ocr:manifest` and `ocr:score` alongside the benchmark harness in
`services/ocr/bench`, so the next engine is measured rather than argued about.
