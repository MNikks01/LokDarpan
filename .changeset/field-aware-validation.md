---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": patch
---

Make validation field-aware, and let it advise rather than decide.

A field now declares whether it is critical, and the rules follow. `FIELDS` is
exhaustive by type, so adding a `FactKind` without saying how carefully it must
be read is a compile error — it caught `work_reference` while this was being
written. Money is critical; a contractor or officer reading is not, because it is
never published.

`validate` returns `accepted`, `needs_review` or `rejected`, deliberately
separate from the four states a person records. `rejected` never means "probably
wrong": it means the sentence states what the number is, and it is not an amount
— a rate per unit, a threshold in a rule, the multiplicand of a product, an
illustration in a formula.

The need was measured, not assumed. Working the last queue, a person rejected 85
well-formed figures by reading them; the parser had offered every one with a
value.

**The verdict changes nothing.** It does not clear the value or withhold the
fact. Migration 0019 records it, with a constraint that a refusal must say why,
and it refreshes onto rows already held so a rule that changes is visible on
every fact it touches. Re-extraction produced no new candidates, no retirements
and an unchanged queue.

Advisory because the sweep across all 5,102 published figures said so. The first
draft rejected 173 of them, and reading those showed the rules were wrong:
"costing ₹68.55 crore" is a sum, "valuing ₹29.51 crore" is a sum, "liabilities
exceeding ₹27,184 crore" is a liability, and bare "less" matched the subtraction
in "₹0.31 crore (₹4.00 crore less ₹3.69 crore)". Each removal is now a test
asserting the figure survives.

That leaves 137 published figures the rules disagree with, **113 of them rates** —
"₹1,500 per month", "₹3,650 per square meter". This ledger publishes rates as
amounts in 113 places and withheld 60 on the same grounds last week. The standard
has not been applied evenly, which is a question about what the ledger models and
not one a regular expression should settle by unpublishing a government figure.

Worth recording: the regression corpus reported zero false positives for the
first draft. The full sweep found 173. A regression net is not a validation set.
