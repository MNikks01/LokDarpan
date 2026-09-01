# Tender collection cadence — daily is not often enough

**Status:** Measured finding · 1 September 2026 · amends [`tender-ingestion-plan.md`](./tender-ingestion-plan.md) §2a

The tender plan established that collection is forward-only: the GePNIC landing page shows a rolling window of about twenty current tenders and cannot be paged backwards, so anything not collected is not recoverable. It assumed a daily sweep was adequate.

It is not. **The window turns over almost completely within hours.**

---

## What was measured

Two sweeps of the same portals, roughly six hours apart on 1 September 2026. If a daily cadence were sufficient, most tenders would appear in both runs.

Matched on title and closing date rather than on the portal's identifiers, so that a re-issued identifier could not disguise the same tender as a new one:

| Portal         | In both runs | Only in the later run | Only in the earlier run |
| -------------- | -----------: | --------------------: | ----------------------: |
| Haryana        |        **1** |                    17 |                      14 |
| Uttarakhand    |        **1** |                     9 |                      18 |
| Tripura        |        **0** |                     2 |                      17 |
| Uttar Pradesh  |        **0** |                    10 |                      12 |
| Jharkhand      |        **0** |                     4 |                      19 |
| Madhya Pradesh |        **0** |                    10 |                      14 |
| Punjab         |        **0** |                    14 |                      13 |
| Himachal       |        **0** |                     9 |                      19 |

Across every portal measured, essentially **nothing survives six hours** on the front page.

Tamil Nadu, sampled at a two-hour gap rather than six, retained eight of twenty — so the decay is steep but not instant.

## What this means

A once-daily sweep does not undersample slightly. On a busy portal it captures roughly one window out of the several that pass in a day, and the rest are gone permanently. A dataset built that way would look complete — twenty tenders per portal per day, no gaps, no errors — while representing a minority of what was actually advertised.

That is the most dangerous shape a gap can take here: invisible, and indistinguishable from completeness.

## What this does not mean

**The identity is sound.** What rotates is the listings, not the identifiers. The portal's own `sp` parameter was stable across the two-hour Tamil Nadu gap — eight tenders present in both samples carried identical ids — so re-collection updates a tender rather than duplicating it.

An earlier reading of this same data concluded the opposite, that the identifiers were rotating. That was wrong, and the check which settled it was comparing the tenders themselves rather than their ids: had the identifiers been rotating, the same titles would have reappeared under new ids. They did not reappear at all.

**Nothing collected is incorrect.** Every tender held was advertised. The limitation is coverage, not accuracy.

## The decision this forces

Cadence trades completeness against request volume, and both sides are real:

| Cadence          | Requests per portal per day | Coverage             |
| ---------------- | --------------------------: | -------------------- |
| Daily            |                         ~21 | perhaps a fifth      |
| Every four hours |                        ~126 | most of it           |
| Hourly           |                        ~500 | approaching complete |

These are public servers run for citizens, not APIs with a quota. The right answer is the least frequent cadence that does not systematically misrepresent the data, and on this evidence that is nearer four-hourly than daily.

**Until this is decided, the scheduled job is paused.** Leaving it at a daily cadence would accumulate a dataset whose coverage nobody had chosen.

## What would settle it better

A sweep at one-hour intervals across a single day would give the actual decay curve rather than two points on it, and would show whether turnover is steady or clusters around working hours. That is one day of elevated request volume in exchange for choosing the cadence on evidence — cheaper than discovering the answer after a year of collection.
