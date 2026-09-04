---
"@lokdarpan/ingestion": minor
---

Read a bare ₹ figure as rupees, decided per page.

The `no_value` partition — whose prompt asks a reviewer to supply the scale a
figure was published at — held 125 candidates and had survived three sessions
unworked. Reading all of them showed roughly 101 were plain rupee amounts:
`₹1,500 per month`, `₹50,000 per student`, `₹54,33,780 दंड`. Audit prose writes
crore and lakh out when it means them, so a ₹ figure with no scale word is the
amount itself. `amountToPaise` returned null only because it refuses to assume,
a refusal calibrated against BEAMS where a bare number means thousands.

It now reads such a figure as rupees, but only on a page carrying no
`(₹ in crore)` style caption. A table states its scale in the caption and prints
bare cells; reading one of those as rupees understates a government figure by
seven orders of magnitude. The check is page-scoped because a caption governs
cells far outside any one evidence window, and deliberately generous, because a
false positive only leaves a figure for a person to read.

The reading is marked as an inference (`extractionConfidence` 0.6 against 0.8
for a stated unit), and `selfCheck` re-derives the same way — without that, every
one of these facts would have been reported as a `mismatch`.

`AMOUNT_IN` also learns `ोटी`, which is कोटी with its leading conjunct dropped by
the text layer. `PARSER_VERSION` is `cag-facts/5`, and loading now refreshes
`parser_version` on undecided rows so a candidate names the parser that
currently produces it; decided rows are left alone.

The money review queue is 26, from 125.
