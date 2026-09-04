---
"@lokdarpan/ingestion": patch
---

Work the queue from seven newly ingested CAG reports to zero, correcting
thirteen figures a person had to read.

Thirteen entries are added to `data/reference/cag-fact-corrections.json`, each
naming its amount the way the source writes it and saying why:

- **Three where a unit is separated from its figure.** `₹ 2,184.19 कोटी ते
₹ 3,093.40 पर्यंत` states a range whose unit sits on one end only, and
  `₹ 13,518.30 (96.85 per cent) crore` puts a parenthetical between the two.
- **Two more `core`-for-crore misspellings**, both confirmed against the same
  increase stated in crore elsewhere in the document.
- **Eight figures the source states in plain rupees** — per capita GSDP, a
  guarantee fee of ₹2 per ₹100, an actual amount behind a rounded one — on pages
  whose captions declare crore, so the parser rightly refused them.

Where a scale had to be inferred it was taken from the page's own caption rather
than from the magnitude: pages 287, 288 and 376 declare `(₹ in crore)`, one of
them with backticks standing where the `₹` should be.

Four `contractor_reference` facts verified before ADR-033 are revised to
rejected. Left published they would have been the only firm names a reader could
reach, which is precisely what that decision withholds.
