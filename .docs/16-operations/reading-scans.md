# Reading scanned pages

**Written:** 6 October 2026 · **Decisions:** [ADR-038](../adr/038-the-ocr-engine-is-not-the-source-of-truth.md),
[ADR-071](../adr/071-a-reading-sits-beside-the-page-never-in-its-place.md),
[ADR-072](../adr/072-a-fact-read-from-a-scan-is-a-candidate-never-a-fact.md) · **Code:** `services/ocr`,
`services/ingestion/src/ocr/`

A page with no text layer is read by the OCR service, and what each engine saw is stored beside the
page in `page_reading`, never in its text. Facts are then read from those readings as **candidates
for review**. A verified one is published marked as read from a scan, with its engine and legibility.

Everything here runs **locally**. Production holds no readings; reviewed facts reach it by promotion.

## 1. Start the OCR service

```bash
cd services/ocr
uv pip install --python .venv -e ".[serve,tesseract]"      # once; add ",paddle" for PaddleOCR
PYTHONUNBUFFERED=1 .venv/bin/uvicorn --app-dir src "lokdarpan_ocr.service:create_app" --factory --port 8000
curl -s -m 600 localhost:8000/capabilities                  # warm up; lists each engine and its version
```

Wait for `/capabilities` to answer before sending reads. Building PaddleOCR takes a while, and the
first request waits for it.

## 2. Make sure the bytes can be read

OCR reads a document's bytes from the raw store and verifies them against the sha256 first. A row
loaded before 29 September 2026 may have `stored_in` NULL even though its bytes are still on disk.
Record where they are with `raw:adopt`, never by hand (`raw-store.md` §4):

```bash
set -a && . ./.env.local && set +a
pnpm --filter @lokdarpan/ingestion raw:adopt -- --source=cag
```

## 3. Read the pages

```bash
pnpm --filter @lokdarpan/ingestion ocr:read -- --source=cag --engines=tesseract --languages=eng,mar
# for the Maharashtra agencies, the collector does the same with:
pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=mhada --extract-only --ocr --engines=tesseract
```

- **Engines.** Tesseract reads a page in about 5 s. PaddleOCR takes about 260 s at 300 dpi on a
  laptop CPU, and loads only its English model (it records that, ADR-071 addendum). Use
  `--engines=tesseract` unless a second opinion is what you need.
- **Timeout.** A read is given its base time plus 360 s per page per engine. `--ocr-page-seconds=`
  changes the allowance.
- **Safe to repeat.** A page an engine has read is not sent to it again. A refusal is asked again.
- **A client that gives up stops the read** after the page in progress. While PaddleOCR is computing
  a page, the service can't answer anything else (it holds the GIL).

## 4. Read facts from the readings

Each source's own parser reads its readings in the same pass as its text layer. The two must be
loaded together, or each would retire the other's facts.

```bash
pnpm --filter @lokdarpan/ingestion ingest:agency -- --source=mhada --extract-only   # notices
pnpm --filter @lokdarpan/ingestion extract:cag-facts -- --dry-run                     # CAG: see first
pnpm --filter @lokdarpan/ingestion extract:cag-facts                                  # then for real
```

A scan fact is always `needs_review`. Its confidence is the parser's times the engine's confidence
in the figure's words, and `reading_confidence` keeps the engine's part on its own. `--dry-run`
reconciles every report in a transaction and rolls it back; use it before any CAG parser change.

## 5. Review

Scan facts are reviewed against the page **image**, not the text. The review terminal can't show
images, so build the local sheet: each candidate beside a crop of its page with the value outlined.
It is a local file only. Tender details are withheld from publication, and a hosted page would
republish them. The sheet's generator is not in the repository yet. On 6 October 2026 it was a
one-off script that rendered crops with the OCR service's `pypdfium2`.

```bash
REVIEWER="<your name>" pnpm --filter @lokdarpan/ingestion review -- --ids=<the candidates' ids>
```

## What was found, 6 October 2026

| Source | Pages with no text | Read                    | Candidates | Note                                                     |
| ------ | -----------------: | ----------------------- | ---------: | -------------------------------------------------------- |
| MHADA  |                 26 | 26 by Tesseract         |          7 | Marathi schedule; 7 of 10 notices' labels damaged by OCR |
| MSIDC  |                 12 | 12 (3 found no text)    |         24 | One reference number is handwritten                      |
| CAG    |                614 | 614 (530 found no text) |          0 | 530 blank pages, 84 covers; no figure on any (ADR-038)   |

The 31 candidates are unreviewed. The provisional legibility threshold (`LEGIBLE_FROM`, 0.80) is
to be confirmed against that review.
