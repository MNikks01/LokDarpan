# ADR-039 · Tesseract, and not yet into the ledger

**Status:** Accepted · **Date:** 2026-09-04 · **Decides what** [`038-the-ocr-engine-is-not-the-source-of-truth.md`](./038-the-ocr-engine-is-not-the-source-of-truth.md) **left open** · **Evidence:** [`ocr-evaluation-report.md`](../04-data-engineering/ocr-evaluation-report.md)

## Context

`038` built the boundary and refused to say whether either engine was good
enough, because nothing had been measured. This decides on measurements taken
over this corpus — 4,586 pages of CAG audit reports — and not on any project's
own accuracy claims.

The premise that prompted the work turned out to be wrong in a way worth
recording. The brief named 522 unread pages. Rendering all 522 and measuring the
raster shows **428 are blank, 65 are report covers, 9 are photographs, 9 are
divider sheets, and 11 are pages of writing.** The unread half of this corpus is
eleven pages, not five hundred.

## Decision

**Tesseract is the engine.** 2.3 s/page against PaddleOCR's 472 s/page on the
same page, with comparable character output. PaddleOCR could not be run over the
corpus on this hardware at all; that is a throughput finding, not an accuracy
one, and it is recorded as such.

**OCR output does not enter the ledger yet.** On 104 pages of trustworthy ground
truth, the production extractor run over Tesseract's text produced **49 amounts,
49 of them correct, none false** — 100% precision at 41.5% recall. That precision
is the required posture and it is not luck: the extractor refuses an amount whose
rupee mark it cannot read, and Tesseract reads that mark 44.1% of the time.

On the eleven pages OCR exists for, it recovers 7,252 characters at 0.948 mean
confidence and **zero money facts**, because it reads no rupee sign on any of
them. Wiring that into the ledger would add nothing and would introduce a path
by which a lost scale word — `कोटी` read as `कोर्टी`, observed once in 47 matched
amounts — turns a crore into a rupee, seven orders of magnitude, in a
well-formed small amount the extractor cannot question.

**The next investment is not OCR.** Scoring exposed a third class of mojibake in
the ledger itself: **115 pages whose text layer writes a backtick where the
document prints ₹**, none of which `glyph_substitution` flags, because that
measure looks for Latin letters inside Devanagari words and a backtick before a
digit is neither. Those pages need no engine, are currently counted as read and
empty, and hold the same kind of figures OCR is being built to reach.

## Consequences

The OCR service stays as `038` built it — a witness that is not called. The
benchmark harness stays with it, so the next engine, or the next Tesseract
version, is measured the same way rather than argued about.

Two bounded pieces of work now have measurable targets: rupee-mark recognition
(44.1%, measured over 170 occurrences) and backtick-layer detection (115 pages,
a regular expression away from visible).

## What would reverse this

**A corpus with scanned financial tables.** This one has none — the photographic
plates are site photographs. Ingesting a state whose reports are scanned would
change the arithmetic entirely, and the harness would say so.

**A GPU.** PaddleOCR was excluded on throughput measured on CPU. Its recognition
may be better; one page is not evidence either way, and its confidence on that
page was higher than Tesseract's.

## Rejected: repairing the rupee mark by inference

A mark immediately before a number, on a page that states amounts elsewhere,
could be read as a rupee sign. It would lift recall sharply and it is refused
here. The project's rule is that a figure is read from the source or not at all,
and "the character before this number was probably a currency symbol" is an
inference about a government figure's magnitude dressed as a repair. If the mark
is to be recovered it will be by teaching the engine to see it, and measured.
