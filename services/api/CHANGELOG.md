# @lokdarpan/api

## 0.0.5

### Patch Changes

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

## 0.0.4

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

- Updated dependencies [ffa8dfc]
  - @lokdarpan/database@0.1.0
  - @lokdarpan/domain@0.1.0

## 0.0.2

### Patch Changes

- Updated dependencies [3511219]
  - @lokdarpan/database@0.0.2

## 0.0.1

### Patch Changes

- 113f4cb: Stop the redaction test failing on its own timestamp.

  `REDACTS anything that could leak what a user investigates` asserted that the
  emitted line does not contain `18.5`, the latitude it feeds the logger. The line
  also carries an ISO timestamp, and one emitted in second 18 with milliseconds
  `5xx` reads `…T17:29:18.567Z` — which contains `18.5`.

  Roughly one run in six hundred, therefore, the test failed and pointed at
  redaction, which was working the whole time. It failed three times in one
  afternoon.

  The substring check now runs over the payload with the timestamp removed, and the
  timestamp is asserted separately for its shape. The test still checks that no
  field leaks anywhere in what is written.

- Updated dependencies [f714c0e]
- Updated dependencies [5ad02db]
- Updated dependencies [e6b2d88]
- Updated dependencies [926e4a8]
- Updated dependencies [6f02caa]
- Updated dependencies [0e4349a]
  - @lokdarpan/contracts@0.1.0
  - @lokdarpan/database@0.0.1
