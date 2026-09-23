# @lokdarpan/domain

## 0.3.0

### Minor Changes

- 469deb8: Describe collection, currency and completeness in one data-state model.

  Tender collection and geography coverage each had their own status vocabulary, and each folded
  independent facts into one value. `DataState` answers three questions separately: is it collected,
  is it current, is it whole. One precedence rule gives a panel its headline, and `mayShowCounts`
  allows a count only for data that is collected.

  Boundaries report `held` rather than `current`, because nothing schedules them. There is no "not
  published" state until something records the evidence one would need.

  The tender overview gains `collectionState` and each coverage entry gains `state`; existing fields
  are unchanged. No reader-facing wording changes in this release.

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

- 03e5402: Serve unit views whose units came from several loads (ADR-053 addendum).

  `UnitService` no longer refuses a payload that spans loads. Geography is loaded district by district,
  so it refused every real state. The web routes read inside the ledger snapshot and report its
  watermark, and each unit keeps its own `provenance.datasetVersion`. `singleDatasetVersion` and
  `ViolationSink` are removed; `newestDatasetVersion` replaces them for callers with no snapshot.
  `PostgresAdminUnitRepository` accepts a snapshot client.

### Patch Changes

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

## 0.2.0

### Minor Changes

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

## 0.1.0

### Minor Changes

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
