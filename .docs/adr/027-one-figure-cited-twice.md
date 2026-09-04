# ADR-027 · One reported figure, cited twice, counted once

**Status:** Accepted · **Date:** 2026-09-04

## Context

Each CAG report is published as a single PDF containing the whole report in
Marathi and then the whole report in English. Extraction reads both halves, so
a figure the state reported once becomes two facts with two citations. In this
corpus **489 of 506 distinct values appear in both halves**, and 189 figures had
already been verified twice before this was noticed.

Both rows are individually true — each page really does state that amount — so
nothing published is wrong. But an aggregate summing facts counts the same
rupee twice, and the `bigint` paise rule protects precision, not double
counting.

Retiring the Marathi half would be simpler and is wrong. A Marathi reader
following a citation must land on the Marathi page; provenance that silently
redirects to a translation is not provenance.

## Decision

**Both facts stay. One is marked a second citation of the other, and only
unambiguous pairs are linked.**

- Migration 0014 adds `document_fact.same_figure_as`, a nullable self-reference.
  `NULL` means "count this one" — true of every fact until something links it,
  so the column is impossible to get wrong by omission and an aggregate
  expresses the rule as `WHERE same_figure_as IS NULL`.
- A pair is linked **only where exactly one fact holds that value in each half
  of that document.** The Latin-half fact is the one counted, because this
  corpus's Devanagari text layer mangles conjuncts and the English row is the
  one whose stored evidence a reader can read back — not a claim that English
  is authoritative.
- A page's half is judged from the page's own script, not from a fact's
  evidence window: a window is a couple of hundred characters and can be almost
  entirely digits, while the page is never ambiguous.

## Why ambiguous groups are left double-counted

Two signals were measured against the 359 known-good pairs, and neither
separates the candidates well enough to use:

| signal                               | result                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| page alignment                       | offset is stable per document (252 / 171 / 131) but residuals reach **29 pages**                                 |
| neighbouring amounts in the evidence | median similarity **1.00** on true pairs, but of 348 ambiguous facts it was decisive for 97 and **tied for 201** |

A tie means the same value appears in windows with identical neighbours — the
same table stated twice, or a contents line and the appendix heading it points
at. These are genuinely indistinguishable from the text.

**A wrong pairing merges two distinct government figures into one, which is
worse than the double count it was meant to fix.** So an ambiguous group is
reported and left unlinked, and the CLI says plainly that those are still
counted twice.

## Consequences

- 359 pairs linked; 20 values stated in only one half; 125 left unlinked.
  Verified money facts: 1,449, of which **1,090 are counted**.
- The linker is rerunnable and recomputes from scratch, so a parser change that
  adds or retires facts cannot leave a stale pairing behind. It writes only
  `same_figure_as` and never touches a review decision.
- Rejected facts are excluded from pairing: a criterion or a misreading is not
  a figure anyone reported, so asserting a correspondence between two of them
  would be meaningless.
- Every downstream aggregate must filter on `same_figure_as IS NULL`. Nothing
  in the schema forces this, which is a real risk; there is no analytics layer
  yet, and the constraint belongs in it when there is.
