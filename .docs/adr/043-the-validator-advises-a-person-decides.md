# ADR-043 · The validator advises; a person decides

**Status:** Accepted · **Date:** 2026-09-05 · **Builds on** [`025-a-criterion-is-not-a-fact.md`](./025-a-criterion-is-not-a-fact.md)

## Context

The brief asks for validation that is **field-aware**: an extractor declares
what it is producing, and the rules follow from that rather than from the
extractor's own opinion. It lists a dozen critical fields — money, counts,
quantities, percentages, chronology-affecting dates, geographic and local-body
identifiers — and then says something more useful than the list: _do not build
extractors for fields the system does not support merely because they appear
here._

The need is real and was measured. Working the last review queue, a person had
to reject 85 well-formed figures by reading them: 60 per-unit rates, 11
thresholds set by rules, 6 fragments of larger numbers, 4 worked examples of a
formula, and 4 whose scale word sat outside a bracket. The parser offered every
one of them with a value.

## Decision

**A field declares whether it is critical, the rules follow, and their verdict
is advisory.**

`FIELDS` holds one declaration per `FactKind` — exhaustive by type, so adding a
kind without saying how carefully it must be read is a compile error. Money is
critical: a wrong reading reaches a reader with a page citation attached. A
contractor or officer reading is not, because it is never published (`033`).

`validate` returns one of three states, deliberately separate from the four a
person records in `verification_status`:

- `accepted` — the reading is a quantity of the kind the field models
- `needs_review` — nothing disqualifies it, and nothing here can confirm it
- `rejected` — **the sentence states what the number is, and it is not an
  amount**: a rate per unit, a threshold in a rule, the multiplicand of a
  product, an illustration in a formula

`rejected` never means "probably wrong". Where the rules cannot establish the
kind of a figure, they say `needs_review` and stop.

**And the verdict changes nothing.** It does not clear the value, withhold the
fact, or decide anything. It is recorded on the row and shown to the reviewer.

## Why advisory, when a stricter rule was available

The rules were swept across the 5,102 monetary figures already published.

The first draft rejected **173** of them — and reading those rejections showed
the rules were wrong, not the ledger. "285 medical equipment **costing** ₹68.55
crore" is a sum. "11,157.83 square meters **valuing** ₹29.51 crore" is a sum.
"liabilities **exceeding** ₹27,184 crore" is a liability. And bare "less"
matched the subtraction in "₹0.31 crore (₹4.00 crore **less** ₹3.69 crore)".
Each was removed, and each removal is now a test asserting the figure survives.

That left **137 published figures the rules still disagree with, 113 of them
rates** — "₹1,500 per month", "₹1,000 per instance", "₹3,650 per square meter",
"reserve price of ₹19.80 lakh per month".

Those 113 are the uncomfortable part, and they are a finding rather than a bug:
**this ledger publishes rates as amounts in 113 places, and withheld 60 of them
on the same grounds last week.** The standard has not been applied evenly. That
is a question about what the ledger models — and not one a regular expression
should settle by unpublishing a government figure.

So the verdict is recorded and surfaced. A person decides whether those 113
belong, exactly as a person decided the 60.

## Consequences

Migration 0019 adds `validation_state` and `validation_reason`, with a
constraint that a refusal must say why: an unexplained flag is one people learn
to ignore. The verdict is not part of a fact's identity — it is what the rules
say about a reading, not what the reading is — so it refreshes onto rows already
held, whatever their status, and a rule that changes becomes visible on every
fact it touches.

Re-extraction after this landed produced **no new candidates, no retirements and
an unchanged queue**, which is what advisory means in practice.

Of the 6,271 monetary facts, the rules agree with a reviewer's rejection 127
times and disagree with a published figure 137 times.

## What this does not do

**It does not make the parser refuse a rate.** That would strand decisions and,
more importantly, would pre-empt the decision about the 113.

**It adds no extractor.** No field on the brief's list is newly extracted, which
was the instruction.

## Rejected: letting the validator withhold the value

Setting `normalisedValue` to null on a `rejected` verdict is one line and would
have removed 137 published figures from the ledger, 113 of them on a rule the
project has not decided. A validator that can unpublish is a validator that can
be wrong in the direction this project cares about most.

## Rejected: validating against the regression corpus alone

The corpus (`#90`) reported **zero** false positives for the first draft of these
rules. The full sweep found 173. The corpus samples 90 published figures by
class; the rules were about to run against 5,102. **A regression net is not a
validation set** — it proves a change did not break what it covers, and says
nothing about what it does not.
