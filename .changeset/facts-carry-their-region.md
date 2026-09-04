---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": patch
---

Give every extracted fact the region of the page its figure occupies.

A citation of "page 83" of a 220-page audit report leaves a reader to find the
figure themselves, and the evidence window stored beside a fact cannot be
pointed at — searching a page for it finds the wrong occurrence whenever a
figure repeats, which on a tabular page is most of the time.

Migration 0016 stores `document_page.width`/`height`, a `document_text_item` row
per pdf.js text item (its character span in the stored page text and its box),
and `document_fact.bbox_x0..y1`, constrained to all-four-or-none. Coordinates are
kept as the PDF states them — origin bottom-left, unscaled points.

The page text is rebuilt from exactly those items, so a character offset is
addressable geometry rather than a guess. `locatedSentencesOf` carries a
per-character map from each sentence back to the page, because whitespace
collapsing makes a sentence offset address nothing stored.

Geometry is not part of a fact's identity, so boxes backfill onto rows of any
status without re-offering a candidate or disturbing a decision. 5,747 facts now
carry a region; 400 sampled verified facts were checked by reading the text under
each stored box and converting it back through the parser's own conversion, and
400 of 400 hold their own figure.

`reprocess:cag` re-reads documents from the content-addressed raw store instead
of the network, so re-extraction no longer costs the publisher a multi-megabyte
download per document.

Four monetary facts verified and sixteen candidates rejected: policy thresholds
are criteria rather than sums (ADR-025), a per-capita GSDP and a fee of ₹2 per
₹100 are rates rather than amounts, and role references are never published
(ADR-033).
