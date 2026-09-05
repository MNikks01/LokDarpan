# ADR-045 · A rate carries its denominator

**Status:** Accepted · **Date:** 2026-09-05 · **Completes** [`044-a-rate-is-withheld-until-the-ledger-can-say-what-it-is-per.md`](./044-a-rate-is-withheld-until-the-ledger-can-say-what-it-is-per.md)

## Context

`044` withheld 118 published rates on one ground: `document_fact` carried no
denominator, so a page rendered ₹15 where the source says ₹15 per record. It
named the reversal condition exactly — _a unit on the schema, and `<Figure>`
rendering it or nothing_ — and said the withdrawal was what made deferring that
safe.

This is that work.

## Decision

**A rate is publishable exactly when it can say what it is per, and it is read
rather than inferred.**

Migration 0020 adds `document_fact.per_unit`, exposed through `published_fact`,
carried on the domain type, and rendered beside the figure. `denominatorAfter`
reads it forward from the amount — "month", "record", "Cu.M.", "IPD patient per
day", "₹100" — worded as the page words it.

The validator's verdict changes accordingly. A rate whose denominator can be
read is `needs_review`, and a person decides as before. A rate whose denominator
**cannot** be read is still `rejected`, and carries no value at all.

Reading forward only is the load-bearing constraint. "the amounts were paid at
the rate of ₹60,000" states a rate whose unit sits elsewhere in the sentence,
and choosing which noun it belongs to would be **inventing a denominator for a
government figure** — the one thing this project may not do.

## Where the reading stops

Each rule below was added because a real capture ran past the unit, and each is
a test:

| The page says                                  | Naïvely captured        | Rule                                                         |
| ---------------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| "₹3 per beneficiary **Quantity** in grams"     | "beneficiary Quantity"  | a capitalised word after a lowercase one opens something new |
| "₹1,500 per month **since** April"             | "month since"           | past the first word, only a measure noun continues a unit    |
| "₹48 per IPD patient per day **respectively**" | "…per day respectively" | after a second "per", exactly one word                       |
| "₹100 per Cu**…**"                             | "Cu"                    | a unit the evidence window cut off is not read at all        |
| "the rate of Guarantee fee is ₹2 per ₹100"     | _refused_               | a denominator may itself be money                            |

The fourth is the one worth keeping in mind. "Cu" is not a cubic metre, and the
window ends before the page does. **A denominator that cannot be seen to end is
not a denominator**, so 37 rates stay refused rather than acquire a fragment.

## Consequences

Of the 118 withdrawn by `044`, **64 carry a denominator the parser could read
whole and are restored**; 54 do not and stay withheld. Published facts rise
5,029 → 5,088, of which 60 now say what they are per.

**No published rate lacks a denominator**, and that is asserted rather than
assumed.

The renderer shows "₹1,500 per month", and the accessible label says the same —
a screen reader must not be told a rate is a sum either.

## A defect this exposed

Two figures in one sentence can share an identity. `[page, kind, evidence,
value]` is the key, and a page that declares its own scale refuses both "₹2" and
"₹100" in "the rate of Guarantee fee is ₹2 per ₹100" — giving both a null value
and the same key. The reading without a denominator was overwriting the one with,
silently dropping "per ₹100" from a figure a reviewer had corrected by hand.

Candidates are now deduplicated per identity, preferring the reading that carries
a denominator: it says strictly more about the same evidence.

## What this does not settle

**The 54 still withheld.** Their denominators are real and their evidence
windows are not wide enough to hold them. Widening the window is a change to what
every fact stores, and worth doing on its own terms rather than to rescue 54.

**Whether these rates should be aggregated.** They are rendered, not summed.
Adding ₹15 per record to ₹1,500 per month is meaningless, and nothing here
teaches the analytics engine otherwise.
