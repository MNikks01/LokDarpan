# 12 — Tech Stack

Choices favor a boring, well-supported, open-source stack — appropriate for a public-interest project that must be auditable, cheap to run, and easy for contributors to join.

## Frontend

| Tech | Role | Why |
|---|---|---|
| **Next.js (App Router)** | Public dashboard, SSR/ISR | Pre-render + cache public pages; SEO for civic discovery |
| **TypeScript** | Language | Shared types with backend ([05](../05-data-model/data-models.md)); safety |
| **Tailwind CSS** | Styling | Fast, consistent design system; small bundles |
| **Mapbox GL JS** | Maps | Vector tiles, choropleths, road/bridge layers |
| **React Query (TanStack Query)** | Data fetching/cache | Background refresh, caching, request dedup |
| **Recharts / visx** | Charts | Trend/anomaly/distribution charts |

## Backend (API)

| Tech | Role | Why |
|---|---|---|
| **Node.js + Express + TypeScript** | REST API gateway | Simple, ubiquitous, typed end-to-end |
| **GraphQL (Apollo/Yoga)** | Hierarchical read API | One-round-trip drill-downs (unit→children→assets→finance); depth/complexity-limited ([10](../11-api/api-documentation.md)) |
| **Zod** | Request validation / typing | Runtime validation + inferred types |
| **OpenAPI** | REST API contract | Documented, client-generatable |

## Database & storage

| Tech | Role | Why |
|---|---|---|
| **PostgreSQL 16** | Canonical ledger | Correctness, constraints, `NUMERIC` money, mature |
| **PostGIS** | Geospatial | District polygons, road/bridge geometry, spatial queries |
| **Redis** | Cache + queue backend | Read-through cache; BullMQ transport |
| **Object store (S3-compatible / MinIO)** | Immutable raw artifacts | Content-addressed source documents |
| **Vector index (pgvector / Qdrant)** | AI retrieval | RAG over official source-document text |

## Analytics / data engineering

| Tech | Role | Why |
|---|---|---|
| **Python** | ETL, analytics, anomaly, risk | Ecosystem for data + PDF/OCR |
| **pandas** | Transforms | Standard tabular processing |
| **DuckDB** | Fast local/columnar analytics | Query Postgres/Parquet quickly for aggregates |
| **pdfplumber / Camelot / tabula** | PDF table extraction | Budget & demand-for-grants documents |
| **Tesseract (+ Indic packs)** | OCR | Scanned/Marathi documents |
| **Playwright** | Scraping JS portals | Only where no API/file exists; polite, scheduled |

## Queue & jobs

| Tech | Role | Why |
|---|---|---|
| **BullMQ (on Redis)** | Ingestion/ETL/analytics jobs, cron | Retries, backoff, DLQ, repeatable jobs |

## Infrastructure

| Tech | Role | Why |
|---|---|---|
| **Docker** | Containerization | Reproducible services |
| **Kubernetes** | Orchestration | Scale workers/API independently; rolling deploys |
| **Nginx / Ingress** | Reverse proxy, TLS, WAF, rate-limit | Edge security |
| **CDN** | Edge caching of public pages | Cheap, fast public reads |
| **GitHub Actions** | CI/CD | Tests, guardrail evals, image build, deploy |
| **OpenTelemetry + Prometheus + Grafana** | Observability | Metrics/traces/alerts |
| **Sentry** | Error tracking | Frontend + backend errors |

## AI

| Tech | Role | Why |
|---|---|---|
| **Pluggable LLM** | Summaries & Q&A | Vendor-independent behind the guardrail stack ([11](../09-ai/ai-layer.md)) |
| **RAG (pgvector/Qdrant)** | Grounding | Answers restricted to ingested official data |
| **Guardrail validators** | Neutrality/citation/numeric checks | Enforce [15](../17-legal/legal-ethical-rules.md) |

## Cross-cutting

- **pnpm** workspaces (JS/TS monorepo) + **uv/poetry** for Python services.
- **Prisma or Kysely** optional typed query layer for the API (raw parameterized SQL acceptable; no ORM in analytics).
- **Secrets** via a vault/manager; never in code.
- **License:** open-source (e.g. AGPL/MIT to be decided) so the methodology itself is auditable — important for public trust.

## Why not X (brief)

- **No NoSQL primary store:** financial data is relational and constraint-heavy; Postgres is the right home.
- **No heavyweight ORM in analytics:** columnar/DuckDB + SQL is faster and clearer for aggregates.
- **No serverless-only:** long-running scraping/OCR jobs suit worker containers better than function timeouts.
