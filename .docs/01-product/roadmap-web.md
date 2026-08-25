# 28 — Web Implementation Roadmap

> **Superseded 2026-08-25 by [`sprint-plan.md`](./sprint-plan.md).**
> This document planned the frontend on the assumption that a backend existed. It does not.
> The sprint plan is cross-functional (data, backend, frontend, DevOps, observability, security)
> and sequences against the real critical path, which is data rather than UI. The phase content
> below remains accurate as the _frontend_ view and is referenced by the sprint plan.

**Status:** Accepted · 2026-08-24 · Supersedes `.docs/01-product/roadmap-mobile.md` as the active plan (25 is retained for the deferred mobile build)

Replaces Month 3 of `.docs/01-product/roadmap-platform.md` with a fuller plan; Months 1, 2, 4, 5, 6 of `.docs/01-product/roadmap-platform.md` (backend, analytics, AI, anomaly/risk, hardening) stand, with the contract additions in `.docs/11-api/client-api-contract.md`.

**Team assumption:** 2 web engineers + 1 designer (part-time) + the existing backend/data team. **Duration:** ~14 weeks to public launch — shorter than the mobile plan because the IA, design system, journeys and neutrality work already exist.

---

## Backend dependencies

Web is blocked on fewer items than mobile was. The BFF is no longer P0 (`.docs/decisions/web-first-pivot.md` §Backend requirements).

| Priority | Requirement                                                                   | Blocks                                           |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| **P0**   | Search + suggest (M1)                                                         | The search surface                               |
| **P0**   | Money as decimal string; both variances; three confidences (C1–C4)            | Correctness of every figure                      |
| **P0**   | Provenance page anchors (C8)                                                  | Source traceability                              |
| **P0**   | Mobile/CGNAT rate tier (C9)                                                   | Indian users reach the site over carrier NAT too |
| **P0**   | No inline geometry (C5)                                                       | Unit pages                                       |
| **P1**   | Cursor pagination (C6) · `Range` on artifacts (M5) · coverage summaries (M11) | Feeds, document viewer, honest empty states      |
| **P2**   | Composite endpoints (M3) · peers/compare (M9) · streaming Ask (C10)           | Nice-to-have; parallel requests suffice          |

Until P0 lands, build against `packages/api-contract` fixtures with Zod contract tests as the executable spec — the same strategy the mobile plan used, and the reason those fixtures already exist.

---

## Phases

### W1 · Foundation — weeks 1–2

Next.js App Router + TypeScript strict · monorepo wiring (`apps/web`, `packages/{api-contract,neutrality,money,ui}`) · Zod contract layer + fixtures · `next-intl` scaffold (en/mr/hi) · CDN + ISR revalidation webhook wired to `datasetVersion` · CI: typecheck, lint, contract tests, bundle budget, Lighthouse.
**Exit:** an app that builds, renders a fixture-backed page via RSC, and revalidates on a simulated version bump.

### W2 · Design system + neutrality primitives — weeks 3–4

Tokens (both themes) · typography with tabular figures · **`Money` value object over `bigint` paise** · **`<Figure>`, `<Observation>`, `<MissingData>`, `<VerificationPriorityChip>`** · table primitives (TanStack Table) · empty/error states · bespoke SVG chart kit · `packages/neutrality` lint · type-level tests.
**Exit:** `<Figure>` without `provenance` fails to compile; `<Observation>` with a literal fails to compile; the neutrality lint blocks a PR; no red token in any band. **`.docs/17-legal/legal-ethical-rules.md` is structurally enforced before any page exists to violate it.**

### W3 · Shell, navigation, SEO foundation — week 5

Sidebar + breadcrumb + scope/FY controls · responsive breakpoints incl. table→card at <768px · metadata generation · sitemap index · `robots.txt` · JSON-LD (with the no-`Rating` constraint) · canonical URLs + alias redirects.
**Exit:** an entity page is server-rendered, indexable, and scores ≥95 Lighthouse SEO.

### W4 · Unit pages — weeks 6–7

The **level-agnostic Unit page** at every level · children table · roll-up consistency · peers · coverage · hierarchy browse.
**Exit:** the same page renders correctly at state, district, taluka, ULB, Gram Panchayat and ward — including a GP with almost no data, where coverage leads.

### W5 · Project, Money Trail, sources — weeks 8–9

Project page · **Money Trail** · ledger tables · timeline · progress · road intelligence · observations · verification-priority breakdown · **source panel, document viewer (page-anchored), lineage, source registry**.
**Exit:** follow-the-money and read-the-source work end to end, including a page-anchored document open and an `insufficient_data` chain rendering with no `₹0`.

### W6 · Search — week 10

URL-driven server-rendered search · grouped typed results · facets · the three zero-result states. **No query text in telemetry.**
**Exit:** search is shareable, indexable, back/forward-correct.

### W7 · Procurement, schemes, comparison — week 11

Contractor · tender · scheme · department pages · comparison builder with multi-pane layout.
**Exit:** a review confirms **no score, rank, badge or flag appears anywhere on a contractor page**.

### W8 · Map — week 12

MapLibre GL JS client island · self-hosted vector tiles · zoom ladder · server-side clusters · feature cap **with truncation announced** · the table equivalent as a co-equal view.
**Exit:** map and table render the same query; map is a dynamic import absent from other pages' bundles.

### W9 · Researcher surfaces — week 13

Bulk dataset download · CSV export **with source columns** · API-key self-service for the keyed tiers · methodology, coverage, legal, privacy, about pages.
**Exit:** a researcher can obtain a versioned, source-linked dataset without contacting anyone. **This closes PR-1.**

### W10 · Hardening + launch — week 14+

Accessibility sweep (keyboard, screen reader, 200% zoom, 320px) · Core Web Vitals pass · security review · **legal/neutrality copy review against `.docs/17-legal/legal-ethical-rules.md` in all three locales** · load test · monitoring · launch.
**Exit:** every quality-gate item green; external accessibility and security review.

**Ask (AI)** is deliberately not in the launch path — it is advisory and secondary (`.docs/09-ai/ai-layer.md`: if AI and ledger disagree, the ledger wins), and depends on the most backend work. Add after launch.

---

## Sequencing rationale

**Design system and neutrality primitives before any page (W2).** Once ten pages exist, retrofitting "a figure cannot render without provenance" means editing ten pages and hoping none is missed. Built first, it is impossible to violate. This was the most important sequencing decision in the mobile plan and it is unchanged.

**SEO foundation early (W3), not at the end.** Metadata, canonical URLs and server rendering are architectural, not a polish pass. Retrofitting indexability onto client-rendered pages is a rewrite.

**Unit pages before Project pages (W4 before W5).** The level-agnostic page is the harder abstraction and the bigger risk — if it does not hold at Gram Panchayat level, that must surface in week 7, not week 13.

**Sources ship with the project page, not after.** Traceability is not a feature to add later; it is the product.

**Researcher surfaces before launch (W9), not after.** They are the justification for web-first. Shipping without them would repeat the gap this pivot exists to close.

---

## Risks

| Risk                                                    | Impact                                                                             | Mitigation                                                                                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Backend P0 slips**                                    | High                                                                               | Fixture-driven development; contract tests already written                                                                                                                                 |
| **Execution-data gap** (`.docs/06-government-sources/`) | **High**                                                                           | Per-project expenditure and progress have no verified source. Plan the Money Trail to render `insufficient_data` honestly and lead with tender/award and budget data, which _are_ verified |
| Licence still undecided                                 | Blocks nothing for web (no app store), but still needed for an open-source release | Decide during W1–W2                                                                                                                                                                        |
| ISR revalidation storms at national scale               | Medium                                                                             | Scope-tagged revalidation from day one, not path-globbing                                                                                                                                  |
| Second platform pivot                                   | High                                                                               | Treat this decision as settled through launch (`.docs/decisions/web-first-pivot.md`)                                                                                                       |

---

## Definition of done, per phase

Pages match the IA in `.docs/01-product/screen-inventory.md` · all states from `.docs/01-product/state-design.md` implemented · domain logic unit-tested · components tested by accessibility role/label · contract tests with negative cases · keyboard + screen-reader verified · Core Web Vitals within budget · **neutrality guardrails green** · `.docs/` updated if a decision changed.

---

## After launch

1. Ask (AI) surface
2. **Mobile app** — resume `.docs/00-overview/document-audit.md`–`25` and `adr/001`–`010`, revalidating the toolchain choices against the then-current Expo/RN releases
3. Saved items and notifications, with the on-device privacy design from `.docs/10-mobile/notifications.md`
4. `.docs/15-scalability/scalability-plan.md` domain and geographic expansion (Phase 2 onward)
