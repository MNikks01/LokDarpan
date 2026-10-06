# ADR-072 · A fact read from a scan is a candidate, never a fact

**Status:** Accepted · **Date:** 2026-10-06 · **Answers an open question of**
[`071-a-reading-sits-beside-the-page-never-in-its-place.md`](./071-a-reading-sits-beside-the-page-never-in-its-place.md)
· **Migration:** `database/migrations/0043_a_fact_read_from_a_scan_names_the_reading.sql`

## Context

ADR-071 stores OCR readings beside the page. It left open whether a fact may be read from one.
Every MHADA notice collected so far is a scan, and so are some MSIDC pages. Until a reading can yield
a fact, those notices have no facts at all.

The first readings (Tesseract 5.5.3, 38 pages, 6 October 2026) show what such a fact would be:

- **Often right.** `तांत्रिक बोली उघडण्याचा दिनांक ०८.१०.२०२६, सकाळी १०.३०` is read exactly.
- **Sometimes wrong, in a way that looks right.** A reference comes out as
  `MSIDC/Mumbai/Tender/g4/2024`, with a letter where every other reference has a serial number.
  A date comes out as `०८.१९०.२०२६`.

A wrong value under a correct citation is the failure this ledger is built to prevent.

## Decision

**A reading may yield a fact, but only as a candidate a person checks. Even then, it is withheld
from readers until a surface can say the figure came from a scan.**

- **The fact names its reading.** `document_fact.page_reading_id` references the reading. A
  composite foreign key forces the reading to be of the same page the fact cites. Deleting a
  reading deletes its facts, decided or not, because a decision about a reading that no longer
  exists can't be re-checked.
- **It is always marked for review.** A line that would be `accepted` on a text layer is
  `needs_review` when read from a scan. The reason names the engine and version.
- **Its confidence is the engine's doubt about the value.** The parser's confidence is multiplied
  by the lowest word confidence among the value's words. Label words are excluded: the pattern
  matched the label, so the label was read as written. Including them dragged one clean date to 0.
  Excluding them, the three damaged references in the first run score lowest (0.25–0.36).
- **Its box is the value's words.** It is built from `page_reading_item`, in the same PDF points
  as a text-layer fact.
- **`published_fact` withholds it** even after verification. That view is the only thing the site
  reads facts from. No surface yet tells a reader that a figure was read by OCR, and the
  extraction-confidence wording that `CLAUDE.md` requires for this does not exist yet.
- **Only scans are read.** A reading is used only for a page with no text layer. On a page with
  text, an engine's reading would be a second opinion on what the publisher typed.
- **Text-layer and scan facts are reconciled in one pass per document.** The loader retires any
  undecided fact a run did not produce. Run separately, each pass would retire the other's facts.

**MHADA's Marathi schedule** is read for the labels seen in the corpus: publication, the last date
for bids, technical and financial bid opening, the pre-bid meeting, and the notice reference.
Devanagari digits are converted to ASCII for the value only; the raw text keeps them. Dates must
be printed with dots: a reading that turned a dot into a comma, or doubled a digit, is left
unread rather than repaired. A time is read only when the notice names the part of the day
(`सकाळी`, `सायंकाळी`, …) and the hour is one that part of the day can have. MHADA's amounts are
not read, because they sit in a per-work table. MSIDC's per-package amounts are skipped for the
same reason.

## Alternatives considered

- **Hold scans back until a second engine agrees.** ADR-038 rejects agreement as a way to settle
  a value. Two engines that agree are still not the page. A person comparing the value with the
  page image is the check that holds.
- **Mark scan facts only through `extraction_method`.** Every reader of the table, and every
  future surface, would have to parse a string. A column and a view filter cannot be forgotten.
- **Publish verified scan facts now.** A verified fact is no longer a guess, but the reader would
  not be told that a person checked an OCR reading, or how confident the reading was. That
  wording comes first.

## Consequences

- In the first run, 31 candidates were read from scans: 7 from MHADA (3 of 10 notices) and 24
  from MSIDC. All are local only and unpublished.
- 7 MHADA scans yield nothing: OCR damaged their labels. A better engine, or PaddleOCR's Marathi
  model, may recover them without changing anything here.
- Publishing a scan fact needs a later decision: the wording, and what the confidence shown to a
  reader means.
- The CAG load test empties the document tables with a cascading TRUNCATE. It now also locks
  `page_reading` and `page_reading_item`, which the cascade reaches through the new keys.
