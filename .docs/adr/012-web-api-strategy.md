# ADR-012 — Web API strategy: REST, server-side; GraphQL reconsidered and declined

**Status:** Accepted · 2026-08-24 · Revisits `adr/004` for the web client

## Context

`adr/004` rejected GraphQL for the mobile client on two grounds: HTTP caching keyed to `datasetVersion` was load-bearing for the offline strategy, and a GraphQL client cost bundle size that a 3.5 MB budget could not spare.

`.docs/decisions/web-first-pivot.md` explicitly reopened the question, because **neither argument obviously survives the move to web**: a server-rendered client has no bundle constraint on its data layer, and no offline requirement. `.docs/11-api/api-documentation.md` and `.docs/02-architecture/tech-stack.md` already specify a GraphQL endpoint for hierarchical drill-downs, so adopting it would use something that already exists.

This was a genuine reopening, not a formality.

## Decision

**REST, called server-side from React Server Components. The web client does not consume `/graphql`.**

## Why REST still wins — on different grounds than for mobile

The mobile arguments largely dissolve. Three new ones replace them:

1. **ISR caching is keyed on the request, and the request should be cacheable.** The entire cost model (`.docs/02-architecture/web-architecture.md`) depends on rendering once per `datasetVersion` and serving from CDN. REST GETs with `ETag: "v{datasetVersion}"` compose naturally with that. GraphQL over POST does not, and working around it (persisted queries, GET-with-query-params) reconstructs REST's properties with extra machinery.

2. **RSC already solves the over-fetching problem GraphQL exists to solve.** GraphQL's core value is letting a client request exactly the fields it needs, to avoid shipping unused data over a slow link. With Server Components, the fetch happens _on the server_, next to the API, and unused fields never cross a network the user is paying for. The problem GraphQL solves has been moved rather than left unsolved.

3. **Version coherence.** A GraphQL query resolving fields across services can return figures computed against different `datasetVersion`s. On this product that is not a caching bug — it is a **traceability defect** (`.docs/17-legal/legal-ethical-rules.md`), because two figures on one page would carry different provenance vintages. REST endpoints that each return an explicit `datasetVersion` make the mismatch detectable; the client can then refuse to render a page whose sections disagree.

The bundle-size argument is genuinely gone. The caching and coherence arguments got _stronger_, not weaker.

## Alternatives considered

**GraphQL via `/graphql` (as `.docs/11-api/api-documentation.md` specifies).** Rejected for the three reasons above. Its hierarchical drill-down advantage (unit → children → assets → finance in one round trip) is real, but a server-side REST call from an RSC costs a few milliseconds on a datacentre network — the round-trip cost GraphQL optimises away is not being paid by the user.

**tRPC.** Rejected: it assumes the client and server are one TypeScript codebase. The API is a **public product** (`.docs/01-product/prd.md` names programmatic access for civic-tech and researchers) and must be language-agnostic and documented via OpenAPI. tRPC would make the public API a second-class citizen.

**Composite/BFF endpoints as the primary interface.** Deferred rather than rejected. `.docs/decisions/web-first-pivot.md` downgraded the BFF from P0 to P2. Parallel server-side REST calls are sufficient for launch; composites remain attractive **specifically for `datasetVersion` coherence** — one payload guarantees one version — and should be revisited if version-mismatch handling proves fiddly in practice.

## GraphQL is not withdrawn from the platform

`.docs/11-api/api-documentation.md`'s GraphQL endpoint may still serve **third-party API consumers**, where exploratory hierarchical querying is exactly its strength and researchers are its natural audience (`.docs/01-product/prd.md`). This ADR scopes only what `apps/web` consumes.

## Consequences

- One data-access model shared with the deferred mobile client, so `packages/api-contract` serves both.
- Edge caching works, which is the cost argument that makes national scale affordable.
- Every page must assert that its sections share one `datasetVersion` and degrade honestly when they do not — a rendering rule, and a test.
- The public REST API stays the first-class integration surface, documented via OpenAPI.
