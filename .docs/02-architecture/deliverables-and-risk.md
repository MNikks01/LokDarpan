# 17 — Deliverables, Folder Structure, Risk Analysis & Legal Notes

## Deliverables checklist

| Deliverable | Where |
|---|---|
| PRD | [01](../01-product/prd.md) |
| System Design Document | [02](./system-architecture.md) |
| Data Collection Architecture | [03](../04-data-engineering/data-collection-architecture.md) |
| Database Design + ER diagrams | [04](../05-data-model/database-design.md) |
| Data Models (TypeScript) | [05](../05-data-model/data-models.md) |
| Analytics Specification | [06](../07-analytics/analytics-engine.md) |
| Risk Scoring Specification | [07](../08-risk/risk-scoring-engine.md) |
| Road Intelligence Specification | [08](../03-domain/road-infrastructure-intelligence.md) |
| Dashboard Design | [09](../01-product/dashboard-design-legacy.md) |
| API Documentation | [10](../11-api/api-documentation.md) |
| AI Layer Specification | [11](../09-ai/ai-layer.md) |
| Tech Stack | [12](./tech-stack.md) |
| Security Design | [13](../12-security/security.md) |
| Scalability Plan | [14](../15-scalability/scalability-plan.md) |
| Legal & Ethical Rules | [15](../17-legal/legal-ethical-rules.md) |
| Development Roadmap | [16](../01-product/roadmap-platform.md) |
| Infrastructure Diagrams | [02](./system-architecture.md) (topology) + this doc |
| Folder Structure · Risk Analysis · Legal Notes | this doc |

## Repository / folder structure

> **Amended 2026-08-24 (web-first).** `apps/web/` (the Next.js public dashboard) is **retained** and is
> the first product to ship; `apps/mobile/` (React Native / Expo) is added after web launch. `packages/ui/`
> keeps its original purpose as shared React components. Three packages are added — `api-contract`,
> `neutrality`, and `money` — so the two clients cannot drift. Layout in
> [`.docs/02-architecture/web-architecture.md`](./web-architecture.md) §Repository placement; the deferred
> mobile layout is in [`.docs/02-architecture/repository-structure.md`](./repository-structure.md).

Monorepo (pnpm + uv/poetry). Declarative source connectors so contributors can add sources without touching core. National-scale layout (`apps` / `services` / `packages` / `workers` / `infrastructure`):

```text
bharat-platform/
├── apps/
│   ├── web/                 # Next.js public dashboard (national→village drill-down, maps)
│   ├── admin/               # internal console (quarantine, entity review, reports) — SSO+MFA
│   └── api/                 # Node/Express REST + GraphQL gateway (read-only)
├── services/
│   ├── ingestion/           # connectors, scrapers, PDF/OCR (doc 03)
│   ├── analytics/           # variance, comparisons, cost-per-unit (doc 06, 08)
│   ├── ai/                  # RAG + guardrails (doc 11)
│   ├── audit/               # anomaly detection + risk scoring (doc 07)
│   └── gis/                 # tile builder, spatial jobs (doc 20)
├── packages/
│   ├── database/            # migrations, schema, seed (hierarchy, LGD codes) (doc 04, 19)
│   ├── ui/                  # shared React components (FigureWithSource, maps, badges)
│   ├── shared/              # TS types (doc 05), money/₹ formatting, config, constants
│   └── sdk/                 # typed API/GraphQL client for external consumers
├── workers/
│   ├── crawler/             # scheduled source fetch (polite, per-source limits)
│   ├── ocr/                 # OCR + extraction workers
│   ├── parser/              # PDF/CSV/XLS parsers
│   └── anomaly/             # anomaly/risk recompute workers
├── sources/                 # DECLARATIVE source registry (YAML) — Central/State/Local (doc 18)
├── config/                  # road-model, risk-weights, thresholds (per-domain, versioned)
├── infrastructure/
│   ├── docker/              # Dockerfiles per service
│   ├── kubernetes/          # manifests / Helm charts
│   ├── terraform/           # cloud infra
│   └── observability/       # prometheus, grafana, otel
├── db/{migrations,seeds}/
├── tests/{unit,integration,e2e,guardrails}/
└── .github/workflows/       # CI: tests, SAST, secret scan, guardrail eval, build, deploy
```

<details><summary>Phase-1 (LokDarpan) service-oriented layout — earlier reference</summary>

Monorepo (pnpm + uv/poetry). Declarative source connectors so contributors can add sources without touching core.

```text
lokdarpan/
├── README.md
├── docs/                          # this documentation suite (00–17)
├── infra/
│   ├── docker/                    # Dockerfiles per service
│   ├── k8s/                       # manifests / Helm charts
│   │   ├── api-gateway/
│   │   ├── web/
│   │   ├── workers/
│   │   ├── postgres/  redis/  object-store/
│   │   └── ingress-nginx/
│   ├── terraform/                 # cloud infra (optional)
│   └── observability/             # prometheus, grafana, otel configs
├── packages/                      # shared JS/TS
│   ├── types/                     # TypeScript models (doc 05) — shared FE/BE
│   ├── money/                     # ₹ formatting (crore/lakh), NUMERIC helpers
│   └── config/                    # shared config, env schema
├── services/
│   ├── api-gateway/               # Node + Express + TS (doc 02, 10)
│   │   └── src/{routes,controllers,services,repositories,middleware,cache,openapi}
│   ├── web/                       # Next.js dashboard (doc 09)
│   │   └── app/{,,map,project/[id],analytics,audit}  components/  lib/
│   ├── ingestion/                 # Python: connectors, scrapers, PDF/OCR (doc 03)
│   │   ├── connectors/            # one module per source type (api/csv/xls/pdf/scrape)
│   │   ├── extract/               # camelot, pdfplumber, tesseract wrappers
│   │   └── pipeline/              # fetch → parse → validate → normalize → dedupe → load
│   ├── etl/                       # Python: normalization, entity canonicalization, versioning
│   ├── analytics/                 # Python + pandas + DuckDB (doc 06, 08)
│   │   ├── variance.py  cost_per_km.py  comparison.py  inflation.py  concentration.py
│   ├── anomaly-risk/              # Python: anomaly detection + risk scoring (doc 07)
│   └── ai/                        # RAG + guardrails (doc 11)
│       ├── retriever/  context/  guardrails/  eval/  prompts/
├── sources/                       # DECLARATIVE source registry (YAML), version-controlled
│   ├── mh_pwd_works.yaml
│   ├── mh_budget_allocation.yaml
│   ├── mahatenders.yaml
│   └── ...                        # one file per official source
├── db/
│   ├── migrations/                # SQL migrations (doc 04)
│   └── seeds/                     # fiscal years, districts+geometry, lookups
├── config/
│   ├── road-model.yaml            # doc 08 coefficients (sourced, versioned)
│   ├── risk-weights.yaml          # doc 07 weights/caps
│   └── thresholds.yaml            # anomaly thresholds per category
├── scripts/                       # ops/backfill/one-off tooling
├── tests/
│   ├── unit/  integration/  e2e/
│   └── guardrails/                # neutrality lint + AI red-team/golden-set (doc 11, 15)
└── .github/workflows/             # CI: tests, SAST, secret scan, guardrail eval, build, deploy
```

</details>

## Infrastructure diagram (deployment)

```text
                       ┌────────────┐
                       │    CDN     │  (public pages, cached by dataset_version)
                       └─────┬──────┘
                             │
                    ┌────────▼─────────┐
                    │  Nginx / Ingress │  TLS · WAF · rate-limit · security headers
                    └───┬──────────┬───┘
             ┌──────────▼───┐  ┌───▼────────────┐
             │   web (N)    │  │ api-gateway (N)│  read-only DB user
             │  Next.js     │  │  Express/TS    │
             └──────────────┘  └───┬────────┬───┘
                                    │        │
                              ┌─────▼──┐  ┌──▼──────────────────────┐
                              │ Redis  │  │ PostgreSQL + PostGIS      │
                              │ cache/ │  │ primary ──► read replicas │
                              │ queue  │  └──────────▲────────────────┘
                              └───▲────┘             │ (writes ONLY via ETL)
                                  │                   │
        ┌─────────────────────────┴───────────────────┴───────────────┐
        │  BullMQ worker pools (K8s, autoscaled):                       │
        │  ingestion · etl · analytics · anomaly-risk · ai             │
        └───────────────┬──────────────────────────────────────────────┘
                        │
                 ┌──────▼───────┐        ┌───────────────┐
                 │ Object store │        │ Vector index  │  (AI retrieval)
                 │ raw artifacts│        │ pgvector/Qdrant│
                 │ (immutable)  │        └───────────────┘
                 └──────────────┘
       Sources (APIs/CSV/XLS/PDF) ──► ingestion (scheduled, never on public request)
```

## Risk analysis

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Source data unavailable / behind no-API PDFs** | High | High | PDF/OCR pipeline; polite scraping fallback; confidence scoring; missing-data warnings instead of gaps |
| R2 | **OCR / extraction errors produce wrong figures** | Medium | High | Confidence scores, sanity checks, quarantine, human review of low-confidence, never present uncertain as certain |
| R3 | **Reconciliation fails (inconsistent identifiers across sources)** | High | Medium | Deterministic + fuzzy entity matching, review queue, confidence-tagged links, report the gap itself |
| R4 | **Source schema/URL drift breaks connectors** | High | Medium | Declarative connectors, link-health cron, circuit breakers, alerts, versioned registry |
| R5 | **Misinterpretation → the platform is read as accusing someone** | Medium | **Critical** | Binding neutrality rules ([15](../17-legal/legal-ethical-rules.md)), templated/guardrailed language, disclaimers, "Verification Priority" not "corruption," legal review |
| R6 | **AI generates an accusatory/hallucinated claim** | Medium | **Critical** | RAG grounding, numeric fidelity + neutrality classifier + citation enforcement, templated fallback, CI red-team gate |
| R7 | **Data tampering / integrity attack** | Low | Critical | Read-only values, append-only hash-chained audit logs, immutable artifacts, RBAC, backups |
| R8 | **Defamation / legal exposure** | Low–Med | High | No allegations by design; facts + sources only; right-of-reply/correction flow; counsel review per phase |
| R9 | **Scaling cost/complexity as domains grow** | Medium | Medium | Source-driven architecture, partitioning, contributor connector model, phased plan ([14](../15-scalability/scalability-plan.md)) |
| R10 | **Availability under traffic spikes (viral story)** | Medium | Medium | CDN + cache + read replicas + rate limits + autoscaling |
| R11 | **Reputational: a data error is read as bias** | Medium | High | Full traceability, confidence display, visible corrections, open methodology |

## Legal notes

- **Nature of the platform:** LokDarpan republishes and cross-checks **official government data** and presents arithmetic over it. It makes **no allegations** about any person or entity. This is the primary legal safeguard.
- **Defamation posture (India):** truth/fact, public interest, and the absence of imputation of wrongdoing are central. The platform states facts with sources and explicitly disclaims any inference of misconduct; risk scores and anomalies are framed as data-consistency/verification signals. Copy is reviewed against Indian defamation norms per [15](../17-legal/legal-ethical-rules.md).
- **Data licensing/terms:** each source's open-data license and usage terms are honored and displayed; `robots.txt` and rate limits respected; only public, non-authenticated data used.
- **IT/scraping norms:** ingestion is polite and scheduled; no circumvention of access controls; no authenticated or restricted data.
- **Privacy:** only public official data; incidental PII minimized/redacted in display; no re-identification.
- **Right of reply & corrections:** a visible channel to report data issues; corrections via re-ingestion, versioned and logged — because the platform asserts no wrongdoing, corrections concern *data*, not retractions about people.
- **Disclaimers:** persistent, in-context disclaimers on anomaly/audit/estimate surfaces (text in [15](../17-legal/legal-ethical-rules.md)).
- **Not legal/financial advice or adjudication:** the platform informs; it does not investigate, accuse, or determine liability.

> These notes are an engineering-facing summary, **not legal advice**. Qualified counsel must review product copy, disclaimers, data-source terms, and methodology before public launch and before each expansion phase.

## Open items to confirm at implementation

- Exact portal URLs, dataset IDs, API keys, and licenses for each approved source (fill the `sources/` registry).
- The official inflation/construction-cost index to use ([06 §6](../07-analytics/analytics-engine.md)).
- Applicable IRC/SoR specifications and current unit rates for the road model ([08](../03-domain/road-infrastructure-intelligence.md)).
- Final open-source license for the codebase.
- Final product name (working title: **LokDarpan**).
