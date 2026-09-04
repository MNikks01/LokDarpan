# ADR-035 · A text layer can be present and wrong

**Status:** Accepted · **Date:** 2026-09-04 · **Closes the gap left open by** [`034-the-font-mapping-fragments-what-patterns-assume.md`](./034-the-font-mapping-fragments-what-patterns-assume.md)

## Context

`document.pages_without_text` counts pages with no text layer. It is the
coverage question the pipeline knew to ask, and it cannot see the case that
actually cost us: **a text layer that is present and wrong.**

Four of the ten CAG reports held map glyphs through a non-Unicode font. Their
text extracts as mojibake — Latin letters and ASCII symbols wedged into
Devanagari words:

```
मेसस! इंडो अलाइड <ोटन फूस <ाय}हेट KलKमटेड
should be
मेसर्स इंडो अलाइड प्रोटीन फूड्स प्रायव्हेट लिमिटेड
```

The page **renders correctly to a reader**. Only the extracted text is garbage,
so provenance to the page survives and the document is not defective — our
reading of it is.

This is not merely lost coverage. **Digits survive mojibake and unit words do
not**, which is exactly the input that turns ₹2.12 crore into ₹1. Two scale
errors of seven orders of magnitude reached the ledger through it before it was
measured — `िोटी` and `कोट ीं`, both recorded in `034`.

## Decision

**Measure glyph substitution per page, store the ratio, and withhold facts whose
evidence cannot be read.**

- Migration 0015 adds `document_page.glyph_substitution`: substituted glyphs as
  a share of the page's Devanagari characters. A Latin letter or ASCII symbol
  directly adjacent to a Devanagari one is the signal — the two scripts do not
  mix inside a word, so where they appear to, the font mapping is broken.
- **A ratio, not a flag.** A boolean fixes the threshold at write time and
  cannot be revisited without re-extracting every document. The ratio is the
  measurement; what counts as unusable is a reading of it, and that reading will
  change as more font mappings are met.
- **`NULL` where the question does not arise** — no text, or too little
  Devanagari to judge. An English page is not evidence of a clean font mapping,
  and recording 0 would claim a measurement never made.

Measured across the corpus, clean and broken separate cleanly with nothing in
between:

| document                  | pages judged                     | above 0.02 |
| ------------------------- | -------------------------------- | ---------- |
| 3515, 3512, 3516          | 221 / 83 / 69                    | **99%**    |
| 3514                      | 52                               | **85%**    |
| 1, 3, 4, 3510, 3511, 3513 | 247 / 170 / 121 / 178 / 112 / 79 | **0%**     |

**824 candidates were withheld as a class**, each carrying the reason. None had
been decided, so nothing published is affected. The rows remain, so an OCR pass
over the original bytes — which the raw store keeps unchanged — can revisit them
with `--revise`.

## What found it, and what did not

The pattern did not find this, and neither did the triage. `selfCheck`
re-derives amounts with the _same_ pattern that produced them, so when the
pattern is wrong the arithmetic agrees with it: the fabricated ₹9, ₹26 and ₹54
of `034` sat in the `confirmed` partition, consistent and wrong.

What found it was **reading the implausible ones** — money facts under ₹1 lakh
with no rate qualifier, on the reasoning that a CAG report rarely states a
two-digit rupee finding unless it is a rate like "₹5 per record". That screen
surfaced `िोटी` within minutes of being applied.

A consistency check cannot catch an error in the thing it checks against. That
is the argument for keeping an implausibility screen in the review, and it is
recorded here because it is the more transferable half of this work.

## Consequences

- 1,332 pages measured, 1,108 declined as unjudgeable. Existing pages were
  backfilled from stored content, which is what extraction computes anyway.
- The review queue is 1,420, all from documents whose text layer is sound.
- Nothing yet _uses_ the ratio at render time. A reader shown a document's
  figures should eventually be told how much of it could not be read
  (`.docs/17-legal` rule 8); this supplies the number for that, and does not
  build the surface.
