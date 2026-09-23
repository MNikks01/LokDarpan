# What the ledger is today

**Date:** 5 September 2026 · **Answers blocker 3** of [`README.md`](../README.md) · **Reconciles** [`01-product/sprint-plan.md`](../01-product/sprint-plan.md) and [`07-analytics/analytics-engine.md`](../07-analytics/analytics-engine.md) **with what may actually be published**

Every roadmap document in this repository was written while one question was
open: whether to ask three government bodies for permission. That question is
now answered, and the answer changes what the product can be at launch. This
records the position so the plan and the ledger stop describing different
things.

## The decision

**Permission will not be sought.** Not from NRIDA, not from the Maharashtra
Finance Department. The project does not want to announce itself to the bodies
whose records it publishes before it is ready to.

That is a considered choice with a real cost, and the cost is written out below
rather than left to be discovered later. It is also reversible at any time: the
work to act on a "yes" is small, and is described at the end.

## What each source permits, and what follows

| Source                           | Terms                                                                                | Consequence                  |
| -------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- |
| **CAG** audit reports            | reproduction permitted outright, prominent attribution                               | published                    |
| **LGD** administrative hierarchy | reproduction permitted outright                                                      | published                    |
| **BEAMS** treasury figures       | _"reproduced free of charge after taking proper permission by sending a mail to us"_ | **collected, not displayed** |
| **PMGSY / OMMAS** work register  | copying and downloading reserved to prior written permission                         | **not collected at all**     |

## The consequence the plan did not anticipate

`sprint-plan.md` already expects the execution-data gap. Its contingency reads:

> Money Trail — _"Renders `insufficient_data` honestly; unit-level finance still
> works"_

**Unit-level finance is BEAMS.** With BEAMS withheld from display, the fallback
the plan leans on is not available either. Both halves of the Money Trail are
constrained, not one:

- **Project level** has no source, because PMGSY is not collected. The
  `Released − Utilized` variance at the centre of `analytics-engine.md` has no
  input, and this is now a settled state rather than a gap awaiting discovery.
- **Unit level** has a source that may not be shown.

What remains publishable is **CAG audit observations and the LGD hierarchy they
attach to**. That is the product at launch unless something changes.

## What that actually is

|                                          |            |
| ---------------------------------------- | ---------: |
| documents · pages                        | 20 · 4,586 |
| published facts                          |      5,088 |
| — counted once after bilingual linkage   |      4,488 |
| — stating what they are per              |         60 |
| awaiting review                          |          0 |
| facts carrying the region they came from |      5,747 |

Every one is a figure from a Comptroller and Auditor General report, read by a
parser that refuses more often than it guesses, decided by a person, cited to a
page, and locatable to a rectangle on that page. Nothing in it is inferred.

**That is a narrower product than the architecture describes, and a real one.**
"Here is what the CAG found, traceable to the page, for twenty reports across two
states" is a claim no other public surface makes, and it is entirely within the
terms of the source.

## What is worth building inside this

- **More CAG.** The pipeline is state-agnostic; the corpus is two states of
  twenty-eight. Nothing about adding more of it turns on permission.
- **Making what exists findable.** Entity resolution, search and the unit page
  are all about figures already held.
- **The consistency checks BEAMS still feeds.** It is collected, so a CAG figure
  can still be checked against the treasury's. A comparison a reader never sees
  still catches an error.

## What this does not close

**Nothing here is irreversible.** If permission is later sought and granted:

- BEAMS becomes publishable by setting `PUBLISH_BEAMS_FIGURES` — one environment
  variable, no code change (see `apps/web/src/server/publishable.ts`).
- PMGSY becomes collectable, and the project-level Money Trail becomes buildable
  for rural roads. It would still not cover state highways, which
  [`phase-1-maharashtra-roads.md`](../06-government-sources/phase-1-maharashtra-roads.md)
  §44 anticipated.

**The roadmap documents are not rewritten.** `sprint-plan.md` W6 and W8 still
describe project pages and a populated Money Trail. They describe what to build
when there is data to build it from, and that is worth keeping. This document is
the note that says the data is not coming for now.
