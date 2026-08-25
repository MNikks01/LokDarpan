# LokDarpan — Product & Engineering Documentation

**The single source of truth.** One root: product, architecture, data, and the government source registry all live here.

> **The product is web-first.** The website ships first; the mobile application follows after launch.
> Read **[`decisions/web-first-pivot.md`](./decisions/web-first-pivot.md)** before anything else — it records what carries over (most of it), what reverses on desktop, and which rejections are permanent.

> **[`17-legal/legal-ethical-rules.md`](./17-legal/legal-ethical-rules.md) is binding on every document here.** Where anything conflicts with it, it wins and the feature is withheld.

---

## Map

| Area                                                | Contents                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`00-overview/`](./00-overview)                     | Platform overview · the audit of the original documentation set                                                                                  |
| [`01-product/`](./01-product)                       | PRD · screen inventory · user journeys · design system · search · source traceability · accessibility · state design · roadmaps (platform & web) |
| [`02-architecture/`](./02-architecture)             | System architecture · web architecture · tech stack · data flow · repository structure · performance                                             |
| [`03-domain/`](./03-domain)                         | Administrative hierarchy · road-infrastructure intelligence · GIS intelligence                                                                   |
| [`04-data-engineering/`](./04-data-engineering)     | Collection architecture · ingestion methods · source→data-model mapping · **entity linking**                                                     |
| [`05-data-model/`](./05-data-model)                 | Database design · data models · screen/entity matrix                                                                                             |
| [`06-government-sources/`](./06-government-sources) | **The verified source registry** — 99 sources, 96 verified, plus a 6,466-row catalogue                                                           |
| [`07-analytics/`](./07-analytics)                   | Variance, comparisons, cost-per-unit, concentration, roll-up                                                                                     |
| [`08-risk/`](./08-risk)                             | Verification Priority — never "corruption risk"                                                                                                  |
| [`09-ai/`](./09-ai)                                 | Guardrailed AI layer · scope-bound client experience                                                                                             |
| [`10-mobile/`](./10-mobile)                         | **Deferred** mobile specification — architecture, navigation, offline, deep links, notifications, GIS, roadmap                                   |
| [`11-api/`](./11-api)                               | API documentation · client contract · screen/API matrix                                                                                          |
| [`12-security/`](./12-security)                     | Platform security · client security                                                                                                              |
| [`13-observability/`](./13-observability)           | Privacy-first analytics and monitoring                                                                                                           |
| [`14-testing/`](./14-testing)                       | Test strategy and the guardrail gates                                                                                                            |
| [`15-scalability/`](./15-scalability)               | The eight-phase village→nation plan                                                                                                              |
| [`16-operations/`](./16-operations)                 | Runbooks and operational procedure _(to be populated)_                                                                                           |
| [`17-legal/`](./17-legal)                           | **Binding** legal and ethical rules                                                                                                              |
| [`adr/`](./adr)                                     | 12 decisions — **011–012 active (web); 001–010 deferred (mobile)**                                                                               |
| [`wireframes/`](./wireframes)                       | Low-fidelity wireframes (mobile; desktop pass due in W3–W5)                                                                                      |
| [`diagrams/`](./diagrams)                           | Architecture diagrams _(to be populated)_                                                                                                        |
| [`decisions/`](./decisions)                         | Cross-cutting product decisions                                                                                                                  |

---

## Reading paths

**New to the project** → `00-overview/platform-overview.md` → `01-product/prd.md` → `17-legal/legal-ethical-rules.md` → `decisions/web-first-pivot.md`

**Building the website** → `01-product/sprint-plan.md` → `decisions/web-first-pivot.md` → `02-architecture/web-architecture.md` → `adr/011`, `adr/012` → `01-product/design-system.md` → `01-product/state-design.md`

**Working on data** → `06-government-sources/SOURCE-DISCOVERY-REPORT.md` → `04-data-engineering/entity-linking.md` → `05-data-model/database-design.md`

**Reviewing for neutrality** → `17-legal/legal-ethical-rules.md` → `01-product/design-system.md` §Neutrality primitives → `01-product/screen-inventory.md` §Screens that must not exist → `14-testing/testing-strategy.md` §6

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

| #   | Item                                                                                                                                                              | Blocks                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Backend acceptance of the P0 contract items (`11-api/client-api-contract.md` §7)                                                                                  | W4, W5                                  |
| 2   | **The execution-data gap** — per-project expenditure and physical progress have no verified source                                                                | What the Money Trail can show at launch |
| 3   | **Q2: is OMMAS reachable?** (Q1 answered _no_, Q3 _yes_ — [`06-government-sources/sprint0-findings-q1-q3.md`](./06-government-sources/sprint0-findings-q1-q3.md)) | Phase-1 scope                           |
| 4   | Confirm self-hosted deployability is tested, not assumed (`adr/011`)                                                                                              | W1                                      |

---

_Documentation written 21–24 August 2026. Restructured into this layout 24 August 2026._
