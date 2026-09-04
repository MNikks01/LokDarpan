---
"@lokdarpan/ingestion": patch
---

Refuse an amount whose scale word sits outside its bracket.

The page states "shortfall of ₹11,553 (₹7,011+₹4,542) crore". The crore governs
the bracketed group, and both amounts inside it were read as plain rupees —
₹4,542 instead of ₹4,542 crore, **wrong by seven orders of magnitude**, in a
well-formed small figure nothing downstream could question. Three such readings
reached the review queue and were caught by hand.

An unqualified amount is now refused where a closing bracket followed by a scale
word can be reached from it without leaving the bracket. The lookahead is bounded
and stops at a further bracket or a full stop, because a scale word two clauses
away governs something else.

Found while reviewing the 496 candidates the rupee-mark decoding produced. That
queue is now at zero: 411 verified, 85 withheld — per-unit rates, thresholds and
ceilings set by rules, fragments of larger figures, worked examples of a formula,
and four products on a Marathi page that do not equal their own printed
multiplicands where the English page of the same report does. 5,164 facts are
published, 4,560 of them counted once after bilingual linkage.
