# ADR-033 · A name is not a statistic, so name facts are not published

**Status:** Accepted · **Date:** 2026-09-04 · **Governed by:** [`../17-legal/legal-ethical-rules.md`](../17-legal/legal-ethical-rules.md) rule 1

## Context

With the money queue emptied, 37 candidates remained: 2 `contractor_reference`
and 35 `officer_role_reference`. They were the last unreviewed partition and the
most consequential — [`021`](./021-review-is-a-local-tool.md) calls publishing a
claim about a named company "the most consequential write this system performs".

**What they actually are.** A name, and the sentence it was found in. Both
contractor references sit inside audit observations about insurance
non-compliance: _"insurance policy has not been renewed, resulting in putting
the work at risk"_, _"Norms of Co-Insurance basis … not followed"_. The officer
references sit beside audit findings in the same way.

`.docs/17-legal/legal-ethical-rules.md` rule 1 is the constraint:

> Never accuse individuals. No person, official, contractor, or firm is ever
> characterized as corrupt, dishonest, or guilty. **Names appear only inside
> neutral, descriptive statistics.**

A name paired with an audit observation is not a neutral descriptive statistic.
It is the observation, with a name attached. Nothing about the sentence has to
be editorialised for a reader to draw the inference the rule forbids — the
pairing does it.

**There is also no surface for them.** `PublishedFacts.tsx` renders these as
"Firm named" and "Role named" in a generic list. No screen was designed for a
name fact, and `.docs/05-data-model/screen-data-matrix.md` §3 records the
deliberate omission of any contractor score, rank, badge or flag.

**And the extraction is weak.** Of the 35 role references, **16 name only a
designation with no office** — "Secretary" eleven times, "Collector" four,
"Executive Engineer" once. Three are run-ons the trimmer produced from
"Additional Chief Secretary/Principal Secretary, Commissioner…": "Secretary,
Commissioner", "Secretary, TDD Commissioner", "Secretary, SJSAD Commissioner".
None of those is a designation anyone holds. Their `extractionConfidence` is
0.5, which the parser's own comment explains: _"A designation is easy to spot;
which office it belongs to, and whether the sentence attributes anything to it,
is not."_

## Decision

**All 37 are rejected as a class, and extraction continues.**

- Rejected **as a class, not judged individually.** The reason is not that these
  particular readings are wrong; it is that a name attached to an audit
  observation is not something this platform publishes. Reviewing them
  one at a time would have implied the opposite — that a sufficiently
  well-formed one would pass.
- **Extraction is unchanged**, so the evidence stays in `document_fact` and is
  available to a future surface designed for it. Rejecting a candidate withholds
  it from `published_fact`; it does not destroy it.
- **This is reversible and needs a decision to reverse.** If a surface is ever
  designed where a name genuinely sits inside a neutral statistic — a
  concentration figure attached to a _scope_ rather than a firm, as
  `.docs/07-analytics` describes — these can be revisited with `--revise`.

## A firm cut mid-name is not a firm

One extraction defect was fixed rather than merely rejected, because it would
recur on every future document.

The page names a joint venture: **"M/s Water Staywordship Organization J.V
Baramati"**. The capture stops at the full stop in "J.", and the trimmer then
dropped the stray "J" and kept the rest — yielding "Water Staywordship
Organization", which names _one partner_ rather than the venture the page names.

A trailing initial means the capture stopped **inside** a name. `trimToName` now
returns nothing in that case. The asymmetry this parser is built on decides it:
a missed firm costs a reviewer nothing, a misnamed one attaches the wrong
company to a public claim.

`PARSER_VERSION` becomes `cag-facts/6`.

## Consequences

- **The review queue is empty**: 1,560 verified, 23 corrected, 81 rejected, 0
  awaiting review. `published_fact` holds 1,583 rows, all monetary.
- Re-extraction reports **one stranded decision** — fact `#5388`, the truncated
  firm name, which the parser no longer produces. Its rejection stands untouched,
  which is [`026`](./026-candidates-are-reconciled-not-accumulated.md)'s rule
  working: the parser does not withdraw a person's decision. Harmless here
  because the decision was to reject it anyway.
- Every published fact is now a monetary amount with provenance. No name reaches
  a reader.
