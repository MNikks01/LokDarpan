# @lokdarpan/web

## 0.2.0

### Minor Changes

- 744bdda: Name the real dataset version on every explorer response.

  The seven explorer routes returned `datasetVersion: 0`, and every response's `asOf` was the time
  it was served. Neither described the data, so nothing could tell which state of the ledger a page
  came from.

  A response's version is now the newest dataset version committed when it was read, and `asOf` is
  when that version was opened. Each route reads inside one read-only snapshot
  (`readLedger`), so a load that commits mid-request cannot put rows from one state under the version
  of another. Routes whose version comes from their rows keep it, and now report that version's date
  instead of the time of the request.

  `EnvelopeMetaSchema.asOf` may be `null`, only for a ledger no load has written to.

- c34d4e1: Define each map layer in one file and apply them through one binder (ADR-058).

  State outlines, the selected unit, tender shading and child boundaries are now `LayerDefinition`s in
  `map/layers/`, listed in a static registry that `map/style.ts` builds its overlay from. The binder in
  `map/engine/binder.ts` applies their data, filters and visibility to MapLibre only when they change,
  and runs the one hit test in a fixed order.

  A layer that cannot name the source of what it draws, or whose data is not collected, draws nothing.
  A test now fails if any map layer uses red.

- 0a75f88: Carry layers and the department filter in the explorer's URL, and let a reader copy a link that
  names the dataset version (ADR-061).

  `layers=` (tokens `so`, `cb`, `pn`, or `none`) and `dept=` are written only when they differ from the
  defaults. "Copy link to this view" adds `v=`, the dataset version the view was drawn from. The server
  drops a version the ledger does not hold. Opening a pinned link says whether what is shown is that
  version or a later one. Any navigation drops the pin.

  "Up one level" from a district now returns to the state view instead of selecting the state's own
  unit.

  New sentences, for review:

  - "Copy link to this view"
  - "Link copied. It names the dataset version this view was drawn from."
  - "The link could not be copied here. Select it below and copy it."
  - "This link was made from dataset version {v}, opened {date}. What is shown is that version."
  - "This link was made from dataset version {v}, opened {date}. LokDarpan has loaded data since, and
    what is shown is version {current}. Earlier versions of boundaries and counts are not kept, so
    this may differ from the view that was shared."

- 469deb8: Describe collection, currency and completeness in one data-state model.

  Tender collection and geography coverage each had their own status vocabulary, and each folded
  independent facts into one value. `DataState` answers three questions separately: is it collected,
  is it current, is it whole. One precedence rule gives a panel its headline, and `mayShowCounts`
  allows a count only for data that is collected.

  Boundaries report `held` rather than `current`, because nothing schedules them. There is no "not
  published" state until something records the evidence one would need.

  The tender overview gains `collectionState` and each coverage entry gains `state`; existing fields
  are unchanged. No reader-facing wording changes in this release.

- 8cf982e: Read a level inside a place in one request, and keep explorer reads by dataset version (ADR-064).

  `GET /api/v1/geo/units/:id/level` returns a place's units, coverage, sources and boundaries from one
  ledger snapshot, so the rail and the map can no longer describe different versions. It replaces
  `/geo/units/:id/children` and `/geo/units/:id/boundaries`, which are removed.

  Every explorer read now goes through one browser cache: concurrent reads of a URL share a request,
  a place the reader returns to draws without a request, failures are not kept, and a newer dataset
  version seen by any panel drops older entries and makes the other panels read again.

- 3a065fc: Measure the explorer's performance against its budgets, and load the map after the page is
  interactive (ADR-062).

  `perf:bytes` gzips `/explore`'s initial JavaScript from the build and fails over the 600 KB ceiling
  (CI gate G7). `perf:runtime` drives a production server on desktop and throttled-mobile profiles and
  reports medians and p75s against the budgets. The page marks `explorer:hydrated`, `map:init`,
  `map:load` and `map:boundaries-drawn` for it.

  MapLibre is now loaded with `next/dynamic` after hydration. Initial JavaScript for `/explore` falls
  from 404.9 KB to 120.5 KB, and the rail becomes usable sooner on a throttled phone. The map itself
  loads about half a second later there, still within budget.

- 79e0920: Draw each place's name inside the place, and stop names flickering.

  Names were anchored at the middle of a unit's bounding box, which for a coastal district or a
  crescent-shaped taluka can be in the sea or a neighbouring unit, and overlaps were ranked by
  bounding-box area in square degrees. Migration 0032 adds `label_point`, the centre of the largest
  circle inside the unit, and `area_m2` as generated columns, and boundary features now carry both.

  Placement is decided by a neutral arbiter: selection, administrative level, and area bucketed by
  powers of two, with nothing from a place's records. A just-shown name holds for 600 ms and a hidden
  one waits 400 ms, so names no longer flicker at the edge of a collision. Collision tests use a
  spatial grid, and names are measured in one batch.

  Names stay as DOM text because MapLibre 5.24 cannot shape Devanagari, Tamil or other Indic scripts.
  Their visibility is written inside the marker, because MapLibre resets a marker's own opacity on
  every move, which had redrawn hidden names on top of each other.

- 52a6d22: Say what LokDarpan holds in the reviewed wording, from one place.

  The tender and boundary panels now read the shared data-state model instead of their own status
  fields, and every sentence about the state of data lives in `apps/web/src/copy/data-state.ts`.
  Five sentences changed, each reviewed before release:

  - A failed tender request says it "could not be loaded just now. This is a fault here, not a
    statement about any portal." "Unavailable" could be read as a portal withholding data.
  - Stale tenders give the date they were last collected, instead of "more than two days ago", which
    duplicated a code constant.
  - An empty tender list states when collection began, instead of "Collection began recently", which
    stops being true.
  - A partially held level says "Not every municipal body is held." rather than "coverage is
    incomplete", which could be read as a gap on the government's side.
  - A portal registered but never collected successfully says "LokDarpan has no record of checking
    its e-procurement portal for {state}" and shows no count, where it previously showed a zero.

  A boundary level marked not collected now keeps the note recorded with it.

- 59de13e: Record the terms of every source the explorer shows, and state them on its responses.

  The licence registry had no entry for OpenStreetMap or for the GePNIC state tender portals, though
  both are displayed. Both were fetched and recorded on 17 September 2026. OpenStreetMap permits reuse
  under the ODbL. All 21 collected tender portals permit reproduction only after permission from the
  issuing department; Madhya Pradesh requires it in writing.

  `describeSources` turns source ids into descriptors (publisher, republication terms, terms URL,
  verification date, caveat). The tender overview and a unit's children now return them as `sources`.
  Collector ids such as `gepnic-kerala` resolve to their publisher's entry; unrecorded ids are
  `unknown`, never permitted.

  Nothing a reader sees changes. Tenders remain listed while the decision on their terms is open.

- 65f19bd: Link to tender portals instead of reproducing their tenders.

  All 21 collected GePNIC portals permit reproduction only with the issuing department's permission,
  which has not been sought (ADR-055, ADR-056). Tender titles, references, values, EMDs, organisation
  chains and locations are no longer shown, and `/api/v1/tenders` no longer reads them unless
  `PUBLISH_TENDER_DETAILS` is `true`. District shading and counts remain.

  A selected place now shows how many open tenders are held, why details are not shown, and a link
  to its state's portal, which the portals' terms allow. The unplaced-tenders list can no longer be
  opened while details are withheld. The portal table moves from the collector to
  `@lokdarpan/domain` so the explorer can link to it; the collector re-exports it unchanged.

  New sentences, for review:

  - "{n} open tenders are held for offices here."
  - "Tender details are not shown. The state portals permit reproducing them only with the issuing
    department's permission, which LokDarpan has not sought."
  - "Read these tenders on the state's e-procurement portal" (link)
  - "Their details are not shown, for the same reason as other tenders." (after the unplaced count)

### Patch Changes

- b04aadb: Check import direction instead of describing it (ADR-059).

  `pnpm architecture` walks every tracked file's imports, transitively, against six rules: rendering
  code reaches no database or I/O, sources reach no UI, the domain reaches nothing, client code takes
  only `format*` from `@lokdarpan/money`, the map takes no ingestion types, and label placement reads
  no figures. It runs as CI gate G2.

  `@lokdarpan/money` adds `formatAmount` and `formatAmountSpoken`, which take the server's decimal
  string. `Figure`, `MoneyTrail` and `PublishedFacts` use them instead of holding a `Money` they could
  do arithmetic with.

- c472e32: Draw a level from outlines simplified when they were loaded, and shade tenders without re-sending
  the level (ADR-065).

  Migration 0033 stores `geometry_overview`, each boundary simplified once. The level endpoint for
  Madhya Pradesh falls from ~580 ms to ~62 ms. Containment now tests the stored label point and
  requires a child to be smaller than its parent. That removes 79 pairs where a state or district was
  listed as the child of one of its own smaller units.

  Tender counts reach the map as feature-state, so the level's geometry is sent once per visit and a
  department change moves only numbers.

- 291e280: Upgrade past four published advisories, and make the audit gate apply the level it is given.

  - `next` 15.5.23 → 15.5.26: two critical advisories, remote code execution through image optimisation
    and on Windows-hosted servers.
  - `maplibre-gl` 5.24 → 6.11.1: a critical XSS in its HTML sanitiser, unpatched in any 5.x. MapLibre 6
    loads its worker as an ES module from beside its own module, which under Next is a `file://` URL,
    so the map did not load. The worker is now copied to `public/maplibre/<version>/` before `dev` and
    `build`, and `MapCanvas` points MapLibre at it. MapLibre 6 requires WebGL 2; a browser without it
    gets the map-unavailable message, as for any renderer error.
  - `sharp` ≥ 0.35.4 and `js-yaml` ≥ 4.3.2, by override: high advisories in packages brought in by
    `next` and `@commitlint/cli`.

  `audit-dependencies.sh` failed on advisories of any severity. With `--json`, pnpm 9 exits 1 on any
  advisory whatever `--audit-level` says. It now applies the level to the report: advisories at or
  above it fail, and those below are listed as a notice. Still listed: a moderate advisory in `vitest` 3,
  fixed only in 4.

- 4a831f0: Scope the tender panel to the selected state.

  With a state selected, `/api/v1/tenders/overview` returned the country's district counts,
  departments and unplaced total. The panel under Odisha said "12 open tenders across 6 districts"
  when all twelve were in Madhya Pradesh, Uttarakhand, Jharkhand and Kerala. District counts are now
  limited to districts inside the state. The departments, the unplaced total and the unplaced list
  (`/api/v1/tenders?unplaced=true&state=`) are limited to the state's own portals, since an unplaced
  tender has no district to go by. With no state selected, nothing changes.

  A collected state with nothing to shade no longer reads "0 open tenders across 0 districts".

  New sentence, for review:

  - "No open tender is held for offices in a district of {state}. This describes what LokDarpan holds,
    not what was advertised."

- 03e5402: Serve unit views whose units came from several loads (ADR-053 addendum).

  `UnitService` no longer refuses a payload that spans loads. Geography is loaded district by district,
  so it refused every real state. The web routes read inside the ledger snapshot and report its
  watermark, and each unit keeps its own `provenance.datasetVersion`. `singleDatasetVersion` and
  `ViolationSink` are removed; `newestDatasetVersion` replaces them for callers with no snapshot.
  `PostgresAdminUnitRepository` accepts a snapshot client.

- Updated dependencies [744bdda]
- Updated dependencies [b04aadb]
- Updated dependencies [c472e32]
- Updated dependencies [469deb8]
- Updated dependencies [79e0920]
- Updated dependencies [52a6d22]
- Updated dependencies [59de13e]
- Updated dependencies [4a831f0]
- Updated dependencies [65f19bd]
- Updated dependencies [03e5402]
  - @lokdarpan/database@0.3.0
  - @lokdarpan/contracts@0.2.0
  - @lokdarpan/money@0.1.0
  - @lokdarpan/domain@0.3.0

## 0.1.0

### Minor Changes

- fa620ba: Stop a count from standing in for a claim about a government, and stop a tender
  from forgetting what it used to say.

  Maharashtra held no tenders and the panel said "0 tenders" — a true count and a
  false statement, since no Maharashtra portal is collected at all. Pune district
  holds 14 talukas and no municipal body, and the area selector could only be read
  as a statement about Pune. Both surfaces now record absence as its own fact:
  `geography_coverage` says whether a level is complete, partial or uncollected
  and why, and tender collection status is derived per state from the collection
  window rather than inferred from a total.

  `tender` was written by an upsert, so a closing date moved from 18 to
  25 September left no trace of the 18th. A trigger now keeps every superseded
  reading, following the pattern migration 0009 established for review decisions:
  append-only, written by the database, and only when a field the source controls
  actually changes. Re-ingesting identical data creates no version. The tender row
  stays the current reading, so nothing downstream reconstructs anything.

  `ingestion_run` records each execution with its status, timing and counts,
  opened before the load's transaction and closed after it, so a failed run rolls
  the ledger back without rolling back the account of the failure. Freshness now
  distinguishes when a record was seen, when the source was checked, and when
  collection last succeeded.

  No Maharashtra tender data is collected, invented or implied by any of this.

- 844bb2d: Make the selected place decide what records are shown.

  The explorer asked for records by state code at every level, so Maharashtra,
  Nagpur district and Nagpur Municipal Corporation all returned the same thirty
  state-wide audit reports. Records are now queried by `admin_unit.id`, exactly and
  without inheritance — the LGD code the query used before is per-register and
  collides across levels, so a state's own code also names a district elsewhere.

  `document.geography_source` records how a placement was reached, mirroring
  `tender.district_source`. One value exists, `publisher_filter`, because one basis
  exists: the CAG site's own state filter. No document was re-attributed, because
  none carries evidence for anything narrower than a state — a report issued by the
  Accountant General at Nagpur is not a report about Nagpur, and its title is not
  evidence.

  Maharashtra shows its 10 documents; Nagpur, its talukas and its municipal
  corporation show none, and the panel says what that means rather than implying an
  absence of audits. Documents with no established geography are reachable at
  `?unresolved=true`.

  Village coverage is now stated for Maharashtra — 40 held, all inside one
  district, against a state with more than forty thousand — and the boundary
  artifacts are regenerated from the ledger.

- cc475cd: Production hardening for Maharashtra, from a full audit.

  A deep link could pair one state with a unit inside another: `?state=27&unit=<a
Kerala district>` rendered the selector as Maharashtra, framed the map on Kerala
  and drew Kerala's breadcrumb under a Maharashtra heading — every part correct on
  its own and the page as a whole saying something false. The pair is now
  reconciled on the server before the first render, keeping the state and dropping
  the unit, so a mistyped id never silently moves a reader to another state.

  The three tables added since migration 0002 reach the API's role through
  `ALTER DEFAULT PRIVILEGES`, so no migration names them and development connects
  as the owner — a regression would have been seen first in production. They are
  now exercised as `lokdarpan_api`: readable, and unwritable.

  A collection window for portal `tn` asserted that a portal was being watched
  from 1 September. The registry has no such code, it held no tenders, and Tamil
  Nadu's real window carries the same date and 32 tenders, so it was the one window
  that could never report a status. Removed, conditionally, with Tamil Nadu's floor
  untouched.

  Also records what the audit found rather than fixing it silently: nothing is
  scheduled, so every collected state correctly reads `stale`, and `/explore` has
  grown to 409 kB first-load against the ~291 kB ADR-022 recorded.

### Patch Changes

- Updated dependencies [fa620ba]
- Updated dependencies [844bb2d]
- Updated dependencies [cc475cd]
- Updated dependencies [328b3b4]
- Updated dependencies [d355358]
- Updated dependencies [db1f218]
  - @lokdarpan/database@0.2.0
  - @lokdarpan/domain@0.2.0

## 0.0.3

### Patch Changes

- ffa8dfc: Give a rate its denominator, and restore the figures that can now state one.

  ADR-044 withheld 118 published rates because `document_fact` had no denominator,
  so a page rendered ₹15 where the source says ₹15 per record. It named the
  reversal condition exactly — a unit on the schema, rendered or nothing — and this
  is that work.

  Migration 0020 adds `per_unit`, exposed through `published_fact`, carried on the
  domain type, and rendered beside the figure in the words the page uses. The
  accessible label says it too: a screen reader must not be told a rate is a sum
  either.

  The denominator is read forward from the amount and never inferred. "at the rate
  of ₹60,000" states a rate whose unit sits elsewhere in the sentence, and choosing
  which noun it belongs to would be inventing a denominator for a government
  figure. Such rates stay refused.

  Where the reading stops was set by real captures, each now a test: a capitalised
  word after a lowercase one opens something new ("per beneficiary **Quantity** in
  grams"); past the first word only a measure noun continues a unit ("per month
  **since** April"); after a second "per" exactly one word ("per IPD patient per day
  **respectively**"); a denominator may itself be money ("₹2 per ₹100"); and a unit
  the evidence window cut off is not read at all — "₹100 per Cu…" is "per Cu.M." on
  the page, and Cu is not a cubic metre.

  Of the 118, **64 are restored** and 54 stay withheld. Published facts rise 5,029 →
  5,088, of which 60 now say what they are per, and no published rate lacks a
  denominator.

  Also fixes a defect this exposed: two figures in one sentence can share an
  identity, since a page declaring its own scale refuses both "₹2" and "₹100" in
  "₹2 per ₹100" and gives both a null value. The reading without a denominator was
  overwriting the one with. Candidates are now deduplicated per identity,
  preferring the reading that carries a denominator.

- Updated dependencies [ffa8dfc]
  - @lokdarpan/database@0.1.0
  - @lokdarpan/domain@0.1.0

## 0.0.2

### Patch Changes

- Updated dependencies [3511219]
  - @lokdarpan/database@0.0.2

## 0.0.1

### Patch Changes

- Updated dependencies [f714c0e]
- Updated dependencies [5ad02db]
- Updated dependencies [e6b2d88]
- Updated dependencies [926e4a8]
- Updated dependencies [6f02caa]
- Updated dependencies [0e4349a]
  - @lokdarpan/contracts@0.1.0
  - @lokdarpan/database@0.0.1
