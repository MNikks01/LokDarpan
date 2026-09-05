---
"@lokdarpan/ingestion": patch
---

Withhold rates and criteria the ledger cannot state, and narrow two more rules.

ADR-043 left 137 published figures the validator disputed, 118 of them rates,
because whether a rate belongs is a scope question rather than one a regular
expression should settle. Twenty were then read with citations, and they are not
one thing: unit prices (₹15 per record, ₹65 per cubic metre), entitlements per
person per period (₹1,500 per month, ₹48 per IPD patient per day), and two that
were simply wrong — one took the _denominator_ of "the rate of Guarantee fee is
₹2 per ₹100" as its figure.

`document_fact` carries no unit, so a page renders ₹15 where the source says ₹15
per record. A figure that cannot say what it is per misstates itself, so the 118
are withdrawn — along with 17 criteria the same sweep exposed and ADR-025 already
governs: savings thresholds for an audit comment, delegation limits, stamp-duty
caps, and Rule 162's ₹25 lakh tender ceiling.

A withdrawal, not a deletion: evidence, region and reason stay on every row, so
restoring them once a unit exists on the schema is a query rather than a
re-review.

Published facts fall 5,164 → 5,029, 4,435 counted once after linkage. **The
validator now disagrees with no published figure at all.**

Reading the residue forced two more rules out, the fourth and fifth removed under
pressure from a real figure. A comparator now needs its conjunction, because
"₹4.00 crore less ₹3.69 crore" is a subtraction and not a threshold. And
"retaining" is dropped entirely: "remittance of ₹2.33 crore after retaining ₹0.02
crore" is a sum a body kept, and English does not distinguish that from a rule
about keeping.
