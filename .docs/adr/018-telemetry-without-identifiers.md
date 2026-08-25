# ADR-018 — Purpose-built metrics, not OpenTelemetry auto-instrumentation

**Status:** Accepted · 2026-08-25

## Context

[`../01-product/sprint-plan.md`](../01-product/sprint-plan.md) Sprint 1 `OBS` asks for "OpenTelemetry tracing through API → DB; `/metrics` endpoint; log shipping".

[`../13-observability/observability.md`](../13-observability/observability.md) §Explicitly never collected forbids collecting **query text**, **entity names or IDs the user viewed** (only _types_ and _levels_), coordinates, and exact timestamps beyond hour granularity. §The bucketing rule requires every numeric value to be bucketed **at the source**.

These conflict, and the conflict is not superficial:

- `@opentelemetry/instrumentation-pg` records `db.statement` — the SQL — on every span.
- `@opentelemetry/instrumentation-http` records `http.target`/`url.full` — the request path, which for this API contains the entity id (`/api/v1/units/20`).

Adopting the default instrumentation would emit, on every request, the two categories the observability spec most explicitly refuses.

The same document also settles what tracing is _for_ here:

> Every request carries `X-Request-Id` … logged server-side — so a user's report maps to an exact server log line without the app needing to know who the user is. **This is the whole tracing story, and it works precisely _because_ nothing else is identifying.**

## Decision

**Emit the specific series the observability spec asks for, from `packages/observability`. Do not adopt OpenTelemetry auto-instrumentation.**

- Metrics are labelled by **route pattern**, never path: `/api/v1/units/:id`, never `/api/v1/units/20`.
- The pattern list is an **allowlist**. An unrecognised path becomes `other`, so a route added later cannot begin leaking identifiers because nobody remembered this file.
- Latency is recorded as a **bucket** (`<300ms | <1s | <3s | <8s | 8s+`), never a duration.
- Label values are validated against a closed shape. A caller attempting to label a metric with a name, a query or an id **throws** rather than publishing it on a scrape endpoint.
- `X-Request-Id` correlation, already implemented, remains the tracing story.
- `contract_violation{kind}` is an **integrity alarm**, not a usage number.

The exact request duration is still written to the correlated server log. That log line is keyed by request id, which identifies a request and never a person; only the aggregate, exportable series is bucketed.

## Why not OpenTelemetry with attribute filtering

This was the obvious middle path: adopt the SDK, then strip the forbidden attributes with a span processor.

Rejected because **the safe default inverts**. With filtering, every new instrumentation package, every SDK upgrade and every added route emits by default and is redacted only if someone remembered to extend the filter — and the failure is silent, discovered when an id is already on a dashboard. With an allowlist, the failure mode is a metric labelled `other`, which is visible and harmless.

The volume argument also does not hold: after filtering out query text, full paths, ids and precise timings, what remains is roughly the handful of series implemented here — for several hundred kilobytes of dependency and a collector to run.

## Alternatives considered

| Option                                   | Why not                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **OTel auto-instrumentation as shipped** | Emits `db.statement` and full request paths. Directly violates the observability spec.                                           |
| **OTel with a redacting span processor** | Safe default inverts, as above. Silent failure mode.                                                                             |
| **`prom-client`**                        | Reasonable, and would replace ~120 lines. It does not validate label values, which is the property doing the real work here.     |
| **No metrics; rely on logs alone**       | Defensible today, but rate and latency distribution are exactly what a scrape endpoint answers cheaply and log parsing does not. |

## Trade-offs

- **No distributed traces.** With one service and one database, `X-Request-Id` plus a correlated log answers the same questions. Revisit if a second service appears — and revisit this ADR then, rather than adding the SDK quietly.
- **The route allowlist must be maintained.** Deliberate: forgetting it degrades a label to `other` rather than leaking an id.
- **`prom-client`'s histogram quantiles are unavailable.** The spec asks for buckets, not quantiles.

## Consequences

- `packages/observability` owns bucketing, route patterns and the registry; it has no dependencies.
- `/metrics` serves Prometheus text with `cache-control: no-store` — a cached count is a stale count.
- Adding a route means adding a pattern, or its metrics read `other`.
- Log shipping is **not** implemented here and remains open in Sprint 1 `OBS`.
