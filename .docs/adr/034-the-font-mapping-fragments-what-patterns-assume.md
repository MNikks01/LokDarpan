# ADR-034 · A broken font mapping fragments what the patterns assume

**Status:** Accepted · **Date:** 2026-09-04 · **Extends:** [`030-a-bare-figure-in-prose-is-rupees.md`](./030-a-bare-figure-in-prose-is-rupees.md)

## Context

Seven more Maharashtra CAG reports were ingested, taking the corpus from 3
documents and 1,091 pages to 10 and 2,792. The extraction pipeline held up on
the original three — 0 new candidates, 0 retired, which is the regression signal
worth having — and the new documents exposed three defects the first three never
could, **two of which had already published wrong figures**.

The common cause is that some of these PDFs map glyphs through a non-Unicode
font. The text layer then extracts as mojibake: Latin letters and digits stand
in for Devanagari conjuncts, and matras detach from their stems.

```
अनुमणका      should be  अनुक्रमणिका
%ा&धकार      should be  प्राधिकार
7नयोजन       should be  नियोजन
आ2ण          should be  आणि
```

## What it broke

**1 · `RS` read as a currency marker.** These reports index their own series
with all-caps codes — GSS, ES, **RS**, COPU. A table of PAC/COPU report numbers
reading `GSS 12, 17 … RS 9, 16 … COPU 08,09` produced **₹916, ₹33, ₹37, ₹54,
₹56** out of report numbers. `AMOUNT_IN` was case-insensitive, so `RS` matched
`Rs`.

Measured across all 2,792 pages: **every one of the eleven `RS` occurrences
before digits is a series code, and not one genuine `Rs.` currency marker
exists.** These reports write `₹`. The pattern is now case-sensitive for the
`Rs` marker, and the Latin unit words are enumerated by case (`crore` 1,533,
`lakh` 153, `Lakh` 1, no all-caps form).

**Five of these were verified and published**, in document 3 of the _original_
corpus, during the review this session performed. They have been revised to
rejected.

**2 · A crore stem whose matra did not survive.** `कोट[ीि]` matched only intact
spellings. The font mapping produces `कोट2` (328), `कोट` (118), `कोट8` (95),
`कोट5` (71), `कोट-` (59), `कोट:` (55), `कोट&` (38) — and detaches the matra
behind a space, `₹ 100 कोट ीं हून`. **721 figures were read as bare rupees,
wrong by seven orders of magnitude.** Every `कोट`-stem form following a figure
in this corpus means crore; there is no other word it could begin.

One of the 721 was published: fact `#9834`, stored as ₹100 where the page says
₹100 crore — and which is also an appendix heading, _"grants with persistent
savings over ₹100 crore"_, so a criterion that should never have been a fact at
all. Both the unit match and the criterion screen missed it for the same reason,
and both are fixed.

**3 · Mojibake pages count as extracted.** `pages_without_text` records pages
with no text layer. It cannot see a page whose text layer is present and wrong.
Report No. 2 of 2025 has 121 pages of "text" and yields 0.10 facts per page
against 0.74–3.00 for every other document, because only 3 of those 121 pages
contain a `₹` at all. **This is not fixed here** — see below.

## Decision

**The patterns match the corpus as it actually is, not as it should be
encoded.** `AMOUNT_IN` is case-sensitive for `Rs`, matches the bare `कोट` stem,
and the criterion screen tolerates any run of non-letters between a unit and its
criterion word — one class covering both a detached matra and a substituted
glyph, because neither is a letter.

`PARSER_VERSION` is `cag-facts/7`.

## The ordering lesson

Matching the bare `कोट` stem _first_ shortened every intact `कोटी` match by one
character. That moved every evidence window, which changed the identity of every
Devanagari crore fact in the corpus, which **stranded 504 sound decisions** —
review work that was correct and became orphaned by a parser fix.

Alternation is ordered, so the intact spellings are listed first and only
genuinely mangled figures change identity. Stranded decisions fell from 504 to
6, and those 6 are the facts that were actually wrong.

**A parser fix must not orphan the review performed against it.** The reconciler
of [`026`](./026-candidates-are-reconciled-not-accumulated.md) reports stranding
rather than resolving it, precisely so this is visible instead of silent.

## What is not fixed

**Unusable text is still counted as text.** A coverage figure that says "121 of
153 pages have text" is true and misleading when that text is mojibake. Honest
coverage reporting is a stated product requirement — `.docs/17-legal` rule 8 —
and a reader shown a document's figures deserves to know how much of it could
not be read. Detecting mojibake is its own problem (a ratio of unmapped glyphs,
or a dictionary check) and belongs in its own change, with its own evidence.

Recorded here rather than fixed quietly, because the gap is now known and the
next person to read a low-yield document should find this instead of
rediscovering it.

## Consequences

- 10 documents, 2,792 pages, 2,276 candidates awaiting review.
- Published money facts: 1,573 audited for both defects, **0 fabricated, 0
  mis-scaled**. Six were revised to rejected, each with the reason on the fact.
- The three original documents produce 0 new and 0 retired candidates under
  `cag-facts/7`, so the fixes changed nothing that was already right.
