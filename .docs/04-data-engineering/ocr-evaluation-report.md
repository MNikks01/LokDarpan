# OCR evaluation — measured on this corpus, not on claims

**Date:** 4 September 2026 · **Corpus:** 20 CAG audit reports, 4,586 pages · **Engines:** Tesseract 5.5.3 (leptonica 1.87.0), PaddleOCR 3.7.0 / PaddlePaddle 3.3.1

Increment 2 built the boundary and deliberately made no accuracy claim. This
measures. Every number below comes from running the engines over pages of this
corpus; none is repeated from any project's documentation.

## The headline: the 522 unread pages are not 522 pages of unread figures

`document_page.content IS NULL` counts 522 pages. Rendering every one of them
and measuring the raster — no recognition, just ink, images and layout — gives:

| What the page is                                         |  Pages |    Share |
| -------------------------------------------------------- | -----: | -------: |
| **blank** — almost no mark on the sheet                  |    428 |    82.0% |
| **dark-page** — a report cover printed on a solid ground |     65 |    12.5% |
| **text** — rows of writing                               | **11** | **2.1%** |
| **sparse** — a divider sheet with a rule round it        |      9 |     1.7% |
| **plate** — a photograph covering the sheet              |      9 |     1.7% |

**Eleven pages.** They are in three documents, and one of them —
Maharashtra Report No. 5, page 110 — is a genuine Executive Summary stating
₹4,624.01 crore, ₹3,354.59 crore and ₹1,616.26 crore in prose, with no text
layer at all. It renders crisply, so this is a font-mapping failure rather than
a scan.

This classification was wrong twice before it was right, and both times the
error was caught by rendering a page and **looking at it**: a dark cover was
first called a table because 90% of it is ink, and a grey divider sheet was
called text because its border is. Summary statistics did not reveal either.

## What the engines actually do

### Accuracy, against the page's own text layer

Ground truth is the PDF text layer of 120 sampled pages, 40 per script. The
layer is exact — it is what the file itself states — so no one transcribed
anything. **16 of the 120 were excluded** because the layer is itself broken
(see the last section), leaving 104.

| Tesseract 5.5.3 | pages | s/page | word recall | word prec | numeral recall | numeral prec |
| --------------- | ----: | -----: | ----------: | --------: | -------------: | -----------: |
| all             |   104 |    2.3 |       68.0% |     69.2% |          67.8% |        84.1% |
| latin           |    39 |    2.6 |       69.1% |     72.3% |          64.7% |        74.8% |
| devanagari      |    40 |    2.0 |       63.6% |     66.6% |          71.3% |        88.4% |
| mixed           |    25 |    2.2 |       73.5% |     68.5% |          67.0% |        91.8% |

Word figures are depressed by reading order — an engine groups lines, a text
layer emits draw operations — so they measure layout as much as recognition.
The figure measures below are order-insensitive and are the ones to read.

### The measure that matters: what the production parser does with the text

`extractFacts` — the real extractor, not a model of it — run over the OCR text
and over the page's own text, and the two sets of amounts compared.

| Tesseract  | amounts on page | found | correct | **false** | recall | **precision** |
| ---------- | --------------: | ----: | ------: | --------: | -----: | ------------: |
| all        |             118 |    49 |      49 |     **0** |  41.5% |    **100.0%** |
| latin      |              54 |     1 |       1 |         0 |   1.9% |        100.0% |
| devanagari |              35 |    27 |      27 |         0 |  77.1% |        100.0% |
| mixed      |              29 |    21 |      21 |         0 |  72.4% |        100.0% |

**Zero false figures.** Not one amount was extracted from OCR text that is not
on the page. That is the posture the brief demands — a false numerical
extraction is worse than an omission — and it is not an accident of the engine.
It is the extractor refusing: it needs a rupee mark, and where the mark is
misread the amount is simply not offered.

For amounts stated with a scale word, where an error is an error of orders:
recall 38.7%, precision 100.0%, 43 of 111 recovered.

### The bottleneck is one glyph

Tesseract reads **the rupee sign correctly 44.1% of the time** (75 of 170
occurrences across the sampled pages). Where it fails it substitutes `=`, `2`,
`रे`, `२`, `(%` or `%`.

That single failure explains the whole recall picture. On latin pages, which
state ₹ most often, figure recall is **1.9%** — one amount out of fifty-four.
The digits themselves are read correctly; on the Executive Summary page,
"4,624.01 crore", "3,354.59 crore" and "1,616.26 crore" are all exact, and only
the mark before them is wrong.

There is a second, rarer failure that is more dangerous. On 47 scaled amounts
matched by their digits, the scale word survived 46 times and was lost once
(2.1%) — `कोटी` read as `कोर्टी`, or as `Hier?`. A lost scale word turns a crore
into a rupee: **an error of seven orders of magnitude**, and one the extractor
cannot see, because what it receives is a well-formed small amount.

### The 11 pages OCR exists for

|                           |            |
| ------------------------- | ---------- |
| pages read                | 11 of 11   |
| characters recovered      | 7,252      |
| mean word confidence      | 0.948      |
| time                      | 0.9 s/page |
| rupee marks read          | **0**      |
| **money facts recovered** | **0**      |

Tesseract reads these pages well. It recovers none of their figures, because it
reads no rupee sign on any of them.

### PaddleOCR: not viable here, on one page of evidence

| Same page, doc 3857 p112 | characters | confidence | seconds |
| ------------------------ | ---------: | ---------: | ------: |
| page text layer          |      1,464 |          — |       — |
| Tesseract 5.5.3          |      1,304 |      0.947 |    1.47 |
| PaddleOCR 3.7.0          |      1,386 |      0.983 |  471.77 |

**321× slower on CPU.** A 12-page run was started and produced nothing in fifty
minutes before the process was lost. At 472 s/page, the 104-page ground-truth
set would take fourteen hours.

**This is one page.** It is not an accuracy finding and is not reported as one:
PaddleOCR's recognition may well be better, and its confidence on this page was
higher. What it establishes is a throughput fact — on this hardware, without a
GPU, PaddleOCR cannot be run over a corpus of this size, so no accuracy
comparison could be gathered.

## A third kind of mojibake, invisible to the measure built for it

Scoring exposed something about the **ledger**, not about OCR. On 16 of 120
sampled pages the text layer writes a backtick where the document prints ₹, and
`कोट(` where it prints कोटी. Six of the ten figures that first looked like OCR
errors were the engine reading a figure correctly that the broken layer had lost.

Across the whole corpus:

|                                                  |   Pages |
| ------------------------------------------------ | ------: |
| pages with a text layer                          |   4,064 |
| a mark stands in for the rupee sign              | **115** |
| of those, flagged by `glyph_substitution`        |   **0** |
| a mangled crore stem (`कोट` not followed by ी/ि) |     256 |

`glyph_substitution` (ADR-035) looks for Latin letters wedged into Devanagari
words. A backtick before a digit is neither, so **none of these 115 pages is
flagged**. They look like clean pages that happened to contain no figures.

Nothing wrong has been published — the parser refuses what it cannot read, so
these are omissions. But the coverage story is wrong, and a page recorded as
read-and-empty is a different claim from a page recorded as unreadable.

## What this decides

**Tesseract, not PaddleOCR**, for this hardware. 2.3 s/page against 472,
comparable character output, and 100% figure precision.

**OCR does not yet feed the money extractor.** It recovers no figures from the
pages it exists for, and the one class of error it can cause — a lost scale word
— is invisible downstream. The refusal behaviour is correct and stays.

**Rupee-mark recognition is the next question, and it is small.** A Tesseract
user-words or character-set adjustment, or a targeted post-read repair confined
to a mark immediately preceding a number on a page whose layer is known broken,
is a bounded piece of work with a measurable target: 44.1% → higher, measured
the same way.

**The 115-page backtick class is the better next investment than OCR.** Those
pages have a text layer, need no engine, and are being silently counted as read.
Detecting them costs a regular expression; the figures behind them are the same
figures OCR is being built to reach.

## What this does not establish

- **Nothing about scanned pages.** Ground truth is digitally-born text, which is
  easier than a scan. These numbers are an upper bound. This corpus contains no
  scanned financial tables to measure against — the nine photographic plates are
  site photographs.
- **Nothing about PaddleOCR's accuracy.** One page, and a throughput wall.
- **Nothing about the other 17 Indian scripts.** This corpus is Devanagari and
  Latin. Coverage of Tamil, Telugu, Bengali and the rest remains unverified.
- **Nothing about table structure.** No table-reconstruction measure was taken.

## Reproducing this

```bash
pnpm --filter @lokdarpan/ingestion ocr:manifest        # choose the pages
cd services/ocr && .venv/bin/python bench/characterise.py
.venv/bin/python bench/run.py groundTruth --engines tesseract \
  --out ../../data/benchmarks/readings-tess-groundtruth.jsonl
pnpm --filter @lokdarpan/ingestion ocr:score           # score with the real parser
```

The page sample is chosen by a hash of each page's identity rather than at
random, so a second run measures the same pages and a change in the numbers is
a change in the engines.
