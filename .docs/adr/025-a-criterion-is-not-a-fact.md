# ADR-025 · A criterion is not a reported amount

**Status:** Accepted · **Date:** 2026-09-04 · **Extends:** [`024-triage-reads-the-page-not-the-window.md`](./024-triage-reads-the-page-not-the-window.md)

## Context

ADR-024 settled which of several amounts in a window a candidate is about. It
left open a question the arithmetic cannot reach at all: whether the figure is
an amount anyone reported.

Audit reports are full of numbers that are not money anyone spent:

- table captions — _"Table 1.10: Major Schemes receiving grants above ₹500 crore"_
- appendix headings — _"Grants having large saving (exceeding ₹100 crore)"_
- contents lines — _"Surrender of funds in excess of ₹10 crore"_
- audit selection rules — _"selected 40 cases where expenditure was more than ₹50 crore"_
- materiality rules — _"no comment is necessary where the excess is less than ₹50 lakh"_
- pre-qualification rules — _"for works with more than ₹50 lakh tender cost"_

Each states a cut-off the auditor chose. `₹ 500 crore` re-derives from its
sentence perfectly and passes every check the triage performs, because what
disqualifies it is not the number but what the sentence does with it.

Storing one as a monetary fact puts a figure in the ledger that no government
body ever reported, behind a correct-looking citation to a real page of a real
report. That is the failure mode `.docs/17-legal/legal-ethical-rules.md` exists
to prevent, arriving by a different route than a misread unit.

**Measured:** 12 of the 852 candidates awaiting review, and **36 of the 1,479
already verified** — including `#5972`, which had been verified in an earlier
session and which ADR-024's page context then used to settle three of its
neighbours.

## Decision

**A screen for criterion phrases (`review/threshold.ts`), advisory to a person
and never automatic.**

- `thresholdPhrase(rawText, normalisedValue)` returns the words that make a
  figure a bound — `more than`, `exceeding`, `above`, `पेक्षा जास्त`, `हून अधिक`
  — or null. It returns the _phrase_, not a boolean, so a rejection can say
  what it rejected.
- It is **deliberately narrow and biased toward missing them.** A false
  positive deletes a real government figure silently; a false negative leaves a
  candidate for a person to read. `up to`, `not exceeding` and every negated
  form are excluded: _"a benefit of up to ₹1,500 per month"_ is a scheme's
  actual rate and _"an amount not exceeding ₹500 crore"_ is a real ceiling on a
  real sanction.
- It matches the spellings this corpus actually contains, not the correct ones:
  the text layer mangles the conjunct in अधिक to अचधक, and inflection joins
  unit to criterion with a combining mark — `₹ 10 कोटींपेक्षा अधिक`.
- `review:triage` **lists** the candidates it flags. It does not count them into
  a partition, because a criterion is a question about words and the partitions
  answer questions about arithmetic.

**The screen proposes; a person disposes.** Of the 36 flagged among verified
facts, 32 were criteria and **4 were real reported quantities** kept as they
were:

| fact             | why it stayed                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `#5740`, `#6188` | _"undischarged liabilities exceeding ₹27,184 crore"_ — a reported quantum, not a filter             |
| `#6455`          | _"re-appropriations ranging from ₹five crore to over ₹250 crore"_ — the observed range of real data |
| `#6711`          | _"payments of more than ₹2.60 crore were made"_ — an actual excess payment                          |

Applying the screen's output without reading would have deleted those four.

## Decisions reached by a rule are recorded as such

Rejecting 12 candidates for one shared reason is not twelve readings of twelve
pages. The obvious way to apply it — feeding synthetic keystrokes to the
interactive prompt — would have written an audit trail claiming a person read
each page one at a time, which is worse than stating plainly what happened.

**`--decide=verified|rejected` with `--note`, and `--revise=<ids>` with the
same, apply a decision without a prompt.** The guards are the substance:

- **A note is required and may not be blank**, and is stored on every fact
  decided. A decision reached by a rule has to state the rule, or nobody can
  later tell whether it was applied to the right candidates.
- **The queue must be scoped** by `--ids` or `--check`. "Decide everything
  outstanding" is not expressible.
- **`corrected` is refused.** A correction carries a per-fact value that one
  flag cannot honestly supply for a set.
- **Revision names its facts explicitly** and never walks a queue, and
  migration 0009's trigger keeps every superseded decision.

This does not weaken ADR-021. Review remains a local CLI running as the
column-scoped reviewer role; what is added is honesty about how a decision was
reached, not a new privilege.

## Consequences

- 12 candidates rejected, 32 verified facts revised to rejected, 840 verified.
  The money queue is the 288 `no_value` candidates, down from 1,140.
- `document_fact_review_history` holds 32 superseded decisions, each with its
  reason. The earlier session's verifications remain readable as what they were.
- Four verified facts are still criterion-flagged, by decision. The screen is
  advisory and will keep flagging them; that is the intended behaviour, not a
  defect to suppress.
- The screen has no automatic effect at extraction time. Suppressing these
  candidates in the parser was considered and deferred: `loadFactCandidates`
  keys identity on `(document, page, kind, raw_text, normalised_value)`, so
  changing what the parser emits needs a supersession path that does not yet
  exist.
