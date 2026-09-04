# ADR-024 · The self-check reads the page, not the window

**Status:** Accepted · **Date:** 2026-09-03 · **Extends:** [`021-review-is-a-local-tool.md`](./021-review-is-a-local-tool.md)

## Context

`review:triage` sorts money candidates by whether the parser's reading can be
re-derived from the evidence stored beside it. A candidate whose evidence states
several amounts was called `ambiguous`, on the reasoning that a reviewer still
has to decide which of them the claim is about.

Measured against the three audit reports held, that partition was almost
entirely an artefact of how the evidence is cut:

| partition   | candidates      |
| ----------- | --------------- |
| `mismatch`  | 0               |
| `no_value`  | 288             |
| `ambiguous` | 852             |
| `confirmed` | 0 (all decided) |

Of the 852, **849 had no amount in view that some other fact did not already
claim**. `contextAround` keeps 160 characters either side of a figure, so a
paragraph naming the state's revenue, fiscal and primary deficits produces three
candidates whose windows each contain all three figures. Facts `#5737`, `#5738`
and `#5739` are exactly this: three correct readings, three overlapping windows,
and no choice ever open to anyone.

Calling that ambiguity had a cost in both directions. It put 849 candidates in
the partition explicitly denied the page-at-a-time screen, in a queue whose own
design note records that _"a reviewer confirming 1,491 amounts one keypress at a
time will not do it, and a review nobody performs publishes nothing."_ And it
buried the handful of candidates where an amount really is unaccounted for
among hundreds where nothing is.

## Decision

**The self-check may consult what else the same page claims, and reports window
overlap as its own verdict: `confirmed_in_context`.**

- `selfCheck(input, claimedOnPage?)` takes the amounts claimed by facts on the
  candidate's page. Where every amount in the window other than the stored one
  appears in that set, the verdict is `confirmed_in_context`; where any is
  unaccounted for, the verdict stays `ambiguous`.
- **The refinement only ever narrows.** Without page context the answer is
  unchanged, `mismatch` and `no_value` are decided before context is consulted,
  and no candidate moves out of a partition that asks for more scrutiny.
- The page context is built from **all** facts on the page, whatever their
  verification status. A sibling that leaves the queue because someone decided
  on it still accounts for its amount; a set scoped to the queue would shrink as
  the reviewer worked, moving candidates back into `ambiguous` behind them and
  making the partition depend on how far through the queue they were.
- `--batch` is extended to `confirmed_in_context`, and to nothing else. The page
  header states which partition is on screen and does not reuse the `confirmed`
  wording, which claims the figure is stated "by no other reading of it" — false
  here, and a line a reviewer reads far more often than they read the source.

## What this does not establish

`confirmed_in_context` says every amount in the window is claimed by some fact.
It says nothing about whether those facts should exist.

The three candidates that page context resolved beyond the 849 are the
demonstration. Each was settled by fact `#5972`, whose figure is the ₹10 crore
in _"details of savings surrendered (each case over ₹10 crore)"_ — a reporting
threshold, not a reported amount. It accounts for its neighbours' windows
perfectly well while being a candidate that should have been rejected.

Thresholds stored as facts are a separate defect, tracked as the parser's
problem and not the triage's. This ADR deliberately does not paper over it: the
partition is honest about what arithmetic established, and a threshold is a
question for a person.

## Consequences

- The human queue for these three reports is 288 `no_value` and 0 `ambiguous`,
  down from 1,140. The 852 move to a screen that shows ten at a time and still
  writes one attributed decision per fact.
- A new verdict means a new label everywhere the partitions are named:
  `TRIAGE_ORDER`, the triage report, the review prompt's check note and the
  batch header. `TRIAGE_ORDER`'s test asserts it covers every verdict
  `selfCheck` can return, so a future partition cannot be added silently.
- `ReviewCandidate` carries `documentId`, without which a candidate cannot say
  which page's claims are its own.

## Alternatives considered

**Narrow `CONTEXT_CHARS`.** Fewer overlaps, but the window exists so a reviewer
can judge a claim in context, and audit prose runs headings into body text. A
window narrow enough to avoid neighbours is one too narrow to judge from.

**Deduplicate the candidates instead.** One fact per paragraph, holding several
amounts. This loses the property that a fact is one figure with one citation,
which everything downstream depends on.

**Leave it and review all 852 by hand.** Honest, and the reason it was rejected
is not the effort: it spends a reviewer's attention where arithmetic has already
answered, which is how the partitions that need judgement stop being reached.
