---
"@lokdarpan/ingestion": minor
---

Empty the `no_value` review queue: two parser defects fixed, twenty-three
figures corrected by hand.

**A parenthesised figure is not a table caption.** `pageDeclaresUnit` matched
any parenthesis containing a unit word, sweeping up `(₹ 1,902 crore)` and
`(₹ 10 crore and above)` — a figure and a criterion, each carrying its own unit
and saying nothing about the scale of anything else. Three pages of ordinary
rupee prose were refused because of them. A declaration names a unit _without_
naming an amount, and excluding digits from the parenthetical separates the two.

**An unreadable unit is not a missing unit.** Fixing the above alone would have
made `₹ 145 core` — crore misspelled — read as one hundred and forty-five
rupees, wrong by seven orders of magnitude and wrong precisely because the
source did state a unit. A short list of near-miss spellings (`core`, `cr`,
`lac`, `lakhs`, `करोड`) now refuses wherever it appears. The parser does not
translate them.

**The rest are corrected by hand.** A misspelled unit, a unit deferred across a
list (`₹ 11,977 आणि ₹ 13,782.36 कोटी`), and plain rupees on pages that also hold
a table. Teaching the parser any of these would put a guess behind every future
figure rather than behind the twenty-three reasoned about, so they are
`corrected` decisions applied from `data/reference/cag-fact-corrections.json` via
`--corrections=<file>`. Amounts are written the way the source writes them and
converted by `amountToPaise`, so there is one money conversion rather than two;
every entry carries a reason, and a malformed file applies nothing.

The linker now pairs on `coalesce(corrected_value, normalised_value)` — keyed on
the parser's reading alone, all 23 corrections would have escaped the bilingual
double-count rule.

The money review queue is empty: 1,556 verified, 23 corrected, 44 rejected.
