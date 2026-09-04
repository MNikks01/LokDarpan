# ADR-030 · A bare ₹ figure is rupees, decided per page

**Status:** Accepted · **Date:** 2026-09-04 · **Extends:** [`026-candidates-are-reconciled-not-accumulated.md`](./026-candidates-are-reconciled-not-accumulated.md)

## Context

125 money candidates sat in the `no_value` partition, whose prompt asks a
reviewer to _supply the scale a figure was published at_. It was the last
unworked partition, and it had survived three sessions because supplying a
scale by hand is the single most dangerous thing a reviewer can do here: get it
wrong and a figure is published, wrong, behind a correct citation.

Reading all 125 showed they were not one problem:

|      |                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~101 | plain rupee amounts — `₹1,500 per month`, `₹50,000 per student`, `₹54,33,780 दंड`, `₹18,13,500 प्रति हेक्टर`                                       |
| ~13  | a unit the parser could not see — `ोटींच्या` (कोटी with its conjunct dropped), `core` for crore, `cr`, a unit deferred to a later figure in a list |
| ~24  | figures on pages carrying a `(₹ in crore)` caption                                                                                                 |

The first group is not ambiguous at all. Audit prose writes _crore_ and _lakh_
out when it means them, so a ₹ figure with no scale word **is** the amount.
`amountToPaise` returned null for these only because it refuses to assume — a
refusal calibrated against BEAMS, where a bare number means _thousands_ and
guessing inflated a figure a thousandfold. Its own comment already said prose
was different; the code had simply never acted on it.

The third group is why the first cannot be waved through globally. A table
states its scale in the caption and then prints bare cells. Reading one of those
as rupees understates a government figure by **seven orders of magnitude** — the
same class of defect as the BEAMS mistake, in the opposite direction.

## Decision

**A ₹ figure with no scale word is read as rupees, but only on a page that
declares no scale.**

- `pageDeclaresUnit()` looks for a `(₹ in crore)` / `(₹ कोटीत)` style declaration
  anywhere on the page. It is deliberately **generous**: a false positive leaves
  a figure unvalued for a person, a false negative publishes a wrong number, and
  when the errors are that asymmetric over-detecting is the safe direction. It
  flags 325 of 990 pages.
- The decision is **per page, not per sentence**. A caption sits at the top and
  governs cells far below it, well outside any one evidence window.
- `amountToPaise` takes an explicit `unitless: "refuse" | "rupees"` argument.
  `refuse` remains the default and BEAMS keeps it. It is an argument rather than
  a default because the original defect _was_ a default nobody passed.
- The inference is marked: `extractionConfidence` is **0.6** for a figure read
  this way, against 0.8 for a stated unit and 0.4 for no reading at all. A sound
  inference is still an inference.
- `AMOUNT_IN` also learns `ोटी` — कोटी with its leading conjunct dropped by the
  text layer, the same corruption the criterion screen already handles for
  अधिक → अचधक. The figure is in crore whatever happened to the glyph.

## The self-check had to learn the same reading

`selfCheck` re-derives every amount its evidence states, using the parser's own
pattern, and compares. Had it kept refusing unitless figures while the parser
read them as rupees, **every one of these facts would have been reported as a
`mismatch`** — a defect flag raised against exactly the candidates arithmetic
agrees with, and the loudest possible false alarm.

It therefore re-derives with `"rupees"` too. The two readings cannot collide:
they are seven orders of magnitude apart.

## What this gives up

26 candidates remain unvalued, and some of them are genuine rupee figures whose
only sin is sitting on a page that also contains a table — `₹1,500 per month`
on page 364 is refused for that reason. That is the cost of a page-scoped rule
and it is the right side to err on.

The rest of the 26 are real work for a person: `core` as a misspelling of crore,
`cr` as an abbreviation, bare cells in a table, and units deferred across a list
(`₹ 11,977 आणि ₹ 13,782.36 कोटी`). Each would need the parser to trust a typo or
infer one figure's meaning from another's, and neither belongs in a pattern.

## Consequences

- The money queue is 26, from 125. 98 figures were valued and verified, each
  carrying a note that says **the scale is inferred from the absence of a
  declaration, not stated by the source**.
- `PARSER_VERSION` is `cag-facts/5`, and `loadFactCandidates` now refreshes
  `parser_version` on **undecided** rows so a candidate's provenance names the
  parser that currently produces it. Decided rows are left alone: their version
  is part of what a person reviewed, and the parser does not get to restate it.
- Eight verified facts still carry `cag-facts/4`. They were decided during this
  work before the version was bumped; `/4` and `/5` produce them identically, so
  the label understates which parser attests them rather than misdescribing the
  figure.
