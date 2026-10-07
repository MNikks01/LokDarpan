# ADR-074 · A public body is named by the page that names it

**Status:** Accepted · **Date:** 2026-10-07 · **Implements** LD-007 and LD-008 of milestone M1 (#187) · **Builds on** ADR-033, ADR-051, ADR-068, ADR-072, ADR-073

## Context

The ledger has three unlinked spellings of "who": `department` (a BEAMS letter code under a state),
`tender.department` (GePNIC text) and `document.issuing_authority` (text). The architecture plan
(`02-architecture/PUBLIC_FINANCE_GRAPH_ARCHITECTURE.md` §4 Q11) makes a `public_body` the first
entity everything else attaches to, and M1 asks for a Maharashtra Public Works Department page.

A body needs a name a reader may be shown. Three sources were considered:

| Source         | Names                                              | Publishable?                                                      |
| -------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| BEAMS          | Department names, by code                          | Withheld until the Finance Department permits (deferred, ADR-073) |
| IGOD directory | 301 Maharashtra organisations, with official sites | Terms and `robots.txt` never checked (#182)                       |
| CAG reports    | Departments named in the reports' own text         | **Permitted**, already in production                              |

The maintainer chose the CAG route on 7 October 2026, accepting that it puts a review queue in
front of every name.

## Decision

1. **A body exists because a person confirmed a page names it.** The CAG extractor proposes
   `body_reference` candidates — "<Name> Department" and "Government of <Place>" — each with its
   page and sentence. They go through the existing review queue (ADR-068);
   `pnpm review --kind=body_reference --state=27` scopes a session to Maharashtra.
2. **One candidate per name per report**, at its first page. A report names its Finance
   Department dozens of times, and each is the same claim.
3. **`public_body` and `public_body_mention`** (migration 0045). `ingest:bodies` makes them agree
   with the reviewed facts: one body per (jurisdiction, kind, reviewed name), one mention per
   confirmed fact. A correction is a different name and so a different body; the old one stops
   being shown when nothing confirms it. Nothing is renamed in place.
4. **A body is shown only while a mention confirms it**: a fact verified or corrected, not read from
   a scan (ADR-072), from a source whose terms permit republication (ADR-073). Otherwise
   `/api/v1/bodies/:id` is not found, and the body is absent from its unit's list.
5. **A mention cites a page; it does not attribute that page's figures.** The Body page lists the
   reviewed pages and their sentences, and sends the reader to the report for what those pages say
   about money. No figure is gathered under a body's name.

## Two judgements this rests on

**A department's name is not the kind of name ADR-033 withholds.** ADR-033 rejects
`contractor_reference` and `officer_role_reference` because rule 1 of the legal rules concerns
persons, officials and firms: a name beside an audit observation becomes the observation, with
someone attached. A government department is the subject audit reports are written about, by
law; naming it beside its report is what the report itself does. The page still makes no
statement of its own about the department — it lists where the report names it.

**A department's state comes from how its report was filed.** CAG documents are placed by the
state they were fetched under (`geography_source = 'publisher_filter'`, migration 0027), not by a
statement in the report. A state Accountant General's report audits that state's government, so a
department it names is read as that government's. When a report names another government's body
— "Central Public Works Department" in a Maharashtra report — the reviewer rejects the mention; the
loader does not guess. "Government of <Place>" is placed by matching the place to a unit in the
hierarchy, and left out (and reported) when it matches none.

## Consequences

- M1's Body page exists without any permission or new source. It is as complete as the review:
  about 220 Maharashtra candidates on the current corpus, roughly 100 distinct names.
- `public_body` is deliberately narrower than the architecture document's sketch: no identifiers,
  aliases, jurisdiction table or validity dates yet. Each arrives with the source that needs it —
  BEAMS codes as identifiers when BEAMS is linked, IGOD names as aliases if #182 permits.
- The tender organisation chain and `department` are not linked yet (LD-010).
- Department pages for Madhya Pradesh and Tamil Nadu reports follow from the same review; nothing
  in the model is Maharashtra-specific.
- **Production** receives bodies the way it receives figures: the reviewed facts travel with
  `promote:cag`, and `ingest:bodies` is then run against production with the owner credential
  (`16-operations/reviewing-public-bodies.md`).
