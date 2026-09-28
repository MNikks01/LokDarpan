# ADR-068 · A reviewer decides what no rule can

**Status:** Accepted · **Date:** 2026-09-29 · **Extends**
[ADR-067](067-a-tender-district-can-be-inferred-and-says-so.md) · **Migration:**
`0035_a_reviewer_places_what_no_rule_could.sql`

## Context

ADR-067's resolver leaves a tender unplaced unless its evidence points one way. Two kinds of
unplaced tender remain that no further rule should touch:

- **A name the ledger spells differently.** A chain reads "Division No. 2, Muktsar"; the district is
  Sri Muktsar Sahib. Matching a name inside a longer one would fix that and also turn "Kanpur" into
  whichever of Kanpur Nagar or Kanpur Dehat it met first.
- **A name that means two districts, or none.** "Imphal" spans Imphal East and Imphal West; a
  state-level office names no district at all.

## Decision

**Reviewed aliases.** `data/reference/district-aliases.json` lists names a chain uses for a district
the ledger names differently: state, alias, district by LGD code, evidence, and who approved it and
when. Only `approved` entries are used. An alias applies within its state, to one district, and never
to a name that could mean two. A placement made through one keeps the method the chain earned and
records `alias:<name> → <district>` as its evidence key, and the reader is told the office's name was
read through a reviewed alias. `district-aliases.test.ts` refuses an approval without a name and
date, and one name aliased twice in a state.

**Manual decisions.** `tenders:place` records a reviewer's decision in `tender_district_decision`:
a district of the tender's own state, or "cannot be placed". Every decision is signed and reasoned,
and no one can edit it; a later decision supersedes an earlier one. A placement written this way has
`district_source = 'manual'`, confidence 0.8, and `district_evidence_key = 'decision:<id>'`, and the
database refuses a manual placement that does not name its decision. The reviewer role
(`lokdarpan_reviewer`) gets exactly what this needs: read the tender, insert a decision, update the
six placement columns. It cannot change what the portal published, or rewrite a decision.

**The collector never overrides a manual placement.** A rule that could not place the tender before
does not outrank the person who did.

**The review list** (`tenders:resolve`) re-runs the explicit step, with approved aliases, over every
stored chain, and leaves out every tender a reviewer has decided.

## Consequences

- Three aliases are proposed, none approved: Muktsar, Pauri and Tehri. Measured against the local
  ledger, approving them places 3 tenders. A "Kanpur" alias was considered and dropped: it would be a
  judgement, and it places nothing, because those tenders name Kanpur only in the department and the
  location, which the explicit step deliberately does not read.
- Most unplaced tenders name a state-level body, several districts at once, or only a location. Those
  are for the pincode and place-name steps once the directory is loaded, or for a reviewer.
- A reviewer's name is recorded in the ledger and not shown to readers; the map says only that a
  reviewer placed the tender.
- Production needs a login user granted `lokdarpan_reviewer` before anyone can run `tenders:place`
  there.
