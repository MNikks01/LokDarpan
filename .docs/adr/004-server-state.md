# ADR-004 — Server state: TanStack Query v5, REST only, no GraphQL

**Status:** Accepted · 2026-08-21 · **Deferred 2026-08-24** — mobile delivery postponed until after web launch (see [`.docs/decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)). This decision stands for when the mobile client is built; revalidate the toolchain at that point.

## Context

`.docs/11-api/api-documentation.md` and `.docs/02-architecture/tech-stack.md` specify **both** a REST API and a GraphQL endpoint, the latter added for hierarchical drill-downs (unit → children → assets → finance in one round trip). The brief instructs: REST for normal access; GraphQL only where it gives a clear mobile-specific advantage; do not adopt it merely because the docs mention it.

Mobile constraints: intermittent, metered, high-latency networks; offline reads must work; every screen must display one `datasetVersion` (`.docs/02-architecture/data-flow.md`).

## Decision

**TanStack Query v5 over REST only.** Composite, screen-shaped endpoints (`/mobile/v1/*`, `.docs/11-api/client-api-contract.md` §2) solve the round-trip problem that GraphQL was introduced to solve. **The mobile client does not consume `/graphql`.**

## Why not GraphQL

1. **HTTP caching is load-bearing here.** The entire freshness and offline strategy rests on `ETag = datasetVersion` + `If-None-Match` → `304`, served from a CDN edge (`.docs/02-architecture/system-architecture.md`, `.docs/10-mobile/offline-strategy.md`). GraphQL over POST defeats edge caching and conditional requests. We would have to rebuild, in the client, a cache-coherence mechanism the HTTP stack already gives us — and rebuild it in the one place where getting it wrong means showing a stale government figure without saying so.
2. **The problem it solves is already solved better.** GraphQL's advantage is client-shaped queries. But a _screen-shaped REST endpoint_ delivers the same payload with one ETag, one `datasetVersion`, one failure mode, one cache entry — and it is cacheable at the edge. For a client with exactly the ~10 screen shapes in `.docs/11-api/screen-api-matrix.md`, server-defined shapes are strictly better than client-defined ones.
3. **Version coherence.** A GraphQL query resolving fields across services can, without care, return figures computed against different dataset versions. On this product that is not a bug class we want to manage in the client — it is a traceability defect (`.docs/17-legal/legal-ethical-rules.md`).
4. **Cost.** A client, a cache normalizer, and generated types add ~40–80 KB to a bundle budgeted at 3.5 MB, plus a second mental model, for capability we do not use.
5. **Attack surface.** `.docs/11-api/api-documentation.md` already notes GraphQL needs depth and complexity limits. An anonymous public mobile client is the worst possible caller to expose an arbitrary query language to.

**GraphQL may still be right for third-party API consumers** — researchers doing exploratory queries, which is exactly its strength (`.docs/01-product/prd.md`). This ADR scopes only the mobile client.

## Alternatives considered

**Apollo Client / urql over the existing `/graphql`.** Rejected for the five reasons above.

**RTK Query.** Rejected: pulls in Redux (`adr/003`), and its caching model is weaker than TanStack Query's for stale-while-revalidate, offline persistence, and infinite queries — the three things this app needs most.

**SWR.** Good, lighter. Rejected: weaker infinite-query support (every feed here is cursor-paged), weaker persistence and offline story, smaller mutation/cancellation surface.

**Hand-rolled fetch + Zustand.** Rejected. We would reimplement caching, dedup, retry, background refresh, stale-while-revalidate, and persistence — badly, and in the layer where a mistake means displaying a stale financial figure as current.

## Why TanStack Query specifically

Stale-while-revalidate as a first-class model (paint cache, refresh behind — the basis of the 150 ms cached-screen budget) · request dedup and cancellation · `useInfiniteQuery` for cursor pagination · a persistence plugin that gives offline reads almost for free · granular invalidation for `datasetVersion` bumps _without eviction_ (`.docs/02-architecture/data-flow.md` §4) · already used on the platform's web side (`.docs/02-architecture/tech-stack.md`), so the concepts are familiar.

## Configuration

Defaults: `staleTime` 15 min (entity), `gcTime` 14 d, `refetchOnWindowFocus: false` (data publishes at most daily; refetching on every focus wastes a metered connection), `retry` 3 with jitter on idempotent GETs only, persister = MMKV with a 24 MB cap. Per-class overrides in `.docs/02-architecture/data-flow.md` §4.

## Consequences

- One data-fetching model, one cache, one mental model.
- Edge caching works, which is what makes the app cheap to run at national scale (`.docs/15-scalability/scalability-plan.md`).
- **The BFF becomes a hard requirement** (`.docs/11-api/client-api-contract.md` §2). Without it, REST means 7 round trips per project screen. This ADR and that requirement stand or fall together.
- Query keys are typed and centralised so a `datasetVersion` bump can invalidate precisely.
