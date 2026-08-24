# 00 — Document Audit

**Purpose.** A complete audit of the existing `docs/` suite (00–20) against the new product decision: **LokDarpan is a mobile-only application (iOS + Android). No website, no responsive web app, no desktop dashboard.**

This document records what exists, what is reusable as-is, what is web-specific and must be discarded or redesigned, what contradicts itself, what is missing, and every assumption this architecture phase makes. Nothing here is silently assumed.

**Audit basis:** all 21 documents in `docs/` (3,686 lines), read in full. **Existing code: none.** The repository contains documentation only — this is a greenfield mobile build against a backend that is also not yet built.

---

## 1. What already exists

| Doc                                | Content                                                                         | Status for mobile                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `00-README`                        | Mission, scope (village→nation), financial-flow model, doc index                | ✅ **Reusable** — product north star, unchanged                                             |
| `01-PRD`                           | Problem, mission, audience, 7 use cases, assumptions, limitations, metrics      | ✅ **Reusable** — audience/use cases drive the mobile IA directly                           |
| `02-System-Architecture`           | Microservices, event pipeline, queues, caching, deployment                      | 🟡 **Backend reusable; frontend section is web-only**                                       |
| `03-Data-Collection`               | Source registry, ingestion, PDF/OCR, validation, versioning, quarantine         | ✅ **Reusable** — no client impact, but defines the _data honesty_ the UI must express      |
| `04-Database-Design`               | Postgres/PostGIS schema, provenance columns, `admin_unit` closure, partitioning | ✅ **Reusable** — the entity model the app consumes                                         |
| `05-Data-Models`                   | TypeScript interfaces (`Money`, `Provenance`, `Traceable<T>`, `Project`, …)     | 🟡 **Reusable with contract changes** — see §4 (C1–C4)                                      |
| `06-Analytics-Engine`              | Variance, consistency, cost/km, peer median/MAD, HHI, roll-up                   | ✅ **Reusable** — every formula the app displays                                            |
| `07-Risk-Scoring`                  | 0–100 Verification Priority, factors, weights, bands, confidence                | ✅ **Reusable** — the naming discipline is a mobile UI requirement                          |
| `08-Road-Intelligence`             | Cost/km, material model, model-vs-peer deviation                                | ✅ **Reusable** — one entity screen section                                                 |
| `09-Dashboard-Design`              | Web dashboards, shared components, UI contracts, i18n, a11y                     | 🔴 **Layouts discarded; the three UI contracts are binding and carry over**                 |
| `10-API-Documentation`             | REST + GraphQL, envelope, pagination, filtering, auth                           | 🟡 **Envelope + provenance reusable; the endpoint set is insufficient for mobile** — see §5 |
| `11-AI-Layer`                      | RAG, guardrail stack, prohibitions, templated fallback                          | ✅ **Reusable** — prohibitions are binding on the mobile AI surface                         |
| `12-Tech-Stack`                    | Next.js, Tailwind, Mapbox GL JS, Recharts, Express, Postgres, BullMQ            | 🟡 **Backend reusable; every frontend choice must be re-decided** — see `.docs/adr/`        |
| `13-Security`                      | Threat model, RBAC, audit logs, rate limits, encryption, privacy                | 🟡 **Reusable; mobile adds new surfaces and one real problem** — see §4 (C9)                |
| `14-Scalability-Plan`              | Eight-phase village→nation expansion, capacity targets                          | ✅ **Reusable** — the constraint the mobile architecture must survive                       |
| `15-Legal-Ethical-Rules`           | **Binding** neutrality, traceability, language rules                            | ✅ **Binding, unchanged, and elevated** — §7 makes it structural in the app                 |
| `16-Development-Roadmap`           | Six-month Phase-1 engineering plan                                              | 🟡 **Month 3 (dashboard) replaced by the mobile plan in `25-implementation-roadmap`**       |
| `17-Deliverables-Folder-Structure` | Monorepo layout, risk register, legal notes                                     | 🟡 **Extended, not replaced** — see `23-repository-structure`                               |
| `18-Data-Source-Registry`          | Central + all states/UTs portals                                                | ✅ **Reusable** — powers the in-app Source Registry screen                                  |
| `19-Administrative-Hierarchy`      | `admin_unit` model, LGD codes, urban/rural bodies, money flow                   | ✅ **Reusable** — the spine of mobile navigation                                            |
| `20-GIS-Intelligence`              | PostGIS model, MVT tiles, layers, heat/expenditure maps                         | ✅ **Reusable** — the tile pyramid is exactly what a mobile map wants                       |

---

## 2. Reusable without change

These are **product and data truths**, independent of client platform, and this mobile architecture inherits them verbatim:

1. **The mission and the non-mission** (`00`, `01`, `15`). A transparency and mathematical-consistency tool. Not an accusation engine.
2. **The financial-flow model**: revenue → budget → ministry → state → district → local body → department → scheme → tender → contractor → release → expenditure → progress → completion → audit.
3. **The provenance contract** (`03`, `04`): every fact carries `source_document_id`, extraction method, confidence, retrieval date, record version.
4. **The `admin_unit` closure hierarchy** (`04`, `19`) — one generic tree covering urban, rural, and hybrid paths. This is what makes a single mobile "Unit" screen possible at every level.
5. **All analytics formulas** (`06`, `07`, `08`) — variance, deviation %, robust median/MAD, HHI, roll-up gap, cost-per-unit, risk factors and weights. The app computes **none** of these; it displays them.
6. **The legal/ethical rules** (`15`) — binding, and made structurally enforceable in `.docs/01-product/design-system.md` §Neutrality primitives and `.docs/14-testing/testing-strategy.md` §Guardrail tests.
7. **The AI prohibitions** (`11`).
8. **The eight-phase scale path** (`14`) — the architecture must not prevent Maharashtra-roads → national.

---

## 3. Web-specific — discarded or redesigned

| Item                                                                                          | Doc        | Verdict                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js App Router, SSR/ISR, server components                                                | `02`, `12` | ❌ **Discarded.** No web surface exists.                                                                                                                                                                        |
| CDN edge caching of _pages_; webhook revalidate                                               | `02`, `12` | 🔁 **Reframed.** CDN still caches _API responses_ and _tiles_; page-level ISR is gone.                                                                                                                          |
| SEO / "SEO for civic discovery"                                                               | `12`       | ❌ **Gone — and this is a real loss.** See §6 (PR-1).                                                                                                                                                           |
| Tailwind CSS                                                                                  | `12`       | ❌ Replaced by a token-based RN StyleSheet system (`.docs/01-product/design-system.md`).                                                                                                                        |
| Mapbox GL **JS**                                                                              | `12`, `20` | 🔁 Replaced — see `adr/006-maps.md`. The MVT pyramid it consumed is retained.                                                                                                                                   |
| Recharts / visx                                                                               | `12`       | ❌ Replaced by a bespoke `react-native-svg` chart kit — see `adr/007-charting.md`.                                                                                                                              |
| Six-page dashboard layout (Overview / Map / Project / Analytics / Audit)                      | `09`       | 🔁 **Redesigned, not ported.** KPI tile grids, grouped-bar comparisons, donut charts, and inconsistency _tables_ are desktop patterns. See `.docs/01-product/screen-inventory.md` §Screens that must not exist. |
| National / State / District / Village / Infrastructure / Audit as **six separate dashboards** | `09`       | 🔁 **Collapsed** into one level-agnostic Unit screen. Doc 09 already identified the "level-agnostic pattern" (money in / money out / what was built / consistency) — mobile takes that to its conclusion.       |
| Persistent breadcrumb bar (`India / Maharashtra / Pune / …`)                                  | `09`       | 🔁 Replaced by a scope chip + navigation stack + an explicit "Up to <parent>" row.                                                                                                                              |
| Chart export to PNG; bulk CSV/JSON export                                                     | `09`, `10` | 🔁 Reduced to share-sheet export of a single view. Bulk export stays an API/web concern.                                                                                                                        |
| Admin console (quarantine, entity review)                                                     | `17`       | ❌ **Explicitly out of mobile scope.** Internal web tool.                                                                                                                                                       |
| GraphQL endpoint                                                                              | `10`, `12` | ❌ **Not consumed by mobile.** See `adr/004-server-state.md`. It may continue to exist for third parties.                                                                                                       |
| Multi-pane / split layouts, hover tooltips, right-click                                       | `09`       | ❌ No mobile equivalent; replaced by bottom sheets and long-press.                                                                                                                                              |

---

## 4. Contradictions and defects found in the existing docs

Each is a real inconsistency that would produce a bug or a broken screen. Each becomes a requirement in `.docs/11-api/client-api-contract.md`.

**C1 — `variance` is ambiguous and inconsistently shaped.**
`05-Data-Models` defines `ProjectFinance.variance` with the comment _"released − utilized (or allocated − utilized, per context)"_. `06-Analytics-Engine` §1 correctly defines these as **two different quantities**. `10-API` then returns a single `finance.variance` on `GET /projects` but `releaseVarianceInr` on `GET /projects/:id/finance`.
→ **Requirement:** the API must always return both, explicitly named, never a single `variance`. The app must never have to guess which subtraction it is showing. A wrong label here is a neutrality failure, not just a bug.

**C2 — `Money.display` is server-formatted.**
`05` mandates a pre-formatted `display` string ("₹9.00 crore"). This breaks Marathi/Hindi localization, breaks OS font scaling (the string can't reflow), and hard-codes a crore/lakh decision the user may want to change.
→ **Requirement:** `inr` is authoritative and always present; the app formats. `display` is retained only as a degraded fallback and is never rendered when `inr` is available.

**C3 — money as a JSON `number` is precision-risky at national scale.**
`04` stores `NUMERIC(20,2)`; `05` types it as a JS `number`. A Union-Budget-scale aggregate (~₹50 lakh crore) is ~5×10¹⁴ paise — under `Number.MAX_SAFE_INTEGER` (9.007×10¹⁵) but with under two orders of magnitude of headroom, while `14-Scalability-Plan` targets ~10¹⁰ fact rows nationally. Any multi-year national rollup can cross it, and it will fail silently.
→ **Requirement:** amounts serialize as **decimal strings** in the mobile contract; the app parses to a fixed-point integer (paise) via a `Money` value object. No floating-point arithmetic on money anywhere in the app.

**C4 — three distinct things are all called "confidence."**
`03`/`04` use `confidence` for **extraction** confidence (OCR/parse). `03` uses it for **linkage/match** confidence (fuzzy entity matching). `07` defines `score_confidence` (weighted mean of inputs).
→ **Requirement:** distinct fields — `extractionConfidence`, `linkageConfidence`, `scoreConfidence`. The mobile UI shows different affordances for "this number may be misread" vs. "this number may belong to a different project."

**C5 — `GET /districts/:id` returns full geometry inline.**
`10-API` shows `"geometry": { "type": "MultiPolygon", … }` in the district payload. A real district MultiPolygon is hundreds of kilobytes to megabytes. On a 3G connection this is a broken screen.
→ **Requirement:** geometry is **never** inline by default. Boundaries come from the MVT pyramid; a simplified GeoJSON is available only via explicit `?include=geometry&simplifyTolerance=`.

**C6 — pagination is declared as "cursor + page" but only page-based is specified.**
`10-API` §Pagination heading says cursor, body documents `?page=&pageSize=`. Page-based offsets are unstable against a live dataset and produce duplicate/skipped rows in an infinite-scroll feed.
→ **Requirement:** cursor pagination for all feed-shaped endpoints; page-based retained only for bounded lists.

**C7 — the `district` table and `admin_unit` coexist.**
`04` keeps Phase-1 `district`, `road.district_id` etc. _and_ introduces the generic `admin_unit`, noting new code should use `admin_unit`. `10-API` exposes both `/districts/:id` and `/units/:id`.
→ **Requirement:** the mobile client targets `/units/:id` **only**. `/units/:id` must be a strict superset of `/districts/:id`. Two code paths for "a place" is the single fastest way to make this app unmaintainable.

**C8 — `page_locator` exists in the DB but is not exposed in the API `provenance` object.**
`04` has `source_document.page_locator` ("p.42 table 3"); `05`/`10`'s `Provenance` omits it.
→ **Requirement:** `pageLocator` (and, where available, a page number + bounding box) must be in `provenance`. Without it, "tap a number → land on the page of the PDF it came from" — the product's core promise on mobile — is impossible.

**C9 — IP-based rate limiting will misfire on Indian mobile networks.**
`13-Security` specifies edge + application rate limits "per IP." Indian mobile carriers operate large-scale CGNAT; tens of thousands of Jio/Airtel subscribers share egress IPs. Anonymous public reads from the mobile app would collectively trip a per-IP bucket, and the users hit would be exactly the low-income mobile-only users the product exists for.
→ **Requirement:** a per-install anonymous token bucket (rotating, non-tracking) or a substantially raised mobile tier, plus a graceful client-side `429` + `Retry-After` experience. See `.docs/12-security/mobile-security.md` §Abuse protection.

**C10 — `POST /ai/ask` cannot be cached and does not stream.**
A POST body defeats the ETag/`datasetVersion` caching the rest of the system relies on, and a non-streamed response on a 3G connection feels broken for 6–10 seconds.
→ **Requirement:** streaming (SSE or chunked) response, plus a deterministic idempotency key so an identical scoped question can be served from cache.

**C11 — no forced-upgrade / minimum-supported-client mechanism.**
Web can ship a breaking API change and reload every client. App-store clients live on devices for years. `10-API` has `/v1` but no client-support handshake.
→ **Requirement:** `GET /meta/client-support` returning minimum-supported and recommended build numbers, plus a soft-nudge / hard-block client flow.

**C12 — `16-Development-Roadmap` Month 3 builds a Next.js dashboard.**
Directly contradicts the mobile-only decision. Superseded by `.docs/01-product/roadmap-mobile.md`.

**C13 — `09-Dashboard-Design` mandates English + Marathi, but no other doc carries the i18n requirement.**
`12-Tech-Stack` lists no i18n library; `10-API` returns server-formatted strings (`Money.display`, `observation`) that cannot be localized client-side.
→ **Requirement:** `observation` strings must be returned as a **template key + typed parameters** (e.g. `{ key: "cost_per_km_above_median", params: { pct: 23.1, n: 19 } }`) alongside the rendered English string, so Marathi/Hindi rendering is possible without the client composing forbidden language. See `.docs/09-ai/ai-client-experience.md` §Neutral copy pipeline.

---

## 5. Missing requirements (backend work the mobile app needs and the docs do not define)

These are stated as **requirements**, not implementations. Full contract in `.docs/11-api/client-api-contract.md`.

| #       | Missing capability                                                                                                                                        | Why mobile needs it                                                                                                                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1**  | **A search endpoint.** `10-API` has none.                                                                                                                 | Search is a first-class mobile surface (`.docs/01-product/search-experience.md`). Filtering `/projects` is not search — it can't match a village name, a contractor alias, a tender ID, and a scheme in one query.              |
| **M2**  | **A `nearby` endpoint** (point + radius, or bbox) returning units, projects, and assets.                                                                  | "What public money was spent near me" is the primary citizen intent. `/anomalies?filter[district]=` cannot answer it.                                                                                                           |
| **M3**  | **Screen-shaped composite endpoints (a mobile BFF).**                                                                                                     | A project screen currently needs 5–7 round trips (`/projects/:id`, `/finance`, `/timeline`, `/risk`, `/anomalies`, `/tenders`, `/sources`). On 3G with 300ms RTT that is unusable. One request, one ETag, one `datasetVersion`. |
| **M4**  | **Delta / `since` endpoints** (`?since=<datasetVersion>`).                                                                                                | Offline pack refresh and watchlist change-detection must not re-download whole subtrees over metered data.                                                                                                                      |
| **M5**  | **Source-document page anchors and a range-requestable document URL.**                                                                                    | To open a 400-page budget PDF at page 42 without downloading 80 MB. Requires HTTP `Range` support on the artifact store.                                                                                                        |
| **M6**  | **Structured, localizable observation templates.** (see C13)                                                                                              | Neutral language must survive translation.                                                                                                                                                                                      |
| **M7**  | **Watchlist change-detection surface** — either a `since`-based diff (preferred, private) or opt-in push subscriptions.                                   | See `.docs/10-mobile/notifications.md`; the privacy analysis strongly favours the diff.                                                                                                                                         |
| **M8**  | **`GET /meta/client-support`** (see C11).                                                                                                                 |                                                                                                                                                                                                                                 |
| **M9**  | **Peer-comparison endpoint for a named pair/set of projects.**                                                                                            | `06` defines peer distributions but the API only exposes distribution _summaries_ on the district. Journey 5 ("compare with similar projects") needs an explicit comparison payload.                                            |
| **M10** | **AI quota per anonymous install.** `11` defines guardrails but no rate design.                                                                           | AI is one tap from every entity screen; abuse is trivial.                                                                                                                                                                       |
| **M11** | **Coverage / missing-data summary per unit.** `09` says local-body missing-data warnings must be "especially prominent" but no endpoint returns coverage. | Mobile needs `{ expected, present, missing[] }` to render honest empty states.                                                                                                                                                  |
| **M12** | **A share/landing target for deep links.**                                                                                                                | Universal links require a domain hosting `apple-app-site-association` and `assetlinks.json`, plus a minimal fallback page. See §8 (A6).                                                                                         |

---

## 6. Risks

### Product risks

**PR-1 — Mobile-only removes the desktop workflow for two of the six stated audiences. (High)**
`01-PRD` names **researchers** ("structured, versioned datasets; API access, bulk export, historical versions") and **journalists** ("comparisons, exportable source-linked evidence") as core segments. Both do this work on a laptop, across many records, in a spreadsheet. A phone cannot replace that, and `12-Tech-Stack`'s "SEO for civic discovery" — a stated acquisition channel — disappears entirely with the website.
_This is the most consequential trade-off of the mobile-only decision and it should be made with open eyes._
**Proceeding as directed.** Mitigation designed into this architecture: (a) the **public REST API remains the researcher/journalist product** and is treated as a first-class deliverable, not an afterthought; (b) every entity has a **shareable universal link**, so a story or an RTI can cite a stable URL even without a browsable site; (c) share-sheet CSV export of any single view. The mobile app is positioned for citizens, field journalists, and activists _at the point of need_; deep desk research is served by the API.

**PR-2 — A phone makes complex finance feel simple. (High)**
Compressing a five-hop financial chain into a 390pt-wide screen invites over-simplification, and over-simplification of a variance is how a neutral number becomes an accusation in a reader's head. _Mitigation:_ the Money Trail never shows a variance without its denominator, its status label, and its source; `insufficient_data` is a first-class visual state, never rendered as ₹0.

**PR-3 — Anomaly feeds are engagement machinery. (Critical)**
A scrollable feed of "problems near you" with push notifications is the standard mobile growth pattern and it is _exactly_ what `15-Legal-Ethical-Rules` forbids in spirit: it trains users to read variance as wrongdoing. _Mitigation:_ no anomaly feed on Home; observations are always **scoped to an entity the user navigated to**; no "worst districts" or "worst contractors" ranking anywhere (`07` explicitly forbids ranking people); no push notifications for anomalies (`.docs/10-mobile/notifications.md`).

**PR-4 — Coverage gaps look like app failure on mobile. (Medium)**
`03` guarantees sparse local-body data. On desktop, an empty table region reads as "no data." On a phone, an empty screen reads as "the app is broken." _Mitigation:_ `.docs/01-product/state-design.md` mandates that every empty state names _what_ is missing, _why_, _which source_ would carry it, and _when it was last checked_ — and that "missing from source" and "missing because you're offline" are visually and textually distinct.

### Architectural risks

**AR-1 — Map performance at national scale on low-end Android. (High)** ~10⁶ admin units and ~10⁷+ assets. _Mitigation:_ MVT pyramid + server-side clustering + zoom-gated layers + hard feature cap; see `.docs/02-architecture/mobile-gis-architecture.md`.
**AR-2 — No backend exists yet.** The mobile app is being designed against a specification, not a running API. _Mitigation:_ the Zod-validated contract layer + fixture repositories (`.docs/02-architecture/mobile-architecture.md` §Repository boundary) make the app buildable and testable before the API ships, and make drift a loud, typed failure rather than a crash.
**AR-3 — Offline correctness.** Cached financial figures are the same class of object as live ones; showing a stale ₹ figure without saying so is a traceability violation under `15`. _Mitigation:_ `asOf` + `datasetVersion` are carried on **every** cached record and rendered; see `.docs/10-mobile/offline-strategy.md`.
**AR-4 — Map library maturity vs. cost.** See `adr/006-maps.md`.
**AR-5 — App-store review of a government-data app.** Both stores scrutinise apps that appear to represent a government. _Mitigation:_ explicit non-affiliation copy in the store listing, on the About screen, and in onboarding.

### UX risks

**UR-1 — "Verification Priority" will be read as "corruption score."** _Mitigation:_ never red, never a gauge/speedometer, never sorted-descending as a headline list; always shown with its factor breakdown and its confidence; the band label leads with the _action_ ("worth a closer look"), not a grade.
**UR-2 — Deep hierarchies get lost.** Seven levels deep on a phone with no breadcrumb bar. _Mitigation:_ persistent scope chip + "Up to <parent>" row + a long-press-back ancestor menu (`.docs/02-architecture/mobile-navigation-architecture.md`).
**UR-3 — Source documents are hostile on mobile.** Scanned Marathi budget PDFs, 400 pages, no text layer. _Mitigation:_ page-anchored open, an extracted-value overlay card shown _before_ the raw page, and an honest "this document is a scan; the figure was read by OCR at 82% confidence" statement.
**UR-4 — Font scaling + Devanagari + tabular money.** At 200% text scale with Marathi labels, money columns break. _Mitigation:_ no fixed-width money columns; vertical label/value stacking above a scale threshold (`.docs/01-product/accessibility.md`).

---

## 7. Ambiguous requirements requiring a decision

| #   | Ambiguity                                                                                                                             | Resolution taken here                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `01-PRD` and `09` describe both an anonymous public product and keyed roles (`journalist`, `researcher`). Does the app have accounts? | **Anonymous-first.** No account required for any read, save, or offline pack. An optional account exists only for cross-device sync. See `adr/008-authentication.md`.                                                                           |
| A2  | Is the AI a chatbot or a feature? `11` describes Q&A; `§17` of the mobile brief says explicitly _not_ a generic chatbot.              | **A scoped explainer, not a tab.** Always entered from an entity or a scope; never a free-floating assistant. See `.docs/09-ai/ai-client-experience.md`.                                                                                        |
| A3  | `09` requires English + Marathi. Which is the default, and is Hindi in Phase 1?                                                       | **Device-locale detection → English default, Marathi and Hindi selectable at first launch and in Settings.** Phase 1 ships English + Marathi strings; Hindi scaffolded.                                                                         |
| A4  | Which "variance" does the headline figure on a project show?                                                                          | **Release variance (R − U)** as the headline, because it is the tightest, most recent link in the chain; allocation variance is shown one level down. Both always labeled with their formula.                                                   |
| A5  | `07` risk bands vs. `06` anomaly severities — two scales, both shown per project.                                                     | **Verification Priority (0–100 + band) is the project-level summary; anomaly severity is per-observation.** They are never combined or averaged in the UI.                                                                                      |
| A6  | "No website" vs. universal links, which require a domain and a fallback page.                                                         | **A minimal link-resolution host is not a website.** `lokdarpan.org` serves `apple-app-site-association`, `assetlinks.json`, and a single store-redirect page per entity type. No browsable product. Explicitly assumed; flag for confirmation. |
| A7  | Does the app support version pinning (`?version=N`)?                                                                                  | **Yes, but hidden** — surfaced only on the source/provenance surface as "data as of version N," and used implicitly for offline consistency. Not a user-facing control in Phase 1.                                                              |
| A8  | `13` gives `public`/`journalist`/`researcher` API tiers. Which does the app use?                                                      | **`public`**, with the CGNAT fix in C9. The app never ships an API key in the binary.                                                                                                                                                           |

---

## 8. Explicit assumptions

Every one of these is an assumption, not a finding. If any is wrong, the affected design must change.

1. **The backend of `02`/`04`/`10` will be built, and the mobile contract additions in §5 will be accepted.** The app is otherwise blocked on M1 (search) and M3 (BFF).
2. **Phase 1 mobile scope = Maharashtra roads**, matching `01-PRD`, with the `admin_unit` hierarchy switched on only to district/taluka level. Village/ward screens are built but will show coverage gaps.
3. **Source documents are reachable over HTTPS with `Range` support**, or are re-hosted in the platform's object store. Without this, in-app page-anchored viewing degrades to "open in browser."
4. **Reference low-end device:** Android 11, 4 GB RAM, Snapdragon 6-series-class, 720×1600. All performance budgets in `.docs/02-architecture/performance.md` are stated against this device, not a flagship.
5. **Network baseline:** intermittent 4G with 3G fallback, 150–400 ms RTT, frequent complete loss. Metered data is the norm.
6. **A domain is available for universal links** (A6).
7. **The codebase license will permit app-store distribution.** `17` lists the license as an open item; AGPL has known friction with Apple's App Store terms. **This must be resolved before submission** — see `adr/001-mobile-framework.md` §Consequences.
8. **No PII is collected.** No account required, no contacts, no advertising identifiers, no third-party analytics SDKs.
9. **Location is used, never stored.** Coordinates are sent for `nearby` queries and never persisted server-side or attached to an identifier.
10. **The neutrality rules of `15` bind the mobile client identically**, including all localized strings and any client-composed text.

---

## 9. Quality-gate status

Tracked in `.docs/README.md`. This document closes gate item 1 (_Documentation audited_).
