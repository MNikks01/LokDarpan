# 01 — Product Requirements Document (PRD)

> **Scope note:** this PRD is written concretely around **Phase 1 (Maharashtra roads)**, which is the first instance of the national **Bharat Public Governance Intelligence Platform**. The national mission, hierarchy (village→nation), all-ministry/all-domain coverage, and the eight-phase path are in [00 — README](../00-overview/platform-overview.md), [19 — Administrative Hierarchy](../03-domain/administrative-hierarchy.md), and [14 — Scalability Plan](../15-scalability/scalability-plan.md). The problem, principles, audience, and guardrails below hold identically at every level of the hierarchy.

## National mission (in one line)

Make official public-finance and infrastructure data — from the Union Budget down to a Gram Panchayat ward — **linked, comparable, mathematically checkable, and fully source-traceable**, so anyone can follow public money and see where the figures don't reconcile, without any accusation of wrongdoing.

## Problem statement

Public-finance data in India exists, but it is **fragmented, unlinked, and hard to reason about**. Revenue figures live in budget PDFs; allocations live in departmental demand-for-grants documents; releases and expenditure live in treasury and PWD systems; tenders and contractor awards live in e-procurement portals; physical progress lives in project MIS dashboards. No single public view connects _money received → money allocated → money released → money spent → asset built_, and no public tool checks whether these figures are **mathematically consistent** with one another.

Because the chain is broken, a citizen cannot easily answer basic questions such as _"₹10 crore was allocated to this road — how much was released, how much was spent, and is the arithmetic consistent?"_ Journalists and RTI activists reconstruct this by hand, one document at a time.

LokDarpan links these official records into a single traceable ledger and runs **consistency and variance checks** over them, presenting only facts and neutral observations.

## Mission

Make official public-finance and infrastructure data **linked, comparable, and mathematically checkable** for every citizen — with every number traceable to its government source.

## Vision

A national public-finance intelligence layer where anyone can follow a rupee from national revenue to a completed road, see where the figures don't add up, and understand public spending without needing an accountant or an RTI filing. Maharashtra roads is the first brick; the country is the building.

## Target audience

| Segment                         | What they need                                 | How LokDarpan serves them                                                         |
| ------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| **Citizens**                    | Plain-language understanding of local spending | Overview & Map dashboards; AI plain-language summaries                            |
| **Journalists**                 | Leads, comparisons, source links for stories   | Anomaly lists, district/historical comparisons, exportable source-linked evidence |
| **RTI activists**               | Specific figures and gaps to base filings on   | Traceable line items, missing-data warnings, variance reports                     |
| **Researchers / academics**     | Structured, versioned datasets                 | API access, bulk export, historical versions                                      |
| **Auditors / oversight bodies** | Consistency flags and audit trails             | Risk scores, audit view, immutable provenance                                     |
| **Civic-tech / NGOs**           | Programmatic access                            | Public REST API                                                                   |

## Use cases

1. **Follow the money for one project.** A user opens a specific rural road and sees allocation → release → expenditure → physical progress, each linked to its source document, with the variance computed.
2. **Compare a project against its peers.** "This 12 km road cost ₹4.1 cr/km; the district median for comparable rural roads is ₹2.9 cr/km — a +41% deviation." (Observation, not accusation.)
3. **Scan a district for inconsistencies.** A journalist filters the district for projects where `released − utilized` variance exceeds a threshold or where records are missing.
4. **Track budget revisions over time.** A researcher views how an allocation was revised across supplementary budgets, with each version preserved.
5. **Assess contractor concentration.** "In this taluka, 3 contractors received 78% of road tender value in FY2024–25." (Descriptive statistic.)
6. **Ask a question in plain language.** "How much did Maharashtra allocate to rural roads last year and how much was utilized?" → AI answers strictly from ingested official data with citations.
7. **Export evidence.** Any view can be exported with source links and confidence indicators for an article or RTI application.

## Business value

- **Public value:** stronger transparency and civic understanding; lower cost of scrutiny for journalists and activists.
- **Institutional value:** oversight bodies get an automated consistency layer over data they already publish.
- **Ecosystem value:** a clean, versioned, source-linked public dataset and API others can build on.
- **Sustainability:** grant / philanthropy / public-interest funding; the product deliberately avoids any revenue model that would compromise neutrality.

## Assumptions

- Required data is published by official portals in a retrievable form (API, CSV, XLS, or PDF).
- Portals are reasonably stable; schema drift is expected and handled by the ingestion layer.
- Figures across documents _can_ be reconciled by common keys (scheme code, work ID, tender ID, district, financial year) — where they cannot, that gap is itself reported.
- Currency is INR; amounts are normalized to a canonical unit (₹, with crore/lakh handling) internally.
- The platform reports; it does not adjudicate.

## Limitations

- **Data-bound:** LokDarpan can only reflect what is published. Missing or delayed publication becomes a _missing-data warning_, not an inference.
- **Reconciliation gaps:** if source documents use inconsistent identifiers, some links will be probabilistic and flagged with a confidence score.
- **No intent:** a variance is a numeric fact. LokDarpan never asserts a cause (delay, revision, misreporting, or wrongdoing).
- **OCR uncertainty:** figures extracted from scanned PDFs carry an extraction-confidence score and are marked as such.
- **Not real-time:** data reflects the cadence at which sources publish.

## Roadmap (product)

| Horizon    | Product milestone                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **M1–M2**  | Ingest Maharashtra roads revenue/allocation/release/expenditure + tenders; core ledger; variance engine; API                              |
| **M3**     | Public dashboard (Overview, Map, Project Detail)                                                                                          |
| **M4**     | AI plain-language summaries with guardrails                                                                                               |
| **M5**     | Anomaly detection + Risk scoring + Audit view                                                                                             |
| **M6**     | Hardening, provenance/versioning UX, production launch (Phase 1)                                                                          |
| **Beyond** | Transportation → all MH ministries → India roads → India ministries → national platform (see [14](../15-scalability/scalability-plan.md)) |

Detailed engineering plan in [16 — Development Roadmap](./roadmap-platform.md).

## Success metrics

- **Coverage:** % of Phase-1 projects with a complete allocation→expenditure chain.
- **Traceability:** % of displayed figures with a working source link (target: 100%).
- **Freshness:** median lag between source publication and platform availability.
- **Correctness:** reconciliation precision on a manually audited sample.
- **Usage:** unique users, API consumers, exports, stories/RTIs citing the platform.
