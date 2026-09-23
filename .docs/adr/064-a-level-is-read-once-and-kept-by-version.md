# ADR-064 · A level is read once, and kept by version

**Status:** Accepted · **Date:** 2026-09-23 · **Implements** phase 5 of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md) · **Builds on** [`053-every-explorer-payload-states-its-dataset-version.md`](./053-every-explorer-payload-states-its-dataset-version.md)

## Context

The explorer drew a level inside a place from two requests: `/geo/units/:id/children` for the units
and their coverage, and `/geo/units/:id/boundaries` for their shapes. Each ran in its own ledger
snapshot and named its own version. A load committing between them could put a unit in the rail with
no shape on the map, or a shape on the map missing from the rail. Both are the page contradicting
itself about the same place.

On the client, every panel ran its own `fetch` in its own `useEffect`:

- Leaving a place aborted its reads and threw away what they had returned. Drilling into a district
  and back out, which is the normal path, downloaded the state's level again, and the district's
  again after that.
- Nothing compared the versions responses named. A panel served from the HTTP cache (`max-age=300`)
  could show an older ledger than the panel beside it, with nothing on the page saying so.
- Nothing stopped two panels asking for the same URL making two requests.

## Decision

**One level endpoint.** `GET /api/v1/geo/units/:id/level` returns `units`, `coverage`, `sources` and
`boundaries`, read in one `inLedger` snapshot with one `datasetVersion`. The children and boundaries
routes are removed; the explorer was their only client, and two paths to one level is how they drift.

The place's own outline is not in the payload. A state's averages 86 KB (274 KB for the largest)
at detail tolerance, and the explorer draws it only once a unit is selected. It stays on
`/geo/units/:id`, which also serves the screens in `.docs/11-api/screen-api-matrix.md`.

**One browser cache for every explorer read**, in `apps/web/src/lib/resource-cache.ts`, bound to React
by `useResource` in `use-resource.ts`:

- **Single flight.** Concurrent reads of a URL share one promise.
- **Kept, not aborted.** A component moving on stops listening but lets the request finish, because
  another panel may share it and the reader may come back. A result is only ever shown under the URL
  it was read for, which is what the aborts used to guarantee.
- **Failures are not cached,** and a failed read evicts only its own entry, never a newer read of the
  same URL that replaced it. This is the rule taken from God's Eye View.
- **Versions decide staleness, not time.** The highest version any response names is the watermark.
  When it rises, every settled entry from below it is dropped and every mounted `useResource` reads
  again. Until the new result arrives, the old one for the same URL stays on screen: it is still
  what that URL said, and blanking it would read as data vanishing.
- **A response older than the watermark is asked for once more past the HTTP cache**
  (`cache: "reload"`). Whatever the second answer is gets accepted, so a server that is itself behind
  cannot cause a loop.
- **A payload that names no version is refused,** because it cannot be placed against the others.
- Bounded at 64 entries, least recently used first.

The static `/geo/*.geojson` loader in `map/geometry-source.ts` is left alone. Those files are
build artefacts with no ledger version.

## Consequences

Checked in headless Chromium against the local ledger, Maharashtra → Ahilyanagar. "Before" is
counted from the previous hooks; "after" was observed:

| Step               | Requests before | Requests after                   |
| ------------------ | --------------- | -------------------------------- |
| State view         | 4               | 3                                |
| Select a district  | 5               | 4                                |
| Up one level       | 5               | 2; the rail redrew within 150 ms |
| The district again | 5               | 0                                |

The level payload for Maharashtra is 390 KB uncompressed (units 212 KB, boundaries 199 KB), the
same bytes the two old routes sent between them. Its size is phase 8's concern, not this one's.

A new load now refreshes an open page as soon as any panel sees it, rather than never.

**Not in this change:**

- The panels still read separately. The cache makes a mixed-version page correct itself; it does
  not make one impossible.
- `ETag` and conditional requests.
- Version pinning from a URL (phase 7).
- "Up one level" from a district selects the state's own unit rather than clearing the selection.
  It therefore fetches the state's detailed outline, which this change kept out of the level
  payload. That behaviour predates this change and is left for phase 7's URL work.
