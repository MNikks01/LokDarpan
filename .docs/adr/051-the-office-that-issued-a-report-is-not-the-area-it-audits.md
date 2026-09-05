# ADR-051 · The office that issued a report is not the area it audits

**Status:** Accepted · **Date:** 2026-09-05 · **Extends** [`048-a-count-is-not-a-claim-about-the-world.md`](./048-a-count-is-not-a-claim-about-the-world.md)

## Context

Maharashtra's geography became real — 36 districts, 355 talukas, 18 local
bodies, all with boundaries — and the content underneath it did not move. The
explorer asked for records by **state code** at every level, so selecting
Maharashtra, Nagpur district or Nagpur Municipal Corporation returned the same
thirty state-wide audit reports and the same 3,213 facts. A reader can only take
that as findings about the place they selected.

Two defects sat behind it.

**The query was keyed to the wrong thing, and ambiguously.** `useRecords` passed
the LGD state code, and the repository matched `u.lgd_code = $1`. LGD codes are
per-register and collide across levels: code `27` is Maharashtra the state and
also a district elsewhere. Ten such collisions exist in the ledger today, so the
scoping could return another state's district records for a state's own code.

**Nothing recorded how a document came to be filed under a place.**
`document.admin_unit_id` held a unit and no account of why. Every report we hold
points at a state because that is the filter the CAG site was fetched with — the
publisher's own classification. Nothing in the schema separated that from a
document establishing the geography it audits.

## Decision

**Records are queried by `admin_unit.id`, exactly, and never inherited.** A
district does not show its state's reports. Inheriting would put thirty
state-wide reports under all thirty-six districts, which is the original defect
with a justification attached.

**A placement says how it was reached.** `document.geography_source` mirrors
`tender.district_source`, which already draws this line for tenders, with a
constraint that a unit cannot be held without one. One value exists —
`publisher_filter` — because one basis exists. A stronger basis, where a
document states the geography it audits, would be a new value and a new
migration; defining it now would be inventing a category before anything can go
in it.

**No attribution is derived from a title.** "Nagpur Report No. 2 of 2026" was
issued by the Accountant General at Nagpur, an office that audits across the
state. Reading the title as a district would file state-wide findings under one
district and put a claim about Nagpur's administration on the page with nothing
behind it. **No existing document was re-attributed**, because no existing
document carries evidence for anything narrower than a state.

## Consequences

Maharashtra shows its 10 documents and 3,213 facts. **Nagpur district, Katol
taluka and Nagpur Municipal Corporation each show nothing** — verified against
the live ledger. That is the honest outcome, and it is the point: the lower
levels were never populated, they were showing the state's records.

An empty list is therefore something a reader will meet often, so the panel
states what it means: _"No records are currently attributed to Nagpur. That
describes what is held here, not what has been audited or spent in this area."_
The same shape [ADR-048](./048-a-count-is-not-a-claim-about-the-world.md) gives
a tender count, applied to a record list.

Documents whose geography was never established are listed by
`?unresolved=true`. None exist today, and the route exists anyway: such a
document is a real report by a real authority, and it must stay reachable rather
than vanish because no page claims it.

**This does not make the lower levels useful — it makes them honest.** Populating
a district requires a source that states the geography it concerns, and the CAG
reports we hold are state-wide by construction. Until such a source exists, a
district page correctly says it holds nothing.
