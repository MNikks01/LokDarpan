# @lokdarpan/web

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
