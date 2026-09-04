# ADR-040 · A printed glyph may be decoded; a guessed one may not

**Status:** Accepted · **Date:** 2026-09-04 · **Draws the line** [`039-tesseract-and-not-yet-into-the-ledger.md`](./039-tesseract-and-not-yet-into-the-ledger.md) **left implicit** · **Builds on** [`036-a-figure-carries-the-region-it-came-from.md`](./036-a-figure-carries-the-region-it-came-from.md)

## Context

Benchmarking OCR exposed a defect in the ledger rather than in OCR. On some
pages the text layer emits a backtick where the document prints ₹, and `कोट(`
where it prints कोटी:

```
what the layer says : ` 40.80 कोट(चे
what the page prints: ₹ 40.80 कोटीचे
```

`glyph_substitution` (`035`) counts Latin letters wedged into Devanagari words.
A backtick before a digit is neither, so **all 134 affected pages scored clean**
and were recorded as read-and-empty. That is a different claim from unreadable,
and **534 amounts** sit behind it.

`039` refused to repair a currency mark on OCR output, in terms that would
appear to forbid this too: _"the character before this number was probably a
currency symbol" is an inference about a government figure's magnitude dressed
as a repair_. Deciding whether that applies here is the whole of this ADR.

## Decision

**It does not apply, because the glyph is printed and can be looked at.**

The two cases differ in what evidence exists, not in how confident anyone feels:

|                                    | OCR output (`039`)                                                     | Text layer (here)                                     |
| ---------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| What the mark is                   | an engine's guess at a glyph it could not recognise                    | a font mapping that dropped a known glyph             |
| Is the true character recoverable? | No — the ink is all there is, and the engine already failed to read it | **Yes** — the glyph is printed and rendered correctly |
| Can it be checked?                 | Only by another guess                                                  | By rendering the region the fact stores and looking   |

`036` is what makes the second column possible. Every fact carries the region it
came from, so the exact characters can be rendered. They were: one site in each
of the twelve affected documents, and **eleven showed ₹ unambiguously**. The
twelfth (document 3848, page 46) is a rotated table where the crop caught the
digits sideways and the mark was not visible — it is recorded as unverified, not
as verified.

Three decoded figures were then checked against the printed page end to end:
₹13,627.80 crore, ₹339.73 कोटींची and ₹16.30 crore, each rendered from the box
the fact stores, each matching the value the parser read.

So the mark is decoded, under three constraints:

**Page-scoped.** A page must carry at least two such marks before any of them is
read as a currency symbol. One backtick is punctuation — a quoted word — and
decoding it would let `` `own funds` `` become a government figure.

**Lower confidence, always.** A decoded amount is recorded at 0.5 where a stated
one is 0.8, and at 0.3 where a stated one is 0.6. The glyph was read from the
page rather than resolved by the text layer, and a reviewer is entitled to know
which before publishing.

**Reviewed like everything else.** 496 candidates entered the queue. None is
published until a person decides on it, exactly as with every other candidate
this repository has ever produced.

## Consequences

Migration 0018 records `document_page.substituted_currency_marks`, counted rather
than flagged so the threshold can be revisited without re-extracting. 134 pages
carry at least one mark; 96 are at or above the decoding threshold; 534 marks in
total; **none** of them flagged by `glyph_substitution`.

The triage tool had to learn the same decoding. Its self-check re-derives an
amount from the evidence with the parser's own pattern, and being blind to the
mark it reported **all 469 decoded facts as "the stored value appears nowhere in
its own evidence"** — a defect flag on every candidate of a class that is not
defective, which buries the real mismatches rather than surfacing them. After
teaching it the same rule: 0 mismatches, 167 confirmed, 292 in context, 22
without a value, 15 ambiguous.

That is the recurring lesson of this codebase, in a third form: **a check that
cannot reproduce the reading it is checking reports the reading as the defect.**

## What this does not license

**It is not a general repair of unreadable characters.** The rule is narrow by
construction: this mark, before a number, on a page that shows the defect
repeatedly, with the glyph verifiable by rendering the stored region. A mark that
cannot be rendered and looked at is not a candidate for decoding.

**It does not touch `कोट(`.** The mangled scale word is left exactly as it is.
Where the unit is unreadable the amount is refused, as before — a figure whose
scale cannot be established must not acquire one.

**It does not publish anything.** 496 candidates await a person.

## Rejected: treating the mark as ₹ everywhere

Reading a lone backtick as a currency symbol on any page would have recovered a
handful more amounts and cost the distinction the decision rests on. A page that
shows the defect once shows it by accident; a page that shows it repeatedly has a
broken font mapping, and only the second is evidence.
