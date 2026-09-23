# @lokdarpan/money

## 0.1.0

### Minor Changes

- b04aadb: Check import direction instead of describing it (ADR-059).

  `pnpm architecture` walks every tracked file's imports, transitively, against six rules: rendering
  code reaches no database or I/O, sources reach no UI, the domain reaches nothing, client code takes
  only `format*` from `@lokdarpan/money`, the map takes no ingestion types, and label placement reads
  no figures. It runs as CI gate G2.

  `@lokdarpan/money` adds `formatAmount` and `formatAmountSpoken`, which take the server's decimal
  string. `Figure`, `MoneyTrail` and `PublishedFacts` use them instead of holding a `Money` they could
  do arithmetic with.
