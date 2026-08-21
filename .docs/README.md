# LokDarpan Mobile — Product & Architecture Documentation

**The single source of truth for the LokDarpan mobile application.**

LokDarpan is a public-finance, governance, and infrastructure intelligence platform for India, built entirely on official government records. As of this suite, **the product is mobile-only** — a native-quality iOS and Android application. There is no website, no responsive web app, and no desktop dashboard.

- `docs/` (00–20) — the **platform** documentation: mission, data model, ingestion pipeline, analytics, risk engine, GIS, AI guardrails, security, scalability, and the binding legal/ethical rules. Unchanged by this work.
- `.docs/` (this suite) — the **mobile product and architecture** documentation.

> **`docs/15-Legal-Ethical-Rules.md` is binding on every document here.** Where anything in this suite conflicts with it, it wins and the feature is withheld.

---

## Read in this order

**New to the project** → `docs/00-README.md` → `docs/01-PRD.md` → `docs/15-Legal-Ethical-Rules.md` → `00-document-audit.md` → `01-screen-inventory.md` → `wireframes/`

**Building a screen** → `01-screen-inventory.md` (the screen's spec) → `wireframes/` → `15-state-design.md` → `19-screen-api-matrix.md` → `06-design-system.md`

**Making an architectural change** → `05-mobile-architecture.md` → the relevant `adr/` → `23-repository-structure.md`

**Reviewing for neutrality** → `docs/15` → `06-design-system.md` §Neutrality primitives → `01-screen-inventory.md` §Screens that must not exist → `17-testing-strategy.md` §6

---

## Index

### Product
| Doc | Contents |
|---|---|
| [`00-document-audit.md`](./00-document-audit.md) | Audit of `docs/` 00–20 for mobile: reusable, web-specific, **13 contradictions**, **12 missing requirements**, risks, ambiguities, assumptions |
| [`01-screen-inventory.md`](./01-screen-inventory.md) | 80 surfaces, fully specified — plus **14 patterns explicitly rejected** |
| [`02-user-journeys.md`](./02-user-journeys.md) | 12 end-to-end journeys |
| [`24-pre-implementation-answers.md`](./24-pre-implementation-answers.md) | The 15 questions, answered |
| [`25-implementation-roadmap.md`](./25-implementation-roadmap.md) | 12 phases, ~20 weeks, with sequencing rationale |

### Design
| Doc | Contents |
|---|---|
| [`03-navigation-architecture.md`](./03-navigation-architecture.md) | 4 tabs, shared entity routes, depth without breadcrumbs |
| [`06-design-system.md`](./06-design-system.md) | Tokens, typography, the **no-red palette**, components, charts |
| [`15-state-design.md`](./15-state-design.md) | Loading · empty (×5) · error · offline · partial · stale |
| [`12-accessibility.md`](./12-accessibility.md) | WCAG 2.2 AA, applied natively |
| [`wireframes/`](./wireframes/) | Low-fidelity wireframes for every screen |

### Experience
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
[`adr/`](./adr/) — 001 framework · 002 navigation · 003 client state · 004 server state · 005 local storage · 006 maps · 007 charting · 008 authentication · 009 testing · 010 CI/CD. Each records context, alternatives, trade-offs, and consequences.

---

## The decisions that define this app

1. **One level-agnostic Unit screen** replaces the six dashboards of `docs/09`. Learned once at district level, applied in a village — and the reason a 15-level, 12-domain national platform fits in one app.
2. **A figure cannot be rendered without its provenance** — a compile error, not a code review. `docs/15` rule 5, made structural.
3. **Neutral copy cannot be authored in a component** — the `ServerText` branded type plus a CI lint over every locale.
4. **No red anywhere** in variance, severity, or verification priority. A red badge implies wrongdoing before a word is read; the palette is a neutrality control as much as an accessibility one.
5. **No global anomaly feed, no anomaly notifications, no rankings.** The default mobile engagement pattern is the fastest way to teach users that variance means scandal.
6. **Offline ≠ unpublished.** Two states, two messages, always. Conflating them turns a dropped connection into an implied accusation.
7. **The watchlist never leaves the device.** For an RTI activist, a server-side record of what they monitor is the only genuinely sensitive dataset the platform could hold.
8. **No account, no API key, no content in telemetry.** Anonymity is a feature to state publicly.
9. **REST with screen-shaped endpoints, not GraphQL** — because edge caching keyed on `datasetVersion` is what makes the offline story and the running cost work.
10. **Budgets are stated against a 4 GB Android phone.** That is the device the primary audience owns.

---

## Open items requiring a decision

| # | Item | Blocks | Owner |
|---|---|---|---|
| 1 | **Code licence** — AGPL conflicts with App Store distribution (`adr/001`). Recommend Apache-2.0 or MPL-2.0 for `apps/mobile` | Store submission | Project lead |
| 2 | Domain for universal links + the association-file host (`00-document-audit` A6) | Deep linking | Project lead |
| 3 | Backend acceptance of the P0 contract items (`18-mobile-api-contract.md` §7) | P6, P7 | Backend lead |
| 4 | MapLibre spike outcome (`adr/006`) | P8 | Mobile lead, week 1 |
| 5 | Confirmation that mobile-only is accepted with `00-document-audit` PR-1 understood (loss of SEO discovery and the researcher/journalist desktop workflow) | Positioning | Project lead |

---

## Quality gate — status before implementation

Per the brief §42, implementation begins only when every item is complete.

| | Item | Status | Where |
|---|---|---|---|
| ☑ | Documentation audited | Complete | `00-document-audit.md` |
| ☑ | Product requirements understood | Complete | `00`, `24` |
| ☑ | Mobile-only IA completed | Complete | `01`, `03` |
| ☑ | All screens identified | Complete — 80 surfaces + 14 rejected | `01` |
| ☑ | User journeys documented | Complete — 12 | `02` |
| ☑ | Navigation documented | Complete | `03`, `adr/002` |
| ☑ | Wireframes completed | Complete — 18 files, all screens | `wireframes/` |
| ☑ | Data flows documented | Complete | `04` |
| ☑ | API requirements documented | Complete — with a prioritised backend ask | `18` |
| ☑ | Data entities mapped | Complete | `19`, `20` |
| ☑ | Design system defined | Complete | `06` |
| ☑ | Tech stack selected | Complete | `adr/001`–`010` |
| ☑ | ADRs created | Complete — 10 | `adr/` |
| ☑ | Security considered | Complete | `13` |
| ☑ | Accessibility considered | Complete | `12` |
| ☑ | Offline behaviour considered | Complete | `11`, `15` |
| ☑ | Performance considered | Complete | `14` |
| ☑ | Testing strategy defined | Complete | `17` |
| ☑ | Legal/ethical rules incorporated | Complete — structurally enforced | `06`, `17` §6, `docs/15` |

**Gate status: passed.** The five open items above are decisions for the project lead and the backend team; none blocks starting Phase 1 (foundation) or Phase 2 (design system), and items 1, 3 and 4 must be resolved before Phase 4, Phase 6 and Phase 8 respectively.

---

*Documentation written 21 August 2026, against `docs/` 00–20 as of the same date.*
