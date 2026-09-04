---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": patch
---

Judge a figure's precision at the scale the source states, not at an
intermediate one.

CAG reached the one money conversion through BEAMS: `thousandsToPaise` shifts
five decimal places and refuses anything finer, and a crore figure was that
result multiplied up. So the sub-paise check ran at the thousands scale for every
unit. It refused figures it could represent exactly — `0.0000001` crore is ₹1 —
and, in the other direction, truncated `₹1.234` to ₹1.23 through an integer
division on the way back down to rupees.

The first was a documented conservative bias. The second was a silent
truncation, which is the one thing the money path exists to prevent. Three
published figures were affected: the source states ₹65.4347 per patient per day,
₹14,98,413.902 per km and ₹83.1802 per US dollar, and the ledger held each
shortened by a digit. All three are now refused, and are also rejected as rates
rather than amounts.

`shiftedToPaise(raw, shift, unit)` takes the unit's own distance from paise — 9
for crore, 7 for lakh, 5 for thousand, 2 for a figure written out in rupees.
There is still exactly one conversion; the CAG scale table now holds a shift per
unit instead of a multiplier over thousands. Across 6,255 decided facts, three
evidence windows change and every other figure is byte-identical.

Migration 0017 records `document_page.rotation` and stores `width`/`height` as
the **unrotated** page box. 0016 stored the upright box from
`getViewport({ scale: 1 })` while text-item transforms are in the unrotated space
the file states; on the corpus's 457 rotated pages the two disagreed by a quarter
turn, putting 46 fact boxes past the right edge of their own page.

Twelve published facts on one page were rejected: they state the value a work
must exceed for pre-qualification criteria or field-laboratory verification to
apply, which is a criterion rather than a sum (ADR-025). Their identical twins on
the same page had already been rejected on that ground.
