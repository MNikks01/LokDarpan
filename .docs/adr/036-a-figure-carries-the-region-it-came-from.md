# ADR-036 · A figure carries the region it came from

**Status:** Accepted · **Date:** 2026-09-04 · **Builds on** [`035-a-text-layer-can-be-present-and-wrong.md`](./035-a-text-layer-can-be-present-and-wrong.md)

## Context

A fact has been traceable to a page since the first CAG load, and a page is not
a small thing: these reports run to 220 pages of dense audit tables, and a
citation of "page 83" leaves a reader to find the figure themselves. Worse, the
evidence string stored beside a fact is a _window of text_, and a window cannot
be pointed at — searching the page for it finds the wrong occurrence whenever a
figure repeats, which on a tabular page is most of the time.

`034` and `035` both turned on the same root problem: **we could not see what
the extractor was looking at.** Two scale errors of seven orders of magnitude
reached the ledger, and each was found by reading pages by hand.

The source document image is the source of truth. The text layer is one reading
of it, and this project has now twice been wrong about what that reading said.

## Decision

**Every fact stores the region of the page its figure occupies**, in the
coordinates the PDF itself states — origin bottom-left, unscaled points —
alongside the page's own width and height so the region can be placed without
re-opening the file.

Three things follow, and each is load-bearing:

**pdf.js text items are stored, not discarded.** `document_text_item` records
every item's sequence, its character span in the stored page text, and its box.
The page text is rebuilt from exactly those items, so a character offset is
addressable geometry rather than a guess.

**Offsets are carried, never recomputed.** Sentence splitting collapses
whitespace, so an offset into a sentence addresses nothing stored.
`locatedSentencesOf` carries a per-character map back to the page. Re-deriving
the position by searching for the matched text was the available shortcut and is
precisely the bug this replaces: `around()` once searched pages for a paise
string that never appears in them, and showed 493 decided facts evidence that
did not contain their own figure.

**Geometry is not part of a fact's identity, and not part of what a reviewer
decided.** A box says where on the page a figure the reviewer already read is
sitting. So it is backfilled onto rows of any status, without a single candidate
being re-offered. Gating the backfill behind `unverified` — which the first
implementation did — would have left every decided fact, the only ones a reader
can reach, as the ones with no region to show.

## Consequences

5,747 facts across 4,586 pages carry a region. A sample of 400 verified facts
was checked by reading the text under each stored box and converting it back
through the parser's own conversion: 400 of 400 hold their own fact's figure.

This is the foundation the OCR work needs. An engine's output can be compared
against the region it claims to have read, and a disagreement between two
engines can be localised rather than merely counted — which is what makes
"never resolve disagreement by majority vote unless the evidence is
independently verified" implementable rather than aspirational.

## What this does not establish

The region is derived from the text layer, so on the four documents `035`
measured as mojibake it locates a figure inside text that is itself
mis-decoded. The box is right about _where_; the characters remain wrong. Those
pages stay withheld.

101 of 4,586 pages have no text items at all. Facts do not arise from them
because no text does — they are the pages awaiting OCR, not pages that failed to
locate.

## Rejected: re-deriving the region at read time

Storing offsets only, and computing boxes when a page is rendered, keeps the
schema smaller. It also makes every reader's highlight depend on re-running the
extractor against bytes that may by then be parsed by a different pdf.js. A
figure's provenance must not change because a dependency was upgraded.
