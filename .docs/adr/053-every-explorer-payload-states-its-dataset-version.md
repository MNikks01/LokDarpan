# ADR-053 · Every explorer payload states its dataset version

**Status:** Accepted · **Date:** 2026-09-17 · **Implements** phase 2 of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md) · **Refines** [`012-web-api-strategy.md`](./012-web-api-strategy.md)

## Context

Every API response carries `meta.datasetVersion` and `meta.asOf`, and every one of the explorer's
routes filled them with things that were not true. The seven route handlers behind the explorer
(geography, children, boundaries, tenders, tender overview, search, documents) returned
`datasetVersion: 0` in eleven places. `respond.ts` set `asOf` to the moment the response was
built. A reader, a cache or a shared link could not tell which state of the ledger a page came from.

The documents imagine one version shared by a whole payload. The ledger does not work that way. A
load opens its own `dataset_version` row: one per OSM district, one per GePNIC portal, one per LGD
run. A district's talukas, a state's tender counts or a search across places are built from many
loads, so no single row describes them. Enforcing "one payload, one version" on those routes
would fail every request.

A second defect was waiting behind the first. The routes ran their reads as separate queries on a
pool, so a load committing between two of them could produce one response describing two states of
the ledger.

## Decision

**A payload's version is the ledger's watermark: the newest `dataset_version` committed in the
snapshot the payload was read from.** It is monotonic, because every load advances it, so it is a
correct cache key. And it answers a question that is true of any payload however many loads it
spans: what had the ledger received when this was read?

**`asOf` is when that version was opened**, never the time of the response. For routes whose version
comes from their rows (`UnitService`'s single-version views), `respond` looks up when that version
was opened.

**All of a handler's reads run in one snapshot.** `readLedger` in `packages/database/src/ledger.ts`
opens `REPEATABLE READ READ ONLY`, reads the watermark first (which fixes the snapshot), then runs
the handler's queries on the same client. `apps/web/src/server/container.ts` exposes it as
`inLedger`. Queries run one at a time on that client, because `pg` 8 deprecates overlapping queries
on one client and `pg` 9 removes them.

**Row-level vintage is a separate concern.** Which load a particular boundary or tender came from
is provenance, and belongs in phase 4's source descriptors. The watermark does not replace it.

## Consequences

Every explorer response now names a real version and its date. Checked against a running server:
all seven routes reported the newest version and its creation time, and a missing unit still
returned a clean 404 from inside the snapshot.

The integration test found a bug before it shipped: ordering by an alias `id::text AS id` sorts as
text, so version 84 ranked above 106. The alias is named `version` for that reason.

An empty ledger reports version `0` with `asOf: null`, and `EnvelopeMetaSchema` now allows `null`
for that case only.

Any load invalidates every cached response, including ones it did not touch. With loads at most
daily, that is cheaper than working out which responses each load affects.

**Unresolved: `UnitService`'s strict single-version rule.** `/api/v1/units?level=state` failed
with "could not be assembled from a single dataset version" against a database holding states from
more than one load. Production geography is loaded per district, so the same rule will fail there
as soon as units come from more than one load. This change does not alter that rule. Whether unit
views keep strict row versions or move to the watermark is an open decision in the adoption plan.

**Not in this change:** `ETag` and `If-None-Match` handling, cache-tag ISR, and pinning a version
from a shared link (phase 7).

## Addendum · 2026-09-23 — unit views follow the watermark

The open question above is decided: **unit views report the watermark, and each unit keeps its own
version.** The strict rule refused any payload whose units came from more than one load. Geography is
loaded district by district, so Madhya Pradesh's 55 districts span loads, and the rule failed every
real request.

- `/api/v1/units` and `/api/v1/units/:id` now read inside `inLedger`, like the explorer routes.
  `PostgresAdminUnitRepository` accepts a snapshot client for this.
- Each unit's `provenance.datasetVersion` still says which load it came from.
- `singleDatasetVersion` and its "mixed version" contract violation are removed from the domain.
- `services/api`, which has no ledger snapshot, reports `newestDatasetVersion` of the payload: never
  older than anything in it.

Checked live: 36 states listed, and Madhya Pradesh with its 55 districts, each answer carrying the
watermark. Missing ids still return 404 and malformed ids 400.
