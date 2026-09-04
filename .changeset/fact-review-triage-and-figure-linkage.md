---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": patch
---

Fact review: sort candidates by page context, screen out criteria, reconcile on
re-extraction, and count a bilingual figure once.

**Two extraction defects, both changing what reaches the ledger.** `Rs` matched
the end of English plurals — the pattern is case-insensitive and these are
English reports — so `vouchers, ` became a monetary candidate and, worse,
`Parameters 2020-21` was read as ₹2020 and `Surrenders 2.5.4` as ₹2.5. 79 such
candidates existed; none had been verified, because none carried a unit and all
stopped in the review queue as "the source stated no unit". Separately, the PDF
text layer splits digit groups (`₹ 20 ,564.71 कोटी`), which truncated the figure
to `20` and lost the printed unit. `AMOUNT_IN` now requires a word boundary
before `Rs` and tolerates whitespace only around a digit group's commas.
`PARSER_VERSION` is `cag-facts/4`.

**Re-extraction reconciles instead of accumulating.** `loadFactCandidates` only
ever inserted, so every parser version's output piled up in one table and no
parser fix could replace a reading. It now removes undecided candidates the
current parser no longer produces and reports decided ones as `strandedDecisions`
without touching them: undecided rows belong to the parser, decided ones to the
person who decided them.

**A criterion is not a reported amount.** "Grants with savings over ₹100 crore"
is a cut-off an auditor chose, and storing it puts a figure in the ledger no
government body reported. `thresholdPhrase` flags these; it is advisory, because
4 of 36 flagged facts were real reported quantities. Flagged candidates are kept
out of the batch-review partitions so they cannot be accepted ten to a keystroke.

**Window overlap is no longer mistaken for ambiguity.** A paragraph naming three
deficits produced three candidates whose evidence windows each contained all
three. The self-check now consults what else the same page claims, which moved
849 candidates out of the partition needing individual adjudication.

**One figure cited twice is counted once.** Each report is one PDF containing the
whole report in Marathi and then in English, so 489 of 506 distinct values appear
in both halves. Migration 0014 adds `document_fact.same_figure_as`, a nullable
self-reference where `NULL` means "count this one". Only unambiguous pairs are
linked — page alignment and neighbouring-amount similarity were both measured and
neither separates the ambiguous cases, and a wrong pairing merges two distinct
government figures, which is worse than the double count it would fix.

Also adds a non-interactive decision path (`--decide`/`--revise` with a mandatory
`--note` and a required scope) so decisions reached by a rule are recorded as
such, rather than by feeding synthetic keystrokes to an interactive prompt and
leaving an audit trail that claims a person read each page.
