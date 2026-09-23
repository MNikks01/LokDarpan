# ADR-046 · A script the parser cannot read is not a missing unit

**Status:** Accepted · **Date:** 2026-09-05 · **Extends** [`037-precision-is-judged-at-the-scale-the-source-states.md`](./037-precision-is-judged-at-the-scale-the-source-states.md)

## Context

Tamil Nadu was ingested as a third state, chosen because its reports are not in
Devanagari: the parser knows English scale words and Devanagari ones, so a
non-Devanagari state tests whether precision-first behaviour actually holds, or
whether it was only ever a property of the two scripts already handled.

It did not hold. Tamil Nadu publishes each report as **two separate PDFs** — one
Tamil, one English — rather than as two halves of one file, and the Tamil text
layer arrives in two damaged shapes:

- **Visual glyph order.** `ணைாடி` where Unicode spells `கோடி` (crore). Every
  character is present; the order is the order the glyphs are drawn in.
- **Mojibake.** `ேகா}` for the same word, Tamil mixed with Latin-1.

Both keep the digits intact and destroy the word beside them. The state's total
revenue receipts — `₹2,43,749.34 ணைாடி`, ₹2,43,749.34 **crore** — were read as
**₹2,43,749**. Wrong by seven orders of magnitude, and wrong in the same
direction and for the same reason as `₹ 2.12 िोटी` before it: an unqualified
amount is read as rupees, and the qualification was there all along in a form
the parser could not see.

Of 1,940 candidates extracted from the five Tamil documents, four were refused.

Two existing defences did not reach this. `UNREADABLE_UNIT` enumerates known
misspellings — `core`, `cr`, `कोटय` — and an enumeration cannot cover a script
nobody has enumerated. `glyphSubstitution`, which measures a text layer that is
present and wrong, counts Devanagari against Latin punctuation and returns
`null` for any page without Devanagari, so all five documents were reported as
unmeasured rather than as damaged.

Nothing reached the ledger: every one of these figures was a candidate awaiting
review, and the review gate is what stood between the error and publication. It
should not be the only thing standing there.

## Decision

**An unqualified amount whose next word is in a script the parser does not read
is refused.** The parser reads English and Devanagari. Where the following word
is in neither, the figure has a magnitude the parser cannot establish, so it
states none.

Three details are load-bearing:

- **Combining marks count as letters.** `ேகா}` begins with a Tamil vowel sign,
  which is a mark, not a letter. Testing only for letters would miss precisely
  the reordered text this rule exists for.
- **Devanagari is excluded from the test, not merely from the refusal.** A
  Devanagari word after a figure is a sentence continuing, and treating it as
  evidence of a lost unit would retire correct published figures.
- **Punctuation is outside the class.** An amount followed by an en dash or an
  ellipsis is ordinary English typesetting. Matching it would have refused
  figures already in the ledger.

The last two are not caution for its own sake. The rule was verified against
every decision already recorded: the same 32 decided facts are stranded with the
rule and without it, so it retires nothing a person has ruled on, and the
published ledger is unchanged at 5,088 facts.

`page_script` gains `tamil`. The classifier asked "is there Devanagari? is there
Latin?", and a Tamil page carries enough Latin — page numbers, roman numerals,
an acronym — to answer the second question yes, so 730 pages of Tamil were
stored as English. That is the trap the column was added to prevent, one script
further along: a query for English pages returns Tamil ones, in which every
English term it searches for is genuinely absent.

## Consequences

1,732 of 1,921 money candidates from the Tamil documents are now refused. The
189 that remain are figures the source states without any scale — monthly wage
rates, a purchase price, stamp-duty valuations — read as rupees exactly as an
English page's bare figures are.

**The English half is unaffected and carries the same figures.** Refusing the
Tamil readings costs no fact, because Tamil Nadu publishes both languages and
both are held. That is a property of this publisher, not a general one: a state
that published only in a script the parser cannot read would yield no money
facts at all, and the honest report of that is zero facts rather than a ledger
of figures short by seven orders.

This rule refuses; it does not repair. Reading Tamil scale words would mean
teaching the parser Tamil in both its damaged encodings, and a scale word
recovered by guessing at glyph order is a guess — [ADR-040](./040-a-printed-glyph-may-be-decoded-a-guessed-one-may-not.md)
already draws that line for a glyph read from the page against one inferred.

`glyphSubstitution` still measures only Devanagari, so these pages remain
unmeasured rather than reported as damaged. The refusal does not depend on that
measurement, but a page-level signal would let a reviewer see why a document
yields so little, and it is not yet there.
