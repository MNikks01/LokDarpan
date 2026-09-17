# ADR-054 · Collected, current and complete are three questions

**Status:** Accepted · **Date:** 2026-09-17 · **Implements** the first half of phase 4 of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md) · **Builds on** [`048-a-count-is-not-a-claim-about-the-world.md`](./048-a-count-is-not-a-claim-about-the-world.md)

## Context

The ledger already records what is known about data before any figure is shown, in three separate
vocabularies:

- **Tender collection** (`tender.repository.ts`): `not_collected`, `collected`, `stale`, `failing`.
- **Geography coverage** (`geography_coverage`): `complete`, `partial`, `not_collected`, with a
  note required for `partial`.
- **Ingestion runs**: `running`, `succeeded`, `failed`, `skipped`.

Each explorer panel turned its own vocabulary into sentences in its own way, and a new source
would have added another. The vocabularies also fold independent facts into one value. A state's
tenders can be stale and incomplete at once, and a single status forces a choice between two true
statements.

God's Eye View's transit proxy keeps the underlying facts apart (when the data was produced, when
the operator last answered, whether a snapshot is partial) and was the prompt for this change.

## Decision

**One model, `DataState`, in `packages/domain/src/data-state.ts`, answering three questions
separately:**

- **Is it collected?** `collected`, `not_collected` or `unknown`.
- **Is it current?** `fresh`, `stale`, `failing` or `unknown`.
- **Is it whole?** `complete`, `partial` or `unknown`.

Each state also carries the last successful load, the last attempt, the start of collection, the
note explaining `partial`, and the source ids it describes.

**One headline, derived by one precedence rule** (`displayStateOf`): a failed request, then not
collected, then unknown, then failing, then stale, then partial, then current or held.

- A failed request comes first because it says nothing about the data.
- **`current` and `held` are different claims.** `current` needs a schedule that recently
  succeeded. Boundaries have no schedule, so they are `held`, never `current`.

**One rule for counts** (`mayShowCounts`): a count may appear only for data that is collected.

**Absent on purpose: "not published".** Saying a government did not publish something needs
evidence that its listing was read and the item was absent, and nothing records that yet.

**Mappers from the existing records:** `tenderCollectionState` and `levelCoverageState`. Tender
completeness is `unknown`, not `complete`, because nothing checks that every advertised tender was
captured.

## Consequences

`/api/v1/tenders/overview` returns `collectionState` beside `collection`, and each entry in
`/api/v1/geo/units/:id/children`'s `coverage` carries a `state`. The old fields stay for one
release.

**No reader-facing text changes in this step.** Moving the panels onto the model changes wording on
the tender, boundary and records panels. That wording is proposed separately and changes only once
it has been reviewed.
