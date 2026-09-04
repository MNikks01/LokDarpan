# ADR-031 · The residue is corrected by hand, not by another rule

**Status:** Accepted · **Date:** 2026-09-04 · **Extends:** [`030-a-bare-figure-in-prose-is-rupees.md`](./030-a-bare-figure-in-prose-is-rupees.md)

## Context

ADR-030 left 26 candidates in `no_value`. Reading all 26 found two defects and
one residue.

**A parenthesised figure is not a table caption.** `pageDeclaresUnit` matched
any parenthesis containing a unit word, which swept up `(₹ 1,902 crore)`,
`(₹ 10 crore and above)` and `(₹7.28 crore and ₹68.87 crore)`. Those are a
figure, a criterion and two figures; each carries its own unit and says nothing
about the scale of anything else on the page. Three pages of ordinary rupee
prose were being refused because of them.

The discriminator is that **a declaration names a unit without naming an
amount** — `(₹ in crore)`, `(₹ कोटीत)`, `(₹ लाखात)`. Excluding digits from the
parenthetical separates the two exactly.

**An unreadable unit is not a missing unit.** Fixing the first defect alone
would have made `₹ 145 core` — crore misspelled — read as one hundred and
forty-five rupees, wrong by seven orders of magnitude, and wrong _precisely
because the source did state a unit_. ADR-030's rupee reading is licensed by
"no unit was written"; it must not fire on "a unit was written that I cannot
read". A short list of near-miss spellings — `core`, `cr`, `lac`, `lakhs`,
`करोड` — now refuses wherever it appears, whatever the page declares. The parser
does not translate them: mapping a typo to a meaning is a guess about what a
government document intended.

## Decision

**The remaining 23 are corrected by hand, from a file that can be read and
diffed before it is applied.**

Each needs a reader to decide what a sentence means:

|                                                |                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| a misspelled unit                              | `₹ 145 core`, `₹ 261.78 core`                                                      |
| a unit deferred across a list                  | `₹ 11,977 आणि ₹ 13,782.36 कोटी` — both in crore                                    |
| plain rupees on a page that also holds a table | `₹1,500 per month`, `₹5,000 per annum`, `₹15 per record`, `₹18,13,500 per hectare` |

Teaching the parser any of these would put a guess behind every future figure
rather than behind the twenty-three that were reasoned about. So they are
`corrected` decisions — the status the schema already has for "the parser could
not read this and a person says what it is" — recorded through
`--corrections=<file>`.

**The amount is written the way the source writes it.**
`{ "amount": "145", "unit": "crore" }`, never paise. Hand-computing paise is how
a figure ends up an order of magnitude out; it happened four times while writing
tests during this work, and each time the test caught it because the conversion
under test was the real one. The file's amounts therefore go through
`amountToPaise`, so there is one money conversion in this codebase rather than
two.

**Every entry carries a reason**, and a blank one is refused — the same rule
`reviseDecision` applies, for the same cause: a published figure that came from
a person rather than the page must be able to say why. A malformed file applies
nothing at all, because a partly-applied one leaves a state nobody reasoned
about.

## Pairing follows the published value

The linker keyed on `normalised_value`, which a corrected fact leaves null. All
23 would have escaped the bilingual double-count rule of ADR-027 and been
counted twice. It now pairs on `coalesce(corrected_value, normalised_value)` —
the same coalesce `published_fact` already uses.

## Consequences

- **The money review queue is empty.** 1,556 verified, 23 corrected, 44
  rejected; 1,583 rows in `published_fact`, 1,194 of them counted once after
  linkage.
- `data/reference/cag-fact-corrections.json` is a checked-in record of every
  figure a person supplied and why. It is evidence, not configuration: it should
  grow only when someone reads a candidate and decides it.
- Corrections are applied by fact id. Ids are stable only while a candidate
  keeps its identity — evidence window and value — so a parser change that
  rewrites a window will strand entries in this file. `loadFactCandidates`
  reports those as `strandedDecisions`, which is the signal to revisit it.
