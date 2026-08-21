# Bharat Public Governance Intelligence Platform

**A national public-finance, governance, and infrastructure intelligence platform that tracks the flow of public money from the Government of India down to the Gram Panchayat and ward — built entirely on official government records.**

> Working name **LokDarpan** (लोकदर्पण) — "the people's mirror." Phase 1 is Maharashtra roads; the platform is designed to scale to every ministry, every state, every district, and every village in India.

---

## What this is (and is not)

The platform links official records into a single traceable ledger — revenue → budget → ministry → state → district → local body → department → scheme → tender → contractor → release → expenditure → work progress → completion → audit — and runs **mathematical-consistency and variance checks** over them. It surfaces facts, calculations, and neutral anomalies so journalists, researchers, RTI activists, auditors, and citizens can understand and verify public spending at any level of the administrative hierarchy.

**It is:** a transparency and public-understanding tool · a mathematical-consistency checker over official records · an anomaly *highlighter* with full source traceability.

**It is NOT:** an anti-corruption or accusation engine · a legal authority or investigator · a source of allegations about any individual or organization.

Every figure is traceable to an official source. Every anomaly is a neutral, factual observation (e.g. _"this road project costs 40% more than the district average"_) — never an accusation. See [15 — Legal & Ethical Rules](./15-Legal-Ethical-Rules.md), binding on every other document.

---

## Scope — village to nation

**Administrative hierarchy** (full model in [19](./19-Administrative-Hierarchy.md)):

```text
Government of India → Ministry → State → Division → District → Taluka/Tehsil → Block
   → Municipal Corporation / Municipality / Nagar Parishad  (urban)
   → Zilla Parishad / Panchayat Samiti / Gram Panchayat / Village / Ward  (rural)
   → Scheme → Project
```

**Domain coverage** (phased): all central ministries and autonomous bodies; all states & UTs; urban and rural local bodies; transportation, utilities, and social infrastructure. Phased build in [14 — Scalability Plan](./14-Scalability-Plan.md) (8 phases: MH roads → MH ministries → MH districts → MH villages → India roads → India ministries → India districts → India villages).

**Phase 1 (live target):** Maharashtra — Roads & Transportation (PWD, highways, bridges, rural/urban roads). The Maharashtra-roads specifics throughout these docs are the concrete first instance of the general national design.

---

## The national financial flow

```text
Government Revenue → Union Budget → Ministry Allocation → State Allocation
   → District Allocation → Local-Body Allocation → Department Allocation → Scheme Allocation
   → Tender → Contractor → Fund Release → Expenditure → Work Progress → Project Completion
   → Audit → Variance Detection → Public Dashboard
```

Worked example (project level):

```text
Allocated:  ₹10 crore
Released:   ₹9 crore
Utilized:   ₹8 crore
Release variance (Released − Utilized): ₹1 crore
Deviation:  11.1%   ( 1 / 9 × 100 )
Status:     Needs verification
```

---

## Document index

| # | Document | Purpose |
|---|----------|---------|
| 01 | [Product Requirements Document](./01-PRD.md) | Mission, vision, audience, use cases, roadmap |
| 02 | [System Architecture](./02-System-Architecture.md) | Microservices, event-driven pipeline, queues, caching |
| 03 | [Data Collection / Engineering](./03-Data-Collection-Architecture.md) | Ingestion, scraping, PDF/OCR, validation, versioning, snapshots |
| 04 | [Database Design](./04-Database-Design.md) | PostgreSQL schemas, hierarchy, local bodies, GIS, ER diagrams |
| 05 | [Data Models](./05-Data-Models.md) | TypeScript interfaces |
| 06 | [Analytics Engine](./06-Analytics-Engine.md) | Variance, comparisons, cost-per-km/school/bed, formulas |
| 07 | [Risk Scoring Engine](./07-Risk-Scoring-Engine.md) | 0–100 verification-priority score |
| 08 | [Road Infrastructure Intelligence](./08-Road-Infrastructure-Intelligence.md) | Cost/km, material & asphalt estimation (domain-module template) |
| 09 | [Dashboard Design](./09-Dashboard-Design.md) | National, State, District, Village, Infrastructure, Audit |
| 10 | [API Documentation](./10-API-Documentation.md) | REST + GraphQL, filtering, pagination, auth |
| 11 | [AI Layer](./11-AI-Layer.md) | Summarization & Q&A with strict guardrails |
| 12 | [Tech Stack](./12-Tech-Stack.md) | Chosen technologies and rationale |
| 13 | [Security](./13-Security.md) | RBAC, audit logs, rate limiting, encryption, traceability |
| 14 | [Scalability Plan](./14-Scalability-Plan.md) | Eight-phase village→nation expansion |
| 15 | [Legal & Ethical Rules](./15-Legal-Ethical-Rules.md) | **Binding** neutrality & traceability rules |
| 16 | [Development Roadmap](./16-Development-Roadmap.md) | Build plan |
| 17 | [Deliverables & Folder Structure](./17-Deliverables-Folder-Structure.md) | Monorepo layout, risk analysis, legal notes |
| 18 | [Data Source Registry](./18-Data-Source-Registry.md) | Official portals: Central, all States, UTs, local bodies |
| 19 | [Administrative Hierarchy & Local Bodies](./19-Administrative-Hierarchy.md) | Village→nation model, LGD codes, geographic hierarchy |
| 20 | [GIS Intelligence](./20-GIS-Intelligence.md) | Map layers, asset GIS, heat & expenditure maps |

**Where the requested "national" sections live:** PRD → 01 · System Design (microservices/event-driven/caching) → 02 · Database Design + ER → 04 (+ 19 for hierarchy) · Data Engineering → 03 · Analytics → 06 (+ 08) · Risk Engine → 07 · GIS → 20 · Dashboard → 09 · API (REST+GraphQL) → 10 · AI → 11 · Security → 13 · Scalability → 14 · Folder Structure → 17 · Legal/Ethical → 15 · Development Roadmap → 16 · Risk Analysis → 17.

---

## Approved data sources

Only official government sources are ingested — Central, State, and Local Body. News, social media, blogs, third-party sites, and user-generated data are **never** used as sources of fact. Full registry (Central + all States + UTs, with urban/rural local-body portals) in [18 — Data Source Registry](./18-Data-Source-Registry.md).

---

_Working title **LokDarpan**. Alternatives considered: JanAudit, SarkarLens, BharatLedger, JanKhata, PublicFlow, RajyaTrack._
