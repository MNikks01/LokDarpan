---
"@lokdarpan/ingestion": minor
---

Pin the parser against every reading a person has ruled on.

Working the last review queue surfaced five distinct classes of wrong reading —
per-unit rates, thresholds in rules, fragments of larger figures, worked examples
of a formula, and a scale word sitting outside its bracket. Four were caught only
because someone read them. The fifth was already in the ledger, wrong by seven
orders of magnitude.

`corpus:build` turns the decided facts into a committed corpus of 183 cases, each
a real page of a real audit report carrying the outcome a reviewer recorded and
the reason they gave. Nothing in it is invented: the readings that reached this
ledger wrongly were all shapes nobody had thought of, so a corpus written from
imagination would have missed every one.

A case must be self-contained. Some of the parser's judgements are page-scoped —
whether a caption declares a scale, whether the font mapping dropped the rupee
glyph — so a fact whose evidence window cannot reproduce its own reading is not a
case; it is a page. 278 were excluded on that ground rather than propped up with
synthetic context, which would have tested the prop.

The corpus separates what the parser catches from what only a person catches. Of
93 withheld cases, **7 the parser refuses outright and 86 it still offers** — a
measurement of how much of this ledger's correctness rests on human judgement.
If the parser later learns to refuse one of those classes, the assertion fails
and the corpus is rebuilt, which is the intended way to find out that it
improved.

Writing it corrected an overclaim. The scale-outside-bracket guard cannot catch
every case: `₹4,253.77 (26.34 per cent) of the total available funds (i.e.,
₹16,151.82 crore)` puts the scale word in a different bracket, and only the
parallel between the two figures gives it away. The invariant the corpus asserts
is that none of that class reaches a reader — not that the parser refuses them
all.
