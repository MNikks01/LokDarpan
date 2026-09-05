# ADR-050 · A timestamp that lost precision in transit has not changed

**Status:** Accepted · **Date:** 2026-09-05 · **Amends** [`049-a-tender-that-changed-can-say-what-it-said-before.md`](./049-a-tender-that-changed-can-say-what-it-said-before.md)

## Context

[ADR-049](./049-a-tender-that-changed-can-say-what-it-said-before.md) recorded a
known limitation of the versioning trigger and shipped with it:

> A caller that round-trips a timestamp through a JavaScript `Date` will create
> spurious versions, because that truncates microseconds and the trigger compares
> exact values.

PostgreSQL stores `timestamptz` to the microsecond. A JavaScript `Date` carries
milliseconds. So a caller reading `12:00:00.123789` back and writing it again
unchanged hands over `12:00:00.123`, the trigger sees a different value, and the
ledger records that a government office moved a deadline it never touched — a
fabricated change, in the one table built to make real changes traceable.

The loaders re-parse the same source text on every run and so are unaffected.
Any correction tool, backfill or admin edit would be.

## Decision

**Where two readings agree to the millisecond, the stored value is restored
before any comparison.** The `BEFORE UPDATE` trigger assigns `OLD.closing_at`
into `NEW.closing_at` — and likewise `bid_opening_at` — when
`date_trunc('milliseconds', …)` makes them equal and both are present.

Three properties follow, and the third is why it is done this way rather than by
loosening the comparison:

- **The comparison is untouched.** It still tests exact equality, so every
  non-timestamp field behaves exactly as before and nothing else in ADR-049
  changes.
- **A real change still files a version.** A difference of a whole millisecond or
  more survives truncation. No source in this project publishes a tender deadline
  to finer than a minute.
- **The stored microseconds survive.** A comparison that merely _ignored_ the
  difference would have let a lossy round trip quietly shorten a stored
  timestamp, one write at a time, with no version recording it. Restoring the old
  value keeps the more precise reading the database was actually given.

### Why the column is not `timestamptz(3)`

That was the obvious fix, and it is wrong. **A cast to `timestamptz(3)` rounds;
the driver truncates.** Measured against this database: `.123789` becomes `.124`
under the cast and `.123` through `node-postgres`. Storing a rounded value and
receiving a truncated one leaves the two unequal, so the spurious version
survives the change meant to prevent it — and the fix would have silently
discarded real precision as well.

`date_trunc('milliseconds', …)` truncates, which is exactly what the driver
does, so the two agree by construction rather than by coincidence.

## Consequences

Six regression tests cover it, and they were checked against the pre-fix trigger:
the three asserting that a round trip writes no version **fail** without this
change, and the three asserting that a genuine change still writes one pass both
ways — a guard against a fix that bought quiet by becoming too lenient.

The limitation ADR-049 records is closed. Its text stands as written; ADRs here
append rather than get rewritten.

**This is a comparison rule, not a storage rule.** `first_seen_at` and
`last_seen_at` keep full microsecond precision and are not compared at all, and
no column definition changes.
