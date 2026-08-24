# LokDarpan — Product & Architecture Documentation

**The single source of truth for the LokDarpan client applications.**

LokDarpan is a public-finance, governance, and infrastructure intelligence platform for India, built entirely on official government records.

> ## ⚠ Delivery order changed — 2026-08-24
>
> **The product is web-first.** The website ships first; the mobile application follows after launch.
> This reverses the mobile-only premise that documents `00`–`25` were written under.
>
> **Read [`26-web-first-pivot.md`](./26-web-first-pivot.md) before anything else in this suite.**
> It records the decision, what carries over unchanged (most of it), what reverses, and — critically —
> which of the mobile phase's rejected patterns come back on desktop and which stay rejected forever.

- `docs/` (00–20) — the **platform** documentation: mission, data model, ingestion pipeline, analytics, risk engine, GIS, AI guardrails, security, scalability, and the binding legal/ethical rules.
- `.docs/` **26–28 + `adr/011`–`012`** — the **active web specification**.
- `.docs/` **00–25 + `adr/001`–`010` + `wireframes/`** — the **mobile specification, deferred**. Retained, not deleted; much of it is platform-agnostic and carries over.
- `.docs/data-sources/` — the government source registry. **Unaffected by the pivot.**

> **`docs/15-Legal-Ethical-Rules.md` is binding on every document here.** Where anything in this suite conflicts with it, it wins and the feature is withheld.

---

## Read in this order

**New to the project** → `docs/00-README.md` → `docs/01-PRD.md` → `docs/15-Legal-Ethical-Rules.md` → **`26-web-first-pivot.md`** → `27-web-architecture.md` → `01-screen-inventory.md` (IA still applies)

**Building the website** → `26-web-first-pivot.md` → `27-web-architecture.md` → `28-web-implementation-roadmap.md` → `adr/011`, `adr/012` → `06-design-system.md` → `15-state-design.md`

**Building a screen** → `01-screen-inventory.md` (the screen's spec) → `wireframes/` → `15-state-design.md` → `19-screen-api-matrix.md` → `06-design-system.md`

**Making an architectural change** → `05-mobile-architecture.md` → the relevant `adr/` → `23-repository-structure.md`

**Reviewing for neutrality** → `docs/15` → `06-design-system.md` §Neutrality primitives → `01-screen-inventory.md` §Screens that must not exist → `17-testing-strategy.md` §6

---

## Index

### Web — the active specification
| Doc | Contents |
|---|---|
| [`26-web-first-pivot.md`](./26-web-first-pivot.md) | **Start here.** The decision, what carries over, what reverses, honest costs |
| [`27-web-architecture.md`](./27-web-architecture.md) | Next.js + RSC + ISR, page structure, SEO, budgets, responsive, neutrality primitives |
| [`28-web-implementation-roadmap.md`](./28-web-implementation-roadmap.md) | 10 phases, ~14 weeks to launch |
| [`adr/011-web-framework.md`](./adr/011-web-framework.md) | Next.js/RSC decision, with Astro and Remix considered |
| [`adr/012-web-api-strategy.md`](./adr/012-web-api-strategy.md) | GraphQL reopened and declined — on new grounds |

### Product (platform-agnostic — applies to both clients)
| Doc | Contents |
|---|---|
| [`00-document-audit.md`](./00-document-audit.md) | Audit of `docs/` 00–20 for mobile: reusable, web-specific, **13 contradictions**, **12 missing requirements**, risks, ambiguities, assumptions |
| [`01-screen-inventory.md`](./01-screen-inventory.md) | 80 surfaces, fully specified — plus **14 patterns explicitly rejected** |
| [`02-user-journeys.md`](./02-user-journeys.md) | 12 end-to-end journeys |
| [`24-pre-implementation-answers.md`](./24-pre-implementation-answers.md) | The 15 questions, answered |
| [`25-implementation-roadmap.md`](./25-implementation-roadmap.md) | 12 phases, ~20 weeks, with sequencing rationale |

### Design (mostly platform-agnostic)
| Doc | Contents |
|---|---|
| [`03-navigation-architecture.md`](./03-navigation-architecture.md) | 4 tabs, shared entity routes, depth without breadcrumbs |
| [`06-design-system.md`](./06-design-system.md) | Tokens, typography, the **no-red palette**, components, charts |
| [`15-state-design.md`](./15-state-design.md) | Loading · empty (×5) · error · offline · partial · stale |
| [`12-accessibility.md`](./12-accessibility.md) | WCAG 2.2 AA, applied natively |
| [`wireframes/`](./wireframes/) | Low-fidelity wireframes for every screen |

### Experience (mobile-specific unless noted)
| Doc | Contents |
|---|---|
| [`07-gis-mobile-architecture.md`](./07-gis-mobile-architecture.md) | Zoom ladder, clustering, the 400-feature cap, offline tiles |
| [`08-search-experience.md`](./08-search-experience.md) | Grouped results, transliteration, three zero-result states |
| [`09-ai-mobile-experience.md`](./09-ai-mobile-experience.md) | Scoped explainer — **not a chatbot, not a tab** |
| [`10-source-traceability.md`](./10-source-traceability.md) | Figure → source → page → lineage |
| [`11-offline-strategy.md`](./11-offline-strategy.md) | Three storage tiers; offline ≠ unpublished |
| [`21-deep-linking.md`](./21-deep-linking.md) | URL space, synthetic back stacks, link security |
| [`22-notifications.md`](./22-notifications.md) | On-device watchlist; **no anomaly pushes** |

### Engineering
| Doc | Contents |
|---|---|
| [`04-data-flow.md`](./04-data-flow.md) | Portal → pixel; caching, retry, pagination, failure taxonomy |
| [`05-mobile-architecture.md`](./05-mobile-architecture.md) | Layers, enforced boundaries, the three load-bearing decisions |
| [`13-mobile-security.md`](./13-mobile-security.md) | Threat model, documents, deep links, the CGNAT problem |
| [`14-performance.md`](./14-performance.md) | Budgets against a **low-end Android reference device** |
| [`16-observability.md`](./16-observability.md) | Privacy-first analytics; **no content, ever** |
| [`17-testing-strategy.md`](./17-testing-strategy.md) | Pyramid + **guardrail gates G1–G8** |
| [`18-mobile-api-contract.md`](./18-mobile-api-contract.md) | Backend requirements — the BFF, search, contract fixes |
| [`19-screen-api-matrix.md`](./19-screen-api-matrix.md) | Every screen × endpoint × cache × offline |
| [`20-screen-data-matrix.md`](./20-screen-data-matrix.md) | Every screen × entity |
| [`23-repository-structure.md`](./23-repository-structure.md) | Monorepo placement, shared packages |

### Decisions
[`adr/`](./adr/) — **011–012 are active (web); 001–010 are deferred (mobile)**. 001 framework · 002 navigation · 003 client state · 004 server state · 005 local storage · 006 maps · 007 charting · 008 authentication · 009 testing · 010 CI/CD. Each records context, alternatives, trade-offs, and consequences.

---

## The decisions that define this product

Platform-independent — these hold for web and mobile alike:

1. **One level-agnostic Unit page** replaces the six dashboards of `docs/09`. Learned once at district level, applied in a village — and the reason a 15-level, 12-domain national platform fits in one codebase.
2. **A figure cannot be rendered without its provenance** — a compile error, not a code review. `docs/15` rule 5, made structural.
3. **Neutral copy cannot be authored in a component** — the `ServerText` branded type plus a CI lint over every locale.
4. **No red anywhere** in variance, severity, or verification priority. A red badge implies wrongdoing before a word is read; the palette is a neutrality control as much as an accessibility one.
5. **No global anomaly feed, no rankings, no score on a contractor.** These were never viewport decisions — they are `docs/15` and `docs/07` decisions, and they do not reverse on a bigger screen.
6. **Missing is never zero**, and no variance is computed across a missing stage.
7. **Money is `bigint` paise, never a float** — `NUMERIC(20,2)` overflows `MAX_SAFE_INTEGER` silently at national aggregate scale.
8. **REST, not GraphQL** — for mobile because of edge caching and bundle size (`adr/004`); for web because RSC already solves over-fetching and because one payload must carry one `datasetVersion` (`adr/012`).

Web-specific:

9. **Every entity is a server-rendered, indexable page.** With no app store, SEO is the acquisition channel — and it is what closes the discovery gap that mobile-only created.
10. **The researcher surfaces ship before launch**, not after. Tables, bulk export and API access are the reason web goes first.

Mobile-specific (deferred, still valid):

11. **Offline ≠ unpublished** · **the watchlist never leaves the device** · **budgets stated against a 4 GB Android phone**.

## Open items requiring a decision

| # | Item | Blocks | Owner |
|---|---|---|---|
| 1 | **Code licence.** No longer blocks launch (no app store in the web path), but still needed for an open-source release. Recommend Apache-2.0 or MPL-2.0 | Open-source release | Project lead |
| 2 | Backend acceptance of the P0 contract items (`18-mobile-api-contract.md` §7, re-prioritised in `28` §Backend dependencies) | W4, W5 | Backend lead |
| 3 | **The execution-data gap** — per-project expenditure and physical progress have no verified source (`data-sources/SOURCE-DISCOVERY-REPORT.md`). Decides how much of the Money Trail can be populated at launch | W5 | Data lead |
| 4 | Confirm self-hosted deployability is tested, not assumed (`adr/011` §Trade-offs) | W1 | Web lead |
| 5 | ~~Confirmation that mobile-only is accepted with PR-1 understood~~ — **resolved 2026-08-24.** PR-1 was the reason for the web-first pivot (`26`) | — | Closed |

Deferred with the mobile build: the universal-link domain (`00-document-audit` A6) and the MapLibre RN spike (`adr/006`).

---

## Quality gate — status

Per the original brief §42. Items marked **↻** need a web pass; the rest are platform-agnostic and already complete.

| | Item | Status | Where |
|---|---|---|---|
| ☑ | Documentation audited | Complete | `00-document-audit.md` |
| ☑ | Product requirements understood | Complete | `00`, `24`, `26` |
| ☑ | Information architecture | Complete — one level-agnostic Unit page | `01`, `27` |
| ☑ | All screens identified | Complete — IA carries; `26` lists which rejected patterns return on desktop | `01`, `26` |
| ☑ | User journeys documented | Complete — platform-independent | `02` |
| ↻ | Navigation documented | **Web pass needed** — sidebar + breadcrumb replaces bottom tabs | `27`, then `03` for mobile |
| ↻ | Wireframes | **Web pass needed** — mobile wireframes stand for the deferred client; desktop layouts to be drawn in W3–W5 | `wireframes/` |
| ☑ | Data flows documented | Complete; RSC changes where fetching happens, not what | `04`, `27` |
| ☑ | API requirements documented | Complete, re-prioritised for web | `18`, `26`, `28` |
| ☑ | Data entities mapped | Complete | `19`, `20` |
| ☑ | Design system defined | Complete — tokens, neutrality primitives, chart kit all carry | `06` |
| ☑ | Tech stack selected | Complete for web | `27`, `adr/011`, `adr/012` |
| ☑ | ADRs created | 012 total — 011–012 active, 001–010 deferred | `adr/` |
| ☑ | Security considered | Complete; web adds no new client secrets | `13` |
| ☑ | Accessibility considered | Complete; `27` adds keyboard-first and semantic-table requirements | `12`, `27` |
| ☑ | Offline behaviour | Complete for mobile; **out of scope for web launch** | `11`, `27` |
| ☑ | Performance considered | Web budgets defined (Core Web Vitals) | `27` |
| ☑ | Testing strategy defined | Complete; Vitest/Playwright replace Jest/Maestro | `17`, `27` |
| ☑ | Legal/ethical rules incorporated | Complete — structurally enforced, unchanged by platform | `06`, `17` §6, `docs/15` |

**Gate status: passed for web, with two ↻ items to complete inside W3–W5** (desktop navigation and wireframes). Neither blocks starting W1 (foundation) or W2 (design system).

---

*Mobile suite written 21 August 2026. Web-first pivot 24 August 2026.*
