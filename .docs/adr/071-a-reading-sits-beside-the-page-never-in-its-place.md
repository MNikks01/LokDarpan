# ADR-071 · A reading sits beside the page, never in its place

**Status:** Accepted · **Date:** 2026-10-06 · **Answers an open question of**
[`038-the-ocr-engine-is-not-the-source-of-truth.md`](./038-the-ocr-engine-is-not-the-source-of-truth.md)
· **Migration:** `database/migrations/0042_a_page_read_by_an_engine_says_which.sql`

## Context

ADR-038 built the OCR service and deliberately left one question for later: how a reading enters the ledger.
It deferred the schema "until there is a reading worth storing". The agency tender notices
collected for Maharashtra (MHADA, MSIDC) are now such a case. Many are scans, so their pages are loaded
with `document_page.content` NULL and no fact can be read from them. A run of the service against a
held MHADA notice produced readings with full provenance from both self-hosted engines.

The risk ADR-038 named is unchanged. A reading is a guess, and nothing in the ledger may make a guess
look like what the publisher typed.

## Decision

**Store a reading in its own table, `page_reading`, keyed to the page it read. `document_page` is
never written to.** A scan's `content` stays NULL, because that is what the file states, and
`pages_without_text` keeps counting it.

- **Every reading carries its provenance or it cannot be stored.** That means the engine, its exact
  version, its model versions, the languages it was asked to read and the render it was read from
  (DPI, raster size, page box, rotation). A check constraint enforces this, not a code review.
- **One row per engine.** Two engines reading the same page leave two rows, and there is no column
  for a merged reading.
- **An absence is stated, in three distinct forms.** A refusal (engine not installed, page would
  not render) is a row with a reason and no content. A reading that found no text is a row with
  empty content. A page nobody tried has no row. A refusal is not treated as a reading, so the next
  run asks again, and a later reading by that engine withdraws it.
- **Re-runs are idempotent per configuration.** The same engine, version, languages and DPI produce
  the same reading, stored once. A new engine version produces a new reading, kept beside the old.
- **Words keep their confidence.** `page_reading_item` uses `document_text_item`'s geometry (a
  character span and a box in PDF points, origin bottom-left, unrotated) so the figure-locating
  code can read either one, and each word keeps the confidence the engine gave it.

The ingestion side is `services/ingestion/src/ocr/read-pages.ts`, run by `ingest:agency --ocr`.
It sends only pages with no text layer that some installed engine has not yet read, and it
re-verifies the bytes against their hash from the raw store before sending. The flag is off by
default: the service is optional infrastructure, and a run without it is a complete run.

## What this deliberately does not decide

- **Whether a reading may yield a fact.** Nothing reads `page_reading` yet. No fact is extracted
  from a reading and nothing about readings is published. Doing either needs the third
  confidence, extraction confidence, attached per word, plus wording that tells a reader the
  figure came from a scan.
- **What to do when engines disagree.** This is still open, as ADR-038 left it. The schema keeps
  both readings, so the evidence for that rule will exist when it is written.
- **Production.** The migration is additive. No reading has been written outside the local
  database.

## Alternatives considered

- **Write the reading into `document_page.content`.** This is the simplest option, and it makes a
  scan indistinguishable from a typed page: every downstream reader would treat a guess as the
  file's own text.
- **A JSONB column of readings on `document_page`.** One row per engine is what makes provenance
  enforceable by constraint and keeps re-runs idempotent. A JSON blob can enforce neither.
- **A text layer added with OCRmyPDF.** Already rejected in ADR-038: it modifies the retrieved
  bytes, and the raw store keeps those immutable.

## Consequences

- A scanned notice's pages now have a place to keep what an engine saw, with enough provenance to
  reproduce it. The page's own text is still exactly what the publisher shipped.
- Storage grows with every engine and every engine version. That is the price of keeping
  readings reproducible rather than overwriting them.
- The words of a reading cascade with their reading, and the reading cascades with its page. A
  document removed from the ledger takes its readings with it.
