---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": patch
---

Measure how much of a page's text layer is not the text, and withhold facts
whose evidence cannot be read.

`pages_without_text` counts pages with no text layer and cannot see a text layer
that is present and wrong. Four of the ten CAG reports map glyphs through a
non-Unicode font, so their text extracts as mojibake — Latin letters wedged into
Devanagari words. The page renders correctly to a reader; only the extraction is
garbage. Digits survive that and unit words do not, which is exactly what turned
₹2.12 crore into ₹1.

Migration 0015 adds `document_page.glyph_substitution`, a ratio rather than a
flag so the threshold can be revisited without re-extracting. It is NULL where
there is too little Devanagari to judge, because an English page is not evidence
of a clean font mapping. Clean and broken separate cleanly: 99% of judged pages
above the threshold in three documents, 85% in a fourth, 0% in the other six.

824 candidates are withheld as a class, each with the reason on the fact. None
had been decided. The rows remain, so an OCR pass over the original bytes can
revisit them.

Also fixes `--ids` being silently truncated: `pendingReview` defaults to 500,
which is right for walking a queue and wrong for a set someone named. Asking for
824 named facts decided the first 500 and reported success.
