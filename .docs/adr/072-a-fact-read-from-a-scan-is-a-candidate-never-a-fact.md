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

## Addendum · 2026-10-06, the wording

The sentences a reader would see are written and approved (`apps/web/src/copy/figures.ts`,
`scanFactCopy`). A scan fact carries a label, an explanation naming the engine and version, and
the engine's doubt worded as **legibility** ("clearly / not clearly legible to the software"),
never as a percentage. A number beside a government figure reads as the chance the figure is
right; the engine's confidence measures only how clearly the characters could be seen.

The hold on publishing stays until three things exist:

1. **The engine's confidence, stored on its own.** `extraction_confidence` is the parser's
   confidence times the engine's, so the engine's part can't be recovered from it reliably. The
   legibility sentence needs the engine's figure itself, and the threshold between "clearly" and
   "not clearly" is a separate decision, to be made on reviewed facts.
2. **A view that carries it.** `published_fact` gains the reading's engine, version and that
   confidence, and stops withholding facts read from a scan.
3. **A page that shows it.** The document page shows `scanFactCopy` with every such figure, and
   uses `pagesWithoutTextSomeRead` in place of `pagesWithoutText` once any figure on the document
   was read from a scan.

Until all three ship together, nothing read from a scan reaches a reader. Every scan fact so far
is a tender-notice fact, and those are withheld anyway while publishing tender details awaits
permission.

## Addendum · 2026-10-06, shown

The three things the hold waited for now ship together (migration 0044), and the hold is lifted:

1. **`document_fact.reading_confidence`** stores the engine's least confidence among the words of
   the value, apart from `extraction_confidence`. The parser fills it on every run, so facts read
   before 0044 gain it when the parser next runs.
2. **`published_fact`** carries `reading_engine`, `reading_engine_version` and
   `reading_confidence`. It publishes a verified scan fact only once that confidence is measured.
3. **The document page** shows `scanFactCopy` with every such figure (`ScanReadingNote`), and
   switches to `pagesWithoutTextSomeRead`. `/api/v1/documents/:id` carries the same `scanReading`,
   because both read one domain type: a figure cannot reach a reader through either without it.

**Legibility is a threshold on the engine's confidence, provisionally 0.80** (`LEGIBLE_FROM`). The
first 31 readings leave a gap between 0.73 and 0.86. The threshold is to be confirmed against the
first review. It measures how clearly the characters could be seen, not whether the figure is
right: one date read correctly scored 0.47.

**What a reader sees today does not change.** Every scan fact so far comes from MHADA and MSIDC
tender notices, which are withheld whole until their publishers permit republication
(`mayRepublish`). The first scan facts a reader can see will come from a licensed source, such
as the 522 scanned pages of CAG reports ADR-038 counted, once they are read.
