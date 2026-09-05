# ADR-044 · A rate is withheld until the ledger can say what it is per

**Status:** Accepted · **Date:** 2026-09-05 · **Applies** [`025-a-criterion-is-not-a-fact.md`](./025-a-criterion-is-not-a-fact.md) · **Acts on** [`043-the-validator-advises-a-person-decides.md`](./043-the-validator-advises-a-person-decides.md)

## Context

`043` made validation field-aware and deliberately advisory, because sweeping the
rules across every published figure found **137 the rules disputed, 118 of them
rates**. The ledger published rates as amounts in 118 places while withholding
identical cases elsewhere. `043` recorded that and did not resolve it: whether a
rate belongs is a question about what the ledger models, and not one a regular
expression should settle by unpublishing a government figure.

Twenty were then read, with citations. They are not one thing:

- **Unit prices.** ₹15 per record, ₹10 per thali, ₹499 per KVA, ₹65 per cubic
  metre, ₹2,030 per FHTC, ₹11.22 lakh per Anganwadi centre.
- **Entitlements per person per period.** ₹1,500 per month under a benefit
  scheme, ₹5,000 per annum per student, ₹48 per IPD patient per day for food.
  These are the most citizen-relevant figures in the corpus, and the most
  misleading without their denominator.
- **Two that were simply wrong.** One took the _denominator_ of "the rate of
  Guarantee fee is ₹2 per ₹100" as its figure. The other took ₹100 from the
  worked example "₹90 * 112 per cent = ₹100.80".

## Decision

**Withheld, on the ground that the ledger cannot state the denominator.**

`document_fact` carries no unit. A page renders the number and nothing else, so
₹15 appears as a sum a government spent when it is the fee for one record. The
objection is not that a rate is uninteresting — several are the most useful
figures here — it is that **a figure which cannot say what it is per misstates
itself**, and this project's whole claim is that a figure means what the source
says it means.

118 rates were withdrawn. So were 17 criteria the same sweep exposed and `025`
already governs: savings thresholds at which an audit comment must be made,
delegation limits an engineer may sanction up to, stamp-duty caps and minimums,
and Rule 162's ₹25 lakh ceiling for a Limited Tender Enquiry.

**This is a withdrawal, not a deletion.** The evidence, the region and the reason
stay on every row. Restoring them once a unit exists is a query, not a re-review.

## Consequences

Published facts fall **5,164 → 5,029**; counted once after bilingual linkage,
4,435. Nothing is awaiting review, and **the validator now disagrees with no
published figure at all** — the first time the rules and the ledger have agreed
completely.

## The two rules this forced out

Reading the residue found two rules producing false positives, and both were
narrowed rather than lived with:

- **A comparator needs its conjunction.** "₹10 crore or more" is a threshold;
  "₹0.31 crore (₹4.00 crore **less** ₹3.69 crore)" is a subtraction. Requiring
  `or`/`and` before the comparator separates them.
- **"retaining" was dropped entirely.** "a challan showing remittance of ₹2.33
  crore after retaining ₹0.02 crore" is a sum a body actually kept, and English
  does not distinguish that from a rule about keeping. The one rule it caught
  states its limit in words the list still holds.

That is the fourth and fifth rule removed under pressure from a real published
figure. Each removal is a test asserting the figure survives.

## What would reverse this

**A unit on the schema.** `document_fact` gaining a denominator — "per month",
"per FHTC", "per IPD patient per day" — and `<Figure>` rendering it or nothing.
Then these 118 return, and return better than they were: today the site would
have shown ₹1,500 where the page says ₹1,500 per month.

That is the work worth doing, and this decision is what makes it safe to defer:
nothing wrong is published in the meantime.

## Rejected: publishing rates as they were

The status quo published a per-unit price beside a page citation with no way for
a reader to see it was per anything. A citation makes a figure look checked. That
is precisely when being wrong costs the most.

## Rejected: withdrawing only the two that were plainly wrong

It would have left 116 figures whose correctness depends on a reader noticing a
denominator the page shows and the site does not, and left the ledger treating
identical figures two ways depending on which review queue they came through.
