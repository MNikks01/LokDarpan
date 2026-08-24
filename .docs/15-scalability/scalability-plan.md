# 14 — Scalability Plan

Scaling has two axes: **breadth** (more domains, more levels of the hierarchy, more states) and **throughput** (more data, more users). The architecture ([02](../02-architecture/system-architecture.md)) is source-driven, hierarchy-generic ([19](../03-domain/administrative-hierarchy.md)), and horizontally scalable, so breadth expansion is mostly _configuration + connectors + domain modules_, not rewrites.

## Eight-phase expansion (village → nation)

| Phase | Scope                                                           | Primary work                                                                                          | Key risks                             |
| ----- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **1** | **Maharashtra — Roads**                                         | Core ledger, MH road connectors, variance/anomaly/risk, dashboard, REST+GraphQL, AI                   | Source access, PDF/OCR quality        |
| **2** | **Maharashtra — Ministries** (all state departments)            | Generalize domain taxonomy; per-domain intelligence modules (health, education, water…); scheme model | Domain-specific metrics; volume       |
| **3** | **Maharashtra — Districts** (division/district/taluka/block)    | Full intra-state hierarchy + roll-up consistency; district/taluka dashboards & maps                   | Intra-state identifier reconciliation |
| **4** | **Maharashtra — Villages / Local bodies** (ULB + PRI, GP, ward) | Local-body connectors; scheme-grant tracking; village dashboards; heavy missing-data handling         | Sparse/uneven local publication       |
| **5** | **India — Roads** (all states + NH/NHAI)                        | Multi-state partitioning; per-state source registries; central road sources                           | State heterogeneity                   |
| **6** | **India — Ministries**                                          | All central + state departments/schemes; federated ingestion                                          | Governance, data volume               |
| **7** | **India — Districts**                                           | Full district hierarchy nationwide; national choropleths                                              | Scale of reconciliation               |
| **8** | **India — Villages**                                            | ~2.6 lakh GPs, ULBs, wards nationwide; national local-finance intelligence                            | Extreme volume; coverage gaps         |

Each phase reuses the same pipeline; what changes is the **source registry** ([18](../06-government-sources/legacy-source-directory.md)), the **domain taxonomy**, per-domain **intelligence modules** (roads = [08](../03-domain/road-infrastructure-intelligence.md) is the template), and the **hierarchy depth** switched on.

## What generalizes vs what's added per phase

**Generalizes (build once):** provenance & versioning, ingestion/ETL, validation, entity canonicalization, generic `admin_unit` hierarchy + closure, variance/consistency & roll-up engine, risk-score skeleton, REST/GraphQL envelope, dashboard shells + drill-down, GIS serving, AI guardrails.

**Added per phase:** source connectors, domain taxonomy + unit-cost/quantity models, domain peer sets & thresholds, boundary/geometry data for newly covered levels, local-body scheme mappings.

## Technical scaling levers

### Data volume

- **Partitioning:** fact tables range-partitioned by `fiscal_year_id`, list-sub-partitioned by `state_code` at national scale; asset tables partitioned by `state_code` ([04](../05-data-model/database-design.md)). Keeps per-state working sets small.
- **Columnar analytics:** DuckDB/Parquet for heavy aggregation; Postgres for canonical + transactional reads.
- **Materialized views per scope**, refreshed incrementally by the level/scope that changed, not globally.
- **Closure table** for O(1) subtree rollups instead of recursive queries at request time.
- **Archival:** cold storage for old raw artifacts (kept immutable for traceability).

### Ingestion throughput

- Workers scale horizontally per queue; per-source concurrency & politeness limits.
- **Federated ingestion:** state-scoped worker pools; per-source circuit breakers isolate a failing portal (critical when covering thousands of local-body portals in Phase 8).
- Backfills as bounded batch jobs, separate from incremental cron.

### Read/serve throughput

- Public reads from CDN + Redis + read replicas; near-zero live computation.
- **Vector tiles** pre-generated per zoom/version for national maps ([20](../03-domain/gis-intelligence.md)).
- GraphQL depth/complexity limits + persisted queries protect the hierarchical API.
- Vector index sharded by scope for AI retrieval.

### Organizational scaling

- **Declarative connectors** (YAML + small parser) let civic-tech contributors add sources via PR with tests, without touching core — essential for covering local bodies at national scale.
- **Data governance board** as scope widens: source vetting, methodology review, correction process.
- Per-state / per-domain maintainers by Phases 6–8.

## Capacity milestones (illustrative planning targets)

| Phase |          Admin units in scope | Fact rows | Concurrent users |  Sources |
| ----- | ----------------------------: | --------: | ---------------: | -------: |
| 1     |          ~10³ (MH road units) |      ~10⁶ |             ~10³ |      ~10 |
| 4     |       ~10⁵ (MH villages/ULBs) |      ~10⁸ |             ~10⁴ |     ~10² |
| 6     | ~10⁴ (India ministries/depts) |      ~10⁹ |             ~10⁵ |     ~10² |
| 8     | ~10⁶ (all India local bodies) |     ~10¹⁰ |             ~10⁶ | ~10³–10⁴ |

Numbers size partitioning, replicas, and worker pools — not commitments.

## Guardrails must scale with reach

As breadth grows, the **neutrality and traceability guarantees must not weaken**. Every new domain module and every new level ships with its own neutral-language review, source-linked provenance, versioned thresholds, and anomaly definitions vetted against [15](../17-legal/legal-ethical-rules.md). Scaling reach without scaling this discipline would be a failure, not a success — a national platform that oversteps into accusation is worse than no platform at all.
