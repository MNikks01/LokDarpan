# ADR-026 · A candidate is the parser's current reading, not a deposit

**Status:** Accepted · **Date:** 2026-09-04 · **Extends:** [`025-a-criterion-is-not-a-fact.md`](./025-a-criterion-is-not-a-fact.md)

## Context

`loadFactCandidates` only ever inserted. A candidate matching `(document, page,
kind, raw_text, normalised_value)` was skipped; anything else was added. Nothing
was ever removed, so every parser version's output accumulated in the same
table and the review queue was the union of every reading the project had made.

This blocked the fix it was hiding. Two extraction defects were found while
reading the 288 `no_value` candidates — the partition whose prompt asks a
reviewer to _supply the scale a figure was published at_:

**`Rs` matched the end of English words.** The pattern was case-insensitive and
these reports are written in English, so `vouche‌rs, ` `transfe‌rs, ` `yea‌rs, `
all matched, and a digit group of `[\d,]+` accepted the bare comma that
followed as a number. **82 of the 288 were not figures at all.** Worse, where a
number followed the word the capture was a real one: `Paramete‌rs 2020-21` read
as ₹2020, `Surrende‌rs 2.5.4` as ₹2.5, `yea‌rs 10.32` as ₹10.32 — years,
paragraph numbers and table columns entering the ledger as money. **79 such
candidates existed.** None had been verified, because none carried a unit and
all of them stopped in the queue as "the source stated no unit".

**The text layer splits digit groups.** `₹ 20 ,564.71 कोटी` and `₹ 97 ,188.32
कोटी` stopped the digit group at the injected space, capturing `20` and losing
the `कोटी` after it. The figure was then stored with no value and offered to a
reviewer as unqualified — which is false, the unit is printed on the page.

Fixing either changes what a sentence yields. Under an insert-only loader the
superseded row would have sat in the queue forever beside its own replacement.

## Decision

**Loading reconciles a document's candidates to what the current parser
produces.** Undecided rows the parser no longer yields are removed; decided
ones are counted and reported, never touched.

> Undecided rows belong to the parser. Decided ones belong to the person who
> decided them.

- Identity is `(page, kind, raw_text, normalised_value)`, JSON-encoded rather
  than joined on a separator. It is **not** a database key: 70 evidence windows
  in this corpus carry more than one figure, because a short sentence yields
  the same window for every amount in it, so the value has to be part of the
  identity or two distinct facts would collapse into one.
- `FactLoadResult` gains `retired` and `strandedDecisions`. A stranded decision
  is printed with the advice to revise it, and nothing more: withdrawing a
  person's decision is not the parser's to do.
- `AMOUNT_IN` requires a word boundary before `Rs`, and its digit group
  tolerates whitespace **around its commas only** — a comma must be present to
  continue the group, which is what keeps `₹ 1,500 26,200` from becoming one
  number. `PARSER_VERSION` becomes `cag-facts/4`.

**Measured over the three reports:** 168 candidates retired across two runs, 2
figures recovered, **0 stranded decisions** — no verified fact was disturbed.
The money queue fell from 288 `no_value` to 125.

## Criteria are not suppressed at extraction

ADR-025 left this open. **It is now decided against, on the evidence 025
produced.** Of 36 criterion-flagged facts read individually, **4 were real
reported quantities** — "undischarged liabilities exceeding ₹27,184 crore" is a
quantum, not a filter. Suppressing at extraction is silent and final, so an
11% false-positive rate would delete real government figures with nobody in the
loop, which is exactly the asymmetry `threshold.ts` was built to respect.

Instead the screen **subtracts from the batchable partitions**: a
criterion-flagged candidate never appears in `confirmed` or
`confirmed_in_context`, so it cannot be accepted ten to a keystroke, and
`--check=criterion` reaches them for individual review. The parser keeps
emitting them and a person keeps deciding them.

## Consequences

- Re-extraction is now idempotent and safe to run after any parser change,
  which is what makes further parser fixes affordable.
- Deleting undecided candidates is a real deletion. It is defensible only
  because a candidate is never published and is regenerable from
  `document_page`; if candidates ever acquire state a person created, this
  needs revisiting.
- The remaining 125 `no_value` candidates are, as far as the sweep can tell,
  genuinely unqualified figures. That partition is now worth a person's time in
  a way it was not when two thirds of it was noise.
