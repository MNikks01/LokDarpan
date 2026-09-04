# ADR-037 · Precision is judged at the scale the source states

**Status:** Accepted · **Date:** 2026-09-04 · **Amends** [`030-a-bare-figure-in-prose-is-rupees.md`](./030-a-bare-figure-in-prose-is-rupees.md)

## Context

There is one money conversion in this codebase, and CAG reached it through
BEAMS: `thousandsToPaise` shifts five decimal places and refuses anything finer,
and a crore or lakh figure was that result multiplied up. Reusing one conversion
was right. Reaching it through the wrong scale was not.

The check for sub-paise precision therefore ran **at the thousands scale, for
every unit**. Two consequences, in opposite directions:

- **It refused figures it could represent exactly.** `0.0000001` crore is ₹1.
  Judged as thousands it is a hundredth of a paisa, so it was refused. This was
  documented as "conservative rather than correct".
- **It truncated figures on the way back down.** A bare rupee figure was read as
  thousands and divided by 1,000 — an integer division. `₹1.234` came out as
  123 paise. The last digit was dropped in silence.

The first is a defensible bias. The second violates the rule the money path
exists to enforce: never round, truncate, or silently repair.

Three published figures were affected. The source states ₹65.4347 per patient
per day, ₹14,98,413.902 per km, and ₹83.1802 per US dollar; the ledger held
₹65.43, ₹14,98,413.90 and ₹83.18, each verified by a person who was shown the
correct evidence beside a quietly shortened value.

## Decision

**A figure's precision is checked against the scale the source states**, and
nothing is converted through an intermediate one.

`shiftedToPaise(raw, shift, unit)` takes the unit's own distance from paise — 9
for crore, 7 for lakh, 5 for thousand, 2 for a figure written out in rupees.
`scaledToPaise` and the CAG parser both call it, so there is still exactly one
conversion; the CAG scale table now holds a shift per unit rather than a
multiplier over thousands.

A figure the stated scale can represent exactly is kept. A figure finer than a
paisa **at its own scale** is refused, with no value, for a person to read.

## Consequences

Across 6,255 decided facts, three evidence windows change, all from a value to
no value — the three truncations above. Every other figure in the ledger is
byte-identical, which is the result to want: this corrects a defect without
disturbing a corpus that was reviewed by hand.

All three were also rates — per patient per day, per km, per dollar — and are
rejected on that ground as well. A rate is not an amount, and the ledger models
amounts.

## What this does not change

Refusal remains the default for an unqualified figure. `030` still governs when
a bare figure may be read as rupees; this decides only how precisely it is read
once that question is settled.

It does not add a unit or a denominator to the schema. Until one exists, a rate
is refused rather than published as though it were a sum.
