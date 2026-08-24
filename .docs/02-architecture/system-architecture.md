# 02 — System Architecture

## Guiding principles

1. **Provenance first.** Every stored figure keeps a pointer to its source document, extraction method, and confidence. Nothing is displayed that cannot be traced.
2. **Separation of ingestion, analysis, and presentation.** Sources change; the public API should not.
3. **Idempotent, versioned pipelines.** Re-running ingestion never corrupts history; it creates new versions.
4. **Read-optimized public surface.** The public reads from materialized, cached views — never from live scrapers.
5. **Neutral by construction.** The reporting/AI layers can only emit vetted, factual statements (see [11](../09-ai/ai-layer.md), [15](../17-legal/legal-ethical-rules.md)).

## High-level architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          OFFICIAL DATA SOURCES                            │
│  data.gov.in · India Budget · CAG · NDAP · MH Open Data · MH PWD ·        │
│  MH Finance · Mahatenders · ministry portals   (APIs / CSV / XLS / PDF)   │
└───────────────┬───────────────────────────────────────────────────────────┘
                │  (scheduled pulls, never live on request)
        ┌───────▼─────────┐
        │  INGESTION TIER │  connectors · scrapers · PDF/OCR · file drops
        │  (Python)       │  → raw object store (immutable) + BullMQ jobs
        └───────┬─────────┘
        ┌───────▼─────────┐
        │   ETL / NORM    │  parse → validate → normalize → deduplicate
        │  (Python/DuckDB)│  → staging tables → provenance stamping
        └───────┬─────────┘
        ┌───────▼─────────┐
        │  CORE DATASTORE │  PostgreSQL + PostGIS  (canonical ledger)
        └───────┬─────────┘
        ┌───────▼─────────┐        ┌──────────────────┐
        │  ANALYTICS TIER │◄──────►│  ANOMALY ENGINE  │  variance, ratios,
        │  (Python/Pandas │        │  + RISK SCORING  │  z-scores, concentration
        │   /DuckDB)      │        └──────────────────┘
        └───────┬─────────┘
        ┌───────▼─────────┐   materialized views + Redis cache
        │  REPORTING TIER │   (facts & neutral observations only)
        └───────┬─────────┘
        ┌───────▼─────────┐   ┌───────────────┐
        │   API GATEWAY   │◄──│   AI LAYER    │  RAG over ledger; guardrailed
        │ (Node/Express)  │   │ (summaries/QA)│
        └───────┬─────────┘   └───────────────┘
        ┌───────▼─────────┐
        │   FRONTEND      │  Next.js + Mapbox + React Query (public dashboard)
        └─────────────────┘
```

## Service boundaries

| Service                  | Responsibility                                                                       | Stack                                     | Talks to                                 |
| ------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------- |
| **ingestion-workers**    | Pull/scrape/receive raw source artifacts; store immutably; enqueue parse jobs        | Python, Playwright, requests              | Sources, Object store, Queue             |
| **etl-workers**          | Parse (incl. PDF/OCR), validate, normalize, dedupe, load to Postgres with provenance | Python, DuckDB, pandas, Tesseract/Camelot | Object store, Postgres, Queue            |
| **analytics-service**    | Compute variance, ratios, cost/km, comparisons, inflation adjustment                 | Python, pandas, DuckDB                    | Postgres (read), writes analytics tables |
| **anomaly-risk-service** | Flag inconsistencies, compute 0–100 risk scores                                      | Python                                    | Postgres                                 |
| **api-gateway**          | Public REST API; auth; rate limiting; caching; serves only vetted views              | Node.js, Express, TypeScript              | Postgres (read), Redis, AI layer         |
| **ai-service**           | RAG summaries & Q&A under guardrails                                                 | Python/Node, LLM                          | Postgres (read), Vector index            |
| **web-frontend**         | Public dashboards                                                                    | Next.js, TypeScript, Tailwind, Mapbox     | api-gateway                              |
| **scheduler**            | Cron for periodic ingestion/recompute                                                | BullMQ repeatable jobs                    | Queue                                    |

Services are independently deployable containers ([12](./tech-stack.md)). The **only** write path to the canonical ledger is via ETL workers; everything downstream is read-only against it.

## Frontend architecture

- **Next.js (App Router) + TypeScript + Tailwind.** Server components for data-heavy pages; ISR (Incremental Static Regeneration) for Overview/Map so the public hits pre-rendered, cached pages.
- **React Query** for client-side fetching, caching, and background refresh of detail views.
- **Mapbox GL** for the district/road/bridge map; PostGIS geometries served as vector tiles or GeoJSON via the API.
- **Design tokens** shared with the design system ([09](../01-product/dashboard-design-legacy.md)).
- **Every figure component** renders a source affordance (link + confidence + "as of" date). This is a UI contract, not optional.

```text
web-frontend/
  app/            # routes: /, /map, /project/[id], /analytics, /audit
  components/     # FigureWithSource, VarianceBadge, ConfidenceChip, MapView
  lib/            # api client (typed), formatters (₹ crore/lakh), hooks
  styles/
```

## Backend architecture (API gateway)

- **Express + TypeScript**, layered: `routes → controllers → services → repositories`.
- **Read-only** against Postgres; no business mutation via public API.
- **Response envelope** always includes `data`, `meta` (pagination), and `provenance`/`confidence` where applicable.
- **Caching:** Redis read-through with tag-based invalidation keyed to dataset version. Cron recompute bumps the version tag.
- **Rate limiting** and **RBAC** per [13](../12-security/security.md).

```text
api-gateway/
  src/
    routes/         revenue.ts projects.ts anomalies.ts districts.ts contractors.ts
    controllers/
    services/       (compose repo + cache)
    repositories/   (parameterized SQL only)
    middleware/     auth, rateLimit, validate, errorHandler, requestLog
    cache/          redis client + key/version helpers
    openapi/        spec.yaml
```

## Data pipeline & ETL pipeline

Full detail in [03 — Data Collection Architecture](../04-data-engineering/data-collection-architecture.md). Summary of stages:

```text
[1 INGEST]  source → raw artifact (immutable, hashed) in object store  → enqueue
[2 PARSE]   artifact → structured rows (API/CSV direct; PDF via Camelot; scans via OCR)
[3 VALIDATE] schema, type, range, checksum, cross-field (e.g. utilized ≤ released ≤ allocated*)
[4 NORMALIZE] units (₹), names (contractor/dept canonicalization), geo (district codes), FY
[5 DEDUPE]  natural keys + fuzzy match; keep versions, mark supersedes
[6 LOAD]    upsert into canonical tables with provenance + confidence + version
[7 DERIVE]  analytics + anomaly + risk recompute → materialized views
[8 PUBLISH] cache warm + version tag bump → API/frontend see new data
```

\* Cross-field checks flag violations as **anomalies**; they never block load and never assert cause.

## Queues, workers, cron jobs

- **BullMQ on Redis.** Queues: `ingest`, `parse`, `validate`, `load`, `analytics`, `notify`.
- **Workers** are horizontally scalable; each queue has its own concurrency and rate limits (polite scraping).
- **Retries:** exponential backoff with jitter; dead-letter queue after N attempts; failures recorded with source + stage for observability.
- **Cron (repeatable jobs):**
  - Source pulls per portal cadence (e.g. nightly / weekly).
  - Nightly full analytics + risk recompute.
  - Weekly full re-validation & link-health check (detect dead source URLs).
  - Daily cache warm for Overview/Map.

## Caching strategy

| Layer            | Mechanism                                       | Invalidation                                 |
| ---------------- | ----------------------------------------------- | -------------------------------------------- |
| CDN / edge       | Next.js ISR + CDN                               | On dataset version bump (webhook revalidate) |
| API responses    | Redis read-through, tagged by `dataset_version` | Version bump after ETL publish               |
| Heavy aggregates | Materialized views in Postgres                  | Refreshed by analytics cron                  |
| Map tiles        | Pre-generated vector tiles / cached GeoJSON     | On geometry change                           |

## Observability & ops

- Structured JSON logs; request tracing across gateway → services.
- Metrics: queue depth, job failure rate, source availability, reconciliation coverage, cache hit rate.
- Alerts on: source fetch failures, OCR-confidence drop, spike in validation failures, stale dataset version.
- All admin/data mutations recorded in an **audit log** ([13](../12-security/security.md)).

## Deployment topology

```text
        Internet
           │
        [ Nginx / Ingress ]  TLS, WAF, rate-limit
           │
   ┌───────┴────────┐
   │  web-frontend  │ (Next.js, N replicas, behind CDN)
   └───────┬────────┘
   ┌───────┴────────┐
   │  api-gateway   │ (Express, N replicas)
   └───┬────────┬───┘
       │        │
  [ Redis ]  [ PostgreSQL + PostGIS ]  (primary + read replicas)
       │
  [ BullMQ workers: ingestion / etl / analytics / anomaly / ai ]  (K8s)
       │
  [ Object store: raw artifacts (immutable, versioned) ]
```

Container orchestration via Kubernetes; see [12 — Tech Stack](./tech-stack.md) and [17 — Folder Structure](./deliverables-and-risk.md).

## Microservices & event-driven design (national scale)

The service boundaries above are deployed as **independent microservices** (`apps/api`, `apps/web`, `apps/admin`; `services/ingestion|analytics|ai|audit|gis`; `workers/*` — see [17](./deliverables-and-risk.md)), each independently deployable and scalable. They coordinate through an **event-driven pipeline** rather than synchronous calls on the write path:

```text
source.fetched → artifact.stored → parse.requested → rows.parsed → rows.validated
   → rows.loaded(v+1) → scope.changed → analytics.recompute → anomaly.recompute
   → risk.recompute → tiles.rebuild → dataset.published(version N) → cache.invalidate
```

- **Event bus:** BullMQ streams/queues on Redis (upgradeable to Kafka/NATS at Phase 6+ volumes) carry domain events; each service subscribes to the events it cares about. This decouples ingestion cadence from analysis and serving.
- **Idempotent consumers:** every event carries an artifact hash / natural key so re-delivery is safe (at-least-once semantics).
- **Scope-scoped recompute:** `scope.changed` events name the affected `admin_unit`/`scheme`/FY so analytics recomputes only what changed, not the nation — essential at national scale.
- **Choreography, not orchestration, on the write path;** the public read path stays synchronous and cache-served. A saga/outbox pattern guarantees the `dataset.published` version bump only fires after all downstream recompute for that scope succeeds, so users never see a half-updated dataset.
- **Backpressure & isolation:** per-source circuit breakers and per-queue concurrency limits keep one failing portal (of thousands, by Phase 8) from stalling the pipeline.

This is the same architecture at every phase; only the number of services replicas, partitions, and the event-bus backend scale up ([14](../15-scalability/scalability-plan.md)).
