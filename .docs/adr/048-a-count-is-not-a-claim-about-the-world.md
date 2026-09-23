# ADR-048 · A count is not a claim about the world

**Status:** Accepted · **Date:** 2026-09-05 · **Extends** [`029-an-unreachable-audit-is-not-a-clean-audit.md`](./029-an-unreachable-audit-is-not-a-clean-audit.md)

## Context

Two surfaces reported a number and were read as reporting a fact about India.

**Tenders.** Maharashtra holds no tenders, and the panel said **"0 tenders"**.
The count is true. The statement a reader takes from it is false: no Maharashtra
portal is collected at all — `mahatenders.gov.in` serves `Disallow: /` — so the
zero measures our reach and reads as the government's silence. The panel could
not have said otherwise: nothing in the database linked a portal to a state, and
it dated every state's figures by `windows[0]`, whichever row came back first.

**Geography.** Pune district holds 14 talukas and no urban local body, so the
area selector offered 14 things. Pune Municipal Corporation plainly exists. The
interface was reporting our holdings, and there is no way to read it except as a
statement about Pune.

Both are the same defect. A count answers "how many do we hold". Rendered
alone it answers "how many are there", and the second is a claim about a
government that we have no evidence for. [ADR-029](./029-an-unreachable-audit-is-not-a-clean-audit.md)
drew this line for an audit report that could not be fetched; these are the same
line drawn for a collection that was never attempted.

## Decision

**Absence of records is recorded as its own fact, never inferred from a count.**

`geography_coverage` holds, per unit and level, whether our holdings are
`complete`, `partial` or `not_collected`, with a note that is **required** for
anything short of complete — "some are missing" is not a finding until it says
how that is known. Coverage is scoped to a state and a level, because it is a
property of a source's treatment of a level across the state: OpenStreetMap tags
few of Maharashtra's municipal bodies everywhere, not specially in Pune.
Recording it per district would be 36 copies of one fact and would suggest Pune
was assessed on its own. A district inherits its state's finding, nearest
ancestor first.

**Collection status is derived, never stored as a flag.** A state is
`not_collected` when no `tender_collection_window` claims to collect it — not
because somebody set a column, which is a claim that goes stale on its own. From
the window's own timestamps come three further states: `failing` when the last
attempt is later than the last success, `stale` when no success in 48 hours, and
`collected` otherwise.

**The three timestamps stay apart.** `last_seen_at` is when a record was
observed, `last_checked_at` when the source was attempted, `last_success_at`
when an attempt completed. With only the last of these, a portal checked hourly
and failing hourly is indistinguishable from one nobody has looked at since the
same moment. The first is a fault to fix; the second is a schedule that stopped.

`state_lgd_code` identifies the state, never its name — names vary by source and
get renamed. Migration 0023 leaves it null rather than reading `madhyaprades` as
Madhya Pradesh; `backfill:portal-states` fills it from the portal registry,
which is a recorded pairing rather than a guess at a string.

## Consequences

Maharashtra now reads _"Tender data is not currently collected for Maharashtra"_
and **shows no count at all**, because a count beside that sentence would be
taken as the finding and the sentence as a footnote. Pune's selector says
local-body coverage is incomplete and names what is missing.

A collected state that genuinely holds no tenders still shows zero. That is the
point of separating the two: there the zero is a measurement.

**The 48-hour threshold is a judgement, not a measurement.** The GePNIC landing
page is polled daily, so two days is the first interval that cannot be one
missed run. It is deliberately generous — calling fresh data stale costs a
reader nothing, and the reverse is the failure this project exists to avoid.

A window whose portal is not in the registry cannot report a status for its
state. One exists (`tn`); the backfill names it rather than leaving it to be
discovered.
