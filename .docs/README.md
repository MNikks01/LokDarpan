# LokDarpan — Product & Engineering Documentation

**The single source of truth.** One root: product, architecture, data, and the government source registry all live here.

> **The product is web-first.** The website ships first; the mobile application follows after launch.
> Read **[`decisions/web-first-pivot.md`](./decisions/web-first-pivot.md)** before anything else — it records what carries over (most of it), what reverses on desktop, and which rejections are permanent.

> **[`17-legal/legal-ethical-rules.md`](./17-legal/legal-ethical-rules.md) is binding on every document here.** Where anything conflicts with it, it wins and the feature is withheld.

> **What is built, deployed and open today:** [`00-overview/current-state.md`](./00-overview/current-state.md) — the one maintained snapshot. Every other status note is dated and describes its own day.

---

## How to read a document's status

Most of this suite was written between 21 and 25 August 2026, before any code existed and partly while the product was planned as mobile-only. Documents fall into five kinds. Most say which in their opening lines; wireframes and `10-mobile/` files inherit the label from their directory README, ADRs and runbooks carry their own status or date line, and the source-registry findings and inventories are dated evidence, kept as written:

| Kind                  | Means                                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active**            | Describes what exists or binds what is built: the legal rules, ADRs 011 onward, the runbooks, the source registry, `current-state.md`, `web-architecture.md`, `repository-structure.md`                                    |
| **Target spec**       | Describes what is to be built, written before the code. Its rules hold; its mechanics may not match the code. The schema of record is `database/migrations/`; the API contract of record is `packages/contracts`           |
| **Proposed**          | Awaiting a decision; not a commitment until accepted (`feature-priorities-2026-10-07.md`, `PUBLIC_FINANCE_GRAPH_ARCHITECTURE.md`, `maharashtra-tender-ingestion.md`)                                                       |
| **Deferred (mobile)** | Written for the native app, which follows web launch. Platform-independent rules inside still apply; native mechanics wait (`10-mobile/`, `wireframes/`, `mobile-*.md`, ADRs 001–010)                                      |
| **Historical**        | A dated record of what was known or decided then. Kept for its reasoning, never updated to look current (`document-audit.md`, `product-audit-2026-09-29.md`, `what-the-ledger-is-today.md`, superseded roadmaps, findings) |

---

## Map

| Area                                                | Contents                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`00-overview/`](./00-overview)                     | **[Current state](./00-overview/current-state.md)** · original platform overview · audits of 21 August (documentation) and **[29 September (features and blockers)](./00-overview/product-audit-2026-09-29.md)** · the 5 September ledger record                              |
| [`01-product/`](./01-product)                       | PRD · screens · journeys · design system · search · traceability · accessibility · states · **[sprint plan](./01-product/sprint-plan.md)** (accepted) · **[feature priorities](./01-product/feature-priorities-2026-10-07.md)** (proposed) · superseded and deferred roadmaps |
| [`02-architecture/`](./02-architecture)             | **[Repository structure](./02-architecture/repository-structure.md)** (as built) · **[web architecture](./02-architecture/web-architecture.md)** · system architecture and tech stack (original target) · finance-graph plan (proposed) · mobile architecture (deferred)      |
| [`03-domain/`](./03-domain)                         | Administrative hierarchy · road-infrastructure intelligence · GIS intelligence (target spec)                                                                                                                                                                                  |
| [`04-data-engineering/`](./04-data-engineering)     | Collection architecture (original design) · ingestion methods · source→data-model mapping · entity linking · OCR evaluation · Maharashtra tender ingestion (proposed)                                                                                                         |
| [`05-data-model/`](./05-data-model)                 | Database design (pre-migration; **read its correction notice**) · data models · screen/entity matrix. The schema of record is [`database/migrations/`](../database/migrations)                                                                                                |
| [`06-government-sources/`](./06-government-sources) | **The verified source registry** — 107 curated sources (104 verified) in `source-registry.json`, a 6,466-row catalogue, findings, licences and permission drafts                                                                                                              |
| [`07-analytics/`](./07-analytics)                   | Variance, comparisons, cost-per-unit, concentration, roll-up (target spec; `services/analytics` is empty)                                                                                                                                                                     |
| [`08-risk/`](./08-risk)                             | Verification Priority — never "corruption risk" (target spec)                                                                                                                                                                                                                 |
| [`09-ai/`](./09-ai)                                 | Guardrailed AI layer · scope-bound client experience (target spec; deliberately not started)                                                                                                                                                                                  |
| [`10-mobile/`](./10-mobile)                         | **Deferred** mobile-only capabilities — offline, deep links, notifications                                                                                                                                                                                                    |
| [`11-api/`](./11-api)                               | API documentation (original design) · client contract and its P0 list · screen/API matrix (mobile)                                                                                                                                                                            |
| [`12-security/`](./12-security)                     | Platform security · mobile client security (deferred)                                                                                                                                                                                                                         |
| [`13-observability/`](./13-observability)           | Privacy-first analytics and monitoring                                                                                                                                                                                                                                        |
| [`14-testing/`](./14-testing)                       | Test strategy and the guardrail gates (written for mobile; its banner maps the guardrails to CI)                                                                                                                                                                              |
| [`15-scalability/`](./15-scalability)               | The eight-phase village→nation plan                                                                                                                                                                                                                                           |
| [`16-operations/`](./16-operations)                 | **Runbooks:** deployment, migrations, collection, rate limiting, tender placement, CAG promotion, scans, raw store, corrections, public bodies, places named in audit reports, the private preview                                                                            |
| [`17-legal/`](./17-legal)                           | **Binding** legal and ethical rules                                                                                                                                                                                                                                           |
| [`adr/`](./adr)                                     | Decisions 001–079 — **011 onward active; 001–010 deferred (mobile)**. 060 and 063 are reserved for the blocked records-layer phase of `decisions/gods-eye-view-adoption.md` and not yet written                                                                               |
| [`wireframes/`](./wireframes)                       | Low-fidelity wireframes for the **mobile** client (deferred). No desktop wireframes exist; the pages in `apps/web` are the current reference                                                                                                                                  |
| [`diagrams/`](./diagrams)                           | Where the inline diagrams live                                                                                                                                                                                                                                                |
| [`decisions/`](./decisions)                         | Cross-cutting product decisions, dated                                                                                                                                                                                                                                        |

---

## Reading paths

**New to the project** → `00-overview/current-state.md` → `01-product/prd.md` → `17-legal/legal-ethical-rules.md` → `decisions/web-first-pivot.md` → `02-architecture/repository-structure.md`

**Building the website** → `00-overview/current-state.md` → `01-product/feature-priorities-2026-10-07.md` _(proposed; M1 in progress)_ → `02-architecture/web-architecture.md` → `adr/011`, `adr/012` → `01-product/design-system.md` → `01-product/state-design.md`

**Working on the map or ingestion safety** → `decisions/gods-eye-view-adoption.md` → `adr/022` → `adr/052`

**Working on tenders** → `adr/056` → `adr/067` → `adr/068` → `adr/079` → `16-operations/tender-placement.md`

**Working on scanned pages (OCR)** → `adr/038` → `adr/071` → `adr/072` → `16-operations/reading-scans.md`

**What changed most recently** → `00-overview/current-state.md` → the newest file in `decisions/`

**Working on data** → `../database/migrations/` (the schema of record) → `06-government-sources/SOURCE-DISCOVERY-REPORT.md` → `04-data-engineering/entity-linking.md` → `05-data-model/database-design.md` _(pre-migration design; read its correction notice first)_

**Deciding what to build next** → `01-product/feature-priorities-2026-10-07.md` _(proposed)_ → `00-overview/current-state.md` → `00-overview/product-audit-2026-09-29.md`

**Planning beyond tenders (receipts, transfers, the Money Trace)** → `02-architecture/PUBLIC_FINANCE_GRAPH_ARCHITECTURE.md` _(proposed)_ → `04-data-engineering/entity-linking.md` → `06-government-sources/source-licences.md`

**Reviewing for neutrality** → `17-legal/legal-ethical-rules.md` → `01-product/design-system.md` §Neutrality primitives → `01-product/screen-inventory.md` §Screens that must not exist → `14-testing/testing-strategy.md` §6

**Resuming the mobile app** → `decisions/web-first-pivot.md` → `10-mobile/README.md` → `02-architecture/mobile-architecture.md` → `01-product/roadmap-mobile.md` → `adr/001`–`010`

---

## The decisions that define this product

Platform-independent:

1. **One level-agnostic Unit page** replaces six separate dashboards — the reason a 15-level, 12-domain national platform fits in one codebase.
2. **A figure cannot be rendered without its provenance** — a compile error, not a code review.
3. **Neutral copy cannot be authored in a component** — the `ServerText` branded type plus a CI lint over every locale.
4. **No red anywhere** in variance, severity, or verification priority.
5. **No global anomaly feed, no rankings, no score on a contractor.** Never viewport decisions — they do not reverse on a bigger screen.
6. **Missing is never zero**, and no variance is computed across a missing stage.
7. **Money is `bigint` paise** — `NUMERIC(20,2)` overflows `MAX_SAFE_INTEGER` silently at national scale.
8. **REST, not GraphQL** — RSC already solves over-fetching, and one payload must carry one `datasetVersion`.

Web-specific:

9. **Every entity is a server-rendered, indexable page.** With no app store, SEO is the acquisition channel.
10. **Researcher surfaces ship before launch**, not after. They are why web goes first.

---

## Open items

Kept with the rest of the current position, in [`00-overview/current-state.md`](./00-overview/current-state.md) §Open items, so there is one list to update.

---

_Documentation written 21–24 August 2026. Restructured into this layout 24 August 2026. Document statuses and the current-state snapshot added 16 October 2026._
