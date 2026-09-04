---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": patch
---

Read the rupee mark on pages whose font mapping dropped it.

Some documents emit a backtick where the page prints ₹ — `` ` 40.80 कोट(चे `` for
₹ 40.80 कोटीचे. `glyph_substitution` counts Latin letters wedged into Devanagari
words, and a backtick before a digit is neither, so all 134 affected pages scored
clean and were recorded as read-and-empty. That is a different claim from
unreadable, and 534 amounts sit behind it.

ADR-039 refused to repair a currency mark on OCR output. This is admissible where
that is not, and ADR-040 draws the line: there the mark is an engine's guess at a
glyph it could not recognise, and nothing can recover the true character; here the
glyph is printed, and since ADR-036 every fact carries the region it came from, so
it can be rendered and looked at. It was — one site in each of the twelve affected
documents, eleven showing ₹ unambiguously, the twelfth a rotated table where the
crop caught the digits sideways and which is recorded as unverified. Three decoded
figures were then checked end to end against the printed page.

The decoding is page-scoped: a page must carry at least two such marks before any
is read as a currency symbol, because one backtick is a quoted word. A decoded
amount is recorded at confidence 0.5 where a stated one is 0.8, and reaches a
reader only after review. 496 candidates entered the queue; none is published.

Migration 0018 records `document_page.substituted_currency_marks`, counted rather
than flagged.

The triage tool had to learn the same rule. Blind to the mark, its self-check
reported all 469 decoded facts as "the stored value appears nowhere in its own
evidence" — a defect flag on every candidate of a class that is not defective.
After: 0 mismatches, 167 confirmed, 292 in context, 22 without a value, 15
ambiguous.
