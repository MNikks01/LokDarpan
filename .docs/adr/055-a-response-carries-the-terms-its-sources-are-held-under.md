# ADR-055 · A response carries the terms its sources are held under

**Status:** Accepted · **Date:** 2026-09-17 · **Implements** the second half of phase 4 of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md) · **Builds on** [`../06-government-sources/source-licences.md`](../06-government-sources/source-licences.md)

## Context

The explorer shows data from several publishers, and the only record of where each piece came from
was an attribution line in the layers panel. The adoption plan asks that the map be able to answer
"where did this come from, and on what terms is it shown?" from the payload itself.

A registry of publishers' terms already existed in `packages/domain/src/source-licence.ts`: LGD,
CAG, BEAMS and PMGSY, each transcribed from a fetched page. Building on it showed that **two sources
the explorer displays had no entry.** One was OpenStreetMap, whose boundaries and base map are
drawn. The other was the GePNIC state tender portals, whose tenders are listed.

Both were fetched on 17 September 2026 and recorded in `source-licences.md` §5–6:

- **OpenStreetMap** permits reuse under the Open Database License, with attribution. Its
  share-alike clause applies to our simplified boundaries.
- **All 21 collected GePNIC portals** publish a Copyright Policy permitting reproduction only "after
  taking proper permission from the respective Organisation / Department"; Madhya Pradesh requires
  written permission. That is the clause under which BEAMS figures are withheld. Linking directly
  needs no permission.

## Decision

**Record what was found; change nothing a reader sees in this step.**

- The registry gains `gepnic` (`permission_required`) and `openstreetmap` (`permitted`), each with
  its terms URL, verification date and verbatim caveat.
- A collector id resolves to its publisher's entry: `gepnic-kerala` to `gepnic`,
  `openstreetmap-overpass` to `openstreetmap`. An id matching neither is unrecorded, and still
  refused.
- `describeSource` / `describeSources` give each response a `SourceDescriptor` per source: the
  publisher, the recorded republication terms (`unknown` when none are recorded, never assumed
  permitted), where the terms were read, when, and the caveat.
- `/api/v1/tenders/overview` and `/api/v1/geo/units/:id/children` return `sources`.

**The descriptor states the record; it does not decide display.** Whether tenders stay on screen is
not an engineering choice.

## Consequences

The tender overview now says, in its own payload, that its material is held under terms requiring
permission that has not been sought. That is true, and it was true before this change without being
visible anywhere.

**Open decision, for the maintainer:** tenders from all 21 portals are listed on the explorer
(since #55, `93bc1ef`) under terms that require permission not yet sought. The same clause led to
BEAMS figures being withheld. The options are recorded in the adoption plan; this ADR takes none of
them.

Retrieval time and dataset version stay where they already are, in `DataState` and `meta`. The
descriptor holds the terms only.
