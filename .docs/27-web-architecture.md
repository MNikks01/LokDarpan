# 27 — Web Application Architecture

**Status:** Accepted · 2026-08-24 · Supersedes the frontend sections of `docs/02` and `docs/12`, and the layout of `docs/09`

The web application is now the first product. This document defines its architecture. Where it is silent, `docs/02` (system architecture) and `docs/12` (stack) still apply — the backend is unchanged.

## What the web product must do that mobile did not

Three requirements are new or newly-primary, and they shape the architecture:

1. **Be findable.** SEO is an acquisition channel (`docs/12`), and with no app store it is *the* acquisition channel. Every entity — every district, village, project, contractor, scheme — must be a server-rendered, indexable, linkable page. This alone rules out a client-rendered SPA.
2. **Serve the researcher and journalist workflow.** Dense tables, sorting, filtering, multi-record comparison, bulk export, keyboard navigation. This is the audience PR-1 identified as unserved by mobile.
3. **Stay cheap to run at national scale.** `docs/01` is grant-funded with no revenue model that could compromise neutrality. `docs/14` projects ~10⁶ concurrent users at Phase 8. The read path must be almost entirely cache-served.

## Stack

Reaffirming `docs/12` where it holds, revising where the mobile phase found better answers.

| Layer | Choice | Status vs `docs/12` |
|---|---|---|
| Framework | **Next.js (App Router)**, TypeScript strict | Reaffirmed — see `adr/011` |
| Rendering | **React Server Components** + ISR for entity pages; client components only for interaction | Reaffirmed and made central |
| Styling | **Tailwind CSS**, driven by the `.docs/06` design tokens | Reaffirmed |
| Data access | **Server-side fetch in RSC**; TanStack Query only for genuinely interactive client surfaces | Revised — most pages need no client data layer at all |
| API | **REST**, server-side | See `adr/012` |
| Maps | **MapLibre GL JS** + self-hosted vector tiles | Revised from `docs/12`'s Mapbox GL JS — same cost/independence reasoning as `adr/006` |
| Charts | Bespoke SVG chart kit; `visx` only if a general-purpose chart is genuinely needed | Revised from `docs/12`'s Recharts — see below |
| i18n | `next-intl`, English / मराठी / हिन्दी | New — `docs/09` required it, no library was chosen |
| Tables | **TanStack Table** (headless) | New — the researcher surface |
| Forms | React Hook Form + Zod | Only two surfaces need it (data-issue report, API-key management) |
| Validation | **Zod**, shared via `packages/api-contract` | Reaffirmed |
| Testing | Vitest + Testing Library + Playwright | Revised from the mobile Jest/Maestro stack |

### Why not Recharts (revising `docs/12`)

`docs/12` chose Recharts/visx. The mobile phase's reasoning for a bespoke SVG kit (`adr/007`) was **not primarily about mobile**:

- The signature visualisations — Money Trail, variance rows, peer distribution strip, cost-per-unit comparison — are not generic chart types and cannot be bought.
- Every chart must emit a **text equivalent and a table view** (`.docs/12-accessibility.md`), CI-gated. Retrofitting that onto a library's internal SVG is harder than writing the SVG.
- The **no-red, colour-blind-safe palette** is a `docs/15` control. A library's defaults are the first thing overridden and keep reappearing.

All three arguments are viewport-independent, so the bespoke kit carries over. `visx` (low-level, unopinionated primitives) is the escape hatch if a genuinely general chart is later needed — not Recharts, whose opinionated defaults are the problem.

## Rendering strategy — the core decision

```text
Entity pages          →  RSC + ISR, revalidated on datasetVersion bump
(unit, project,          Server-rendered HTML, indexable, cached at CDN
 contractor, tender,     Zero client JS for the content itself
 scheme, source)

Interactive surfaces  →  Client components, hydrated islands
(map, filters,           TanStack Query where client fetching is needed
 comparison builder,
 table sort/filter, Ask)

Search results        →  Server-rendered, URL-driven (?q=&types=&fy=)
                         Shareable, indexable, back/forward correct
```

**Why ISR rather than SSR-per-request.** The ledger is read-only and publishes at most daily (`docs/02` cron). Rendering a district page on every request wastes compute on data that changed yesterday. ISR renders once per `datasetVersion` and serves from the CDN — which is what makes ~10⁶ concurrent users affordable.

**Revalidation is driven by `datasetVersion`, not by time.** The ETL `dataset.published` event triggers a webhook that revalidates affected paths by cache tag. This is `docs/02`'s design, restored intact:

```text
ETL publishes v141 → dataset.published → revalidate webhook
                                       → tag `unit:532`, `project:501`, `fy:2024`
                                       → CDN purge for affected paths only
```

Scope-tagged revalidation matters at national scale — a Maharashtra ingest must not invalidate every page in India.

## Page structure

The **level-agnostic Unit page** from `.docs/01-screen-inventory.md` S-23 carries over, replacing `docs/09`'s six separate dashboards. Same six sections, at every hierarchy level, rendered denser on desktop.

```text
/                                   National overview
/unit/[id]                          Level-agnostic: nation → state → district →
                                    taluka → block → local body → village → ward
  /unit/[id]/children               Sub-units table (sortable, exportable)
  /unit/[id]/consistency            Roll-up check
  /unit/[id]/peers                  Peer comparison
  /unit/[id]/observations           Scoped observations
  /unit/[id]/coverage               What is missing and why
/project/[id]                       Project detail
  /project/[id]/finance             Money Trail + ledger tables
  /project/[id]/timeline · /progress · /intelligence · /priority · /compare
/contractor/[id] · /tender/[id] · /scheme/[id] · /department/[id]
/source/[docId]                     Source document record
  /source/[docId]/document          Page-anchored viewer
  /source/[docId]/lineage           Provenance chain
/sources                            Source registry (public, auditable)
/search                             URL-driven, server-rendered
/map                                Full-screen map (client island)
/ask                                Scope-bound explainer
/methodology · /coverage · /legal · /privacy · /about
/api-access                         API key self-service (keyed tiers, docs/13)
/data                               Bulk dataset download (researchers)
```

Aliases `/district/[id]`, `/village/[id]`, `/state/[id]` **301-redirect** to `/unit/[id]` — one canonical URL per entity, which matters for SEO and matches `docs/04`'s single `admin_unit` model.

## SEO — now a first-class requirement

| Concern | Approach |
|---|---|
| Indexability | Every entity page server-rendered with real content, no client-only data |
| Canonical URLs | One per entity; aliases redirect. `datasetVersion` never appears in the canonical URL |
| Metadata | Per-page `title`/`description` generated from entity data — *"Public spending in Baramati taluka, Pune — FY2024-25"* |
| Structured data | `Dataset` and `GovernmentOrganization` JSON-LD where accurate. **No `Review`, `Rating`, or `AggregateRating` markup** — a Verification Priority score must never be emitted as a machine-readable rating (`docs/15`) |
| Sitemaps | Generated per level, segmented; ~10⁶ units needs a sitemap index, not one file |
| `robots.txt` | Allow crawling of entity pages; disallow `/ask`, filter permutations, and export endpoints |
| Core Web Vitals | Budgets below — these are ranking inputs, not just UX |
| i18n | `hreflang` for en/mr/hi; localised URLs per locale |

**Constraint from `docs/15`:** meta descriptions are generated from **figures and place names only** — never from an observation, a variance, or a priority band. A search-result snippet is the most decontextualised surface the product has; an anomaly string appearing there would be exactly the accusation-without-evidence the rules forbid.

## Performance budgets

Stated for a **mid-range laptop on a 10 Mbps connection**, and for a **low-end Android phone on 4G** — because the responsive web app is also how phone users reach the product until the mobile app ships.

| Metric | Target | Ceiling |
|---|---|---|
| LCP (entity page, CDN hit) | **1.2 s** | 2.5 s |
| INP | **150 ms** | 200 ms |
| CLS | **0.05** | 0.1 |
| TTFB (CDN hit) | 100 ms | 300 ms |
| Initial JS (entity page) | **≤ 90 KB** gzipped | 150 KB |
| Initial JS (map page) | ≤ 400 KB | 600 KB |
| Entity page HTML | ≤ 60 KB gzipped | 120 KB |

Entity pages ship almost no JavaScript because they are RSC-rendered content with a few interactive islands. The map, comparison builder and Ask surfaces are dynamically imported and never load on a page that does not use them.

## Accessibility

`.docs/12-accessibility.md` carries over at WCAG 2.2 AA, with web-specific additions:

- **Keyboard-first.** Every workflow completable without a mouse; visible focus rings; skip links; logical tab order. This matters more here than on mobile — it is also the researcher's fast path.
- **Semantic HTML before ARIA.** Real `<table>` for tabular data (sortable headers with `aria-sort`), real `<nav>`, `<main>`, headings in order.
- **Tables get captions and scope attributes**, so a screen reader can navigate them by row and column.
- **The map keeps its list equivalent** — same query, same filters, as a table. Not a lesser view.
- Every chart still ships a text equivalent and a table view, CI-gated.
- Tested at 200% browser zoom and 320px viewport width.

## Responsive behaviour

The web app must work on a phone browser — that is how mobile users reach the product until the app ships.

| Breakpoint | Layout |
|---|---|
| ≥ 1280px | Sidebar navigation + content + optional right rail (peer context, sources) |
| 1024–1280px | Sidebar + content; rail collapses to inline sections |
| 768–1024px | Collapsible sidebar; tables scroll horizontally within their own container |
| < 768px | Single column; sidebar becomes a drawer; **tables become the mobile card pattern** from `.docs/06-design-system.md` |

The `RecordList` card pattern designed for mobile becomes the small-viewport rendering of a table. That work transfers directly.

## Neutrality primitives — unchanged, re-implemented for React DOM

These are `docs/15` controls and are not negotiable. The mobile implementations port with the same type-level enforcement:

- **`<Figure>`** requires a `provenance` prop. No monetary or derived value renders without a source affordance. A compile error, not a review item.
- **`<Observation>`** accepts only the branded `ServerText` type. A string literal will not type-check.
- **`<MissingData>`** names what is missing, the expected source, and when it was last checked. Never `₹0`, never blank.
- **`<VerificationPriorityChip>`** — band label leads with the action, amber ramp only, never renderable without its confidence and a one-click path to the factor breakdown.
- **No red** in any variance, severity, priority or status style. Enforced by a palette test in CI.

Shared with the future mobile client via `packages/neutrality` and the design tokens, so the two clients cannot drift.

## Repository placement

`apps/web/` returns to the monorepo of `docs/17`, restored:

```text
apps/
├── web/                  ← Next.js public site — THE product
├── api/                  Node REST gateway
├── admin/                Internal console (SSO+MFA)
└── mobile/               ← deferred; added after web launch
packages/
├── api-contract/         OpenAPI + generated Zod schemas + types
├── neutrality/           Forbidden-language lists + linter (en/mr/hi)
├── money/                ₹ formatting, Indian grouping, paise arithmetic
├── ui/                   Shared React components + design tokens
└── sdk/                  Typed public API client
```

`packages/ui` is restored to its original purpose (shared React components) rather than the `ui-web` admin-only scoping the mobile pivot imposed. Its components are consumed by `apps/web` now and shared with `apps/mobile` later where the platform allows.

## Money handling — unchanged and still critical

`docs/04` stores `NUMERIC(20,2)`. A national multi-year aggregate exceeds `Number.MAX_SAFE_INTEGER` and fails **silently**. The `Money` value object over `bigint` paise, and amounts crossing the wire as **decimal strings**, are required exactly as in `.docs/05-mobile-architecture.md`. This is a correctness requirement, not a mobile one, and it lives in `packages/money`.

## What is deliberately not built for launch

- **User accounts**, except API-key self-service for the keyed tiers in `docs/13`. Browsing requires no login.
- **Saved items / watchlists.** These were designed around on-device storage for privacy (`.docs/22-notifications.md`). A server-side watchlist would create the one genuinely sensitive dataset the platform otherwise avoids — *which identified person is monitoring which government contract*. Defer until the privacy design is redone for web, or until the mobile app carries it on-device.
- **Notifications.** Same reasoning.
- **Offline support.** A service worker for static shell caching is optional polish, not launch scope.
