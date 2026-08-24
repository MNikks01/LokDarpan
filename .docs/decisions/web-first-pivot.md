# 26 — Web-First Delivery: Decision & Impact

**Status:** Accepted · 2026-08-24 · Supersedes the mobile-only premise of `.docs/00-overview/document-audit.md`–`25`

## Decision

**Build and launch the website first. Defer the mobile application until the web product is live.**

This reverses the mobile-only decision that `.docs/00-overview/document-audit.md` through `.docs/01-product/roadmap-mobile.md` were written under. It does **not** cancel the mobile app — it re-orders delivery.

## Context

The mobile-only architecture phase produced a complete specification and, in doing so, surfaced its own strongest counter-argument. `.docs/00-overview/document-audit.md` recorded it as **PR-1**, the highest-rated product risk:

> Mobile-only removes the desktop workflow for two of the six stated audiences. `.docs/01-product/prd.md` names **researchers** ("structured, versioned datasets; API access, bulk export, historical versions") and **journalists** ("comparisons, exportable source-linked evidence") as core segments. Both do this work on a laptop, across many records, in a spreadsheet. A phone cannot replace that, and `.docs/02-architecture/tech-stack.md`'s "SEO for civic discovery" — a stated acquisition channel — disappears entirely with the website.

This decision acts on that finding. Three reasons make web-first the stronger opening move:

1. **The audience that can act on the data works on a desktop.** A journalist cross-checking 40 projects, a researcher pulling a versioned dataset, an RTI activist assembling an application — all of it is multi-window, copy-paste, spreadsheet work. The product's _impact_ runs through these users even though its _reach_ runs through citizens on phones.

2. **Discovery.** With no website there is no search-engine surface at all. A civic transparency platform that cannot be found by someone searching their district's name has a structural acquisition problem, and app-store search does not substitute for it. Shared links also degrade: `.docs/10-mobile/deep-linking.md` had to invent a "link-resolution host that is not a website" to make citations work at all.

3. **The data reality favours it.** `.docs/06-government-sources/SOURCE-DISCOVERY-REPORT.md` found that per-project expenditure and physical progress have **no verified source today**. The strongest verified material is tender/award records (36/36 States/UTs), budget documents, and the LGD hierarchy — dense, tabular, cross-sectional data. That is desktop-shaped content. The project-level Money Trail that anchored the mobile design is precisely the part that is least supportable right now.

## What this changes

| Area                                                             | Change                                                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Delivery order**                                               | Web to production first; mobile after                                                                                   |
| **`.docs/01-product/roadmap-platform.md` Month 3**               | Un-superseded — the Next.js dashboard month is back in force                                                            |
| **`.docs/02-architecture/deliverables-and-risk.md` `apps/web/`** | Restored to the monorepo; `apps/mobile/` becomes a later addition                                                       |
| **`.docs/02-architecture/tech-stack.md` frontend stack**         | Back in force, with the revisions in `.docs/02-architecture/web-architecture.md`                                        |
| **`.docs/` 00–25**                                               | Retained as the **mobile specification**, deferred not deleted. Their platform-agnostic content is promoted (see below) |
| **`.docs/adr/001`–`010`**                                        | Mobile-stack decisions — marked **Deferred**, not withdrawn. They stand for when mobile is built                        |
| **`.docs/06-government-sources/`**                               | **Unaffected.** Source discovery is platform-independent                                                                |

---

## What carries over unchanged

This is the important part: **most of the mobile-architecture phase was not platform-specific work.** The following transfer to the web build as-is, and represent the majority of the analytical value produced:

### Binding, and unchanged by platform

- **Every neutrality control.** `.docs/17-legal/legal-ethical-rules.md` binds the web client identically. The no-red palette, the `Figure`-requires-`provenance` rule, the branded `ServerText` type for observation copy, "Verification Priority" naming, contractor screens with no score or rank, audit findings as citations rather than analytics inputs — all of it applies. `.docs/01-product/design-system.md` §Neutrality primitives and `.docs/14-testing/testing-strategy.md` §6 (guardrails G1–G8) port directly.
- **The `.docs/17-legal/legal-ethical-rules.md` copy lint** over every locale, as a CI merge gate.

### Data-model and contract findings

- **All 13 contract defects** (`.docs/00-overview/document-audit.md` C1–C13) are backend bugs, not mobile issues. Money as a JSON number overflowing `MAX_SAFE_INTEGER`, the ambiguous single `variance` field, three different things called "confidence", inline geometry in the district payload, missing page anchors in provenance — every one of these breaks a web client exactly as badly.
- **The 12 missing backend requirements** (M1–M12) mostly stand. The search endpoint (M1), `nearby` (M2), page-anchored artifacts with `Range` (M5), structured localisable observation text (M6) and coverage summaries (M11) are all still required. Two change: see below.

### Product IA

- **The 12 user journeys** (`.docs/01-product/user-journeys.md`) are platform-independent. Follow-the-money, read-the-source, investigate-a-cost, compare-with-peers — the intent does not change with viewport.
- **The level-agnostic Unit page.** `.docs/01-product/screen-inventory.md` S-23 collapsed `.docs/01-product/dashboard-design-legacy.md`'s six separate dashboards into one screen whose six sections (money in / money out / what was built / consistency / sub-units / coverage) work at every hierarchy level. **This insight should carry to the web build.** `.docs/01-product/dashboard-design-legacy.md` itself identified the pattern; the mobile phase took it to its conclusion. Six dashboards is still six things to build and maintain, and the national-scale argument (15 levels × 12 domains) is viewport-independent. Desktop simply renders the same six sections at higher density.
- **The Money Trail, the Source panel, the lineage view, coverage-as-content** — all conceptually intact.
- **The five distinct empty states** and the missing-is-never-zero rule (`.docs/01-product/state-design.md`).

### Verification and quality

- The entire testing philosophy: contract tests as executable API spec, `domain/` at 95% branch coverage, type-level tests proving the neutrality primitives cannot be bypassed.

---

## What reverses — and what does not

The mobile phase rejected 14 patterns (`.docs/01-product/screen-inventory.md` §Screens that must not exist). **They were rejected for two different reasons, and only one kind reverses.**

### Rejected because of the phone → these return on web

| Pattern                            | Why it returns                                                                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wide data tables**               | A 1440px viewport renders a 12-column table well. This was a 390pt constraint, and it is the single most-requested affordance for the researcher and journalist audiences               |
| **Bulk export / dataset download** | `.docs/01-product/prd.md` names it explicitly for researchers. Trivial on web                                                                                                           |
| **API key management UI**          | The keyed tiers in `.docs/12-security/security.md` (`journalist`, `researcher`) need a self-serve surface                                                                               |
| **Multi-pane / split views**       | Compare a project against its peer distribution side by side                                                                                                                            |
| **Persistent breadcrumb bar**      | Costs ~24px on desktop instead of 44pt of a phone screen. `.docs/01-product/dashboard-design-legacy.md`'s `India / Maharashtra / Pune / Baramati` breadcrumb returns                    |
| **Sidebar navigation**             | Reasonable on desktop; the 4-tab bottom bar was a thumb-reach solution to a problem web does not have                                                                                   |
| **A dedicated Analytics surface**  | Rejected on mobile as "a chart looking for a question"; on desktop, a comparison explorer with room for controls is genuinely useful (`.docs/01-product/dashboard-design-legacy.md` §4) |
| **Dense keyboard workflows**       | Keyboard navigation, shortcuts, multi-select — desktop-native and valuable for repetitive verification work                                                                             |

### Rejected because of `.docs/17-legal/legal-ethical-rules.md` → these stay rejected, permanently

| Pattern                                                | Why it does not return                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Global anomaly feed**                                | Turns neutral observations into an engagement stream. The reasoning was never about screen size                                                                                                                                                        |
| **"Worst districts / worst contractors" rankings**     | `.docs/08-risk/risk-scoring-engine.md` forbids ranking people. A bigger screen does not make a leaderboard acceptable                                                                                                                                  |
| **Any score, rank, badge or flag on a contractor**     | Same                                                                                                                                                                                                                                                   |
| **Chart-to-PNG export**                                | Exports a number stripped of its source, breaking `.docs/17-legal/legal-ethical-rules.md` rule 5. A desktop right-click "save image" is _more_ dangerous here, not less — it is the easiest way to put an unsourced government figure into circulation |
| **Free-floating AI chat**                              | `.docs/09-ai/ai-layer.md`'s guardrails work because scope is bound. An open chat box invites out-of-scope questions that can only be refused                                                                                                           |
| **Gamification, streaks, badges**                      | Trivialises public finance                                                                                                                                                                                                                             |
| **Onboarding that fully skips the neutrality framing** | The "what this is not" statement is not optional on any platform                                                                                                                                                                                       |

**This distinction is the main thing to carry into the web build.** When someone proposes a pattern the mobile docs rejected, the question is always: _was that a viewport constraint or a `.docs/17-legal/legal-ethical-rules.md` constraint?_ The first reverses; the second never does.

---

## What changes in the backend requirements

Two items from `.docs/11-api/client-api-contract.md` shift, and one becomes less urgent:

| Item                              | Change                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M3 — the mobile BFF**           | **Downgraded from P0 to P2.** Screen-shaped composite endpoints existed to collapse 7 round trips on a 300ms-RTT cellular connection. A web client on broadband can tolerate parallel requests. Composites remain _desirable_ for `datasetVersion` coherence — one payload guarantees every figure on a page shares one version — but they no longer block delivery                                                 |
| **GraphQL**                       | **Reopened.** `.docs/adr/004` rejected it for mobile on HTTP-caching and bundle-size grounds. Neither argument is decisive for a server-rendered web client, and `.docs/11-api/api-documentation.md` already specifies a GraphQL schema for hierarchical drill-downs. Re-decided in `.docs/adr/012-web-api-strategy.md` — the caching argument still has force, so this was genuinely open, not a foregone reversal |
| **C9 — the CGNAT rate-limit fix** | **Still required**, and still P0. Indian users reach a website over the same carrier-NAT'd mobile networks. Per-IP limits misfire identically                                                                                                                                                                                                                                                                       |

Everything else in the P0 list — search, money as decimal strings, both variances, three confidences, provenance page anchors — is unchanged and still blocking.

---

## Honest costs of this pivot

Stated plainly rather than glossed:

1. **Some genuinely mobile-specific work is now deferred, not banked.** `.docs/02-architecture/mobile-navigation-architecture.md` (bottom-tab navigation), `.docs/02-architecture/mobile-gis-architecture.md` (map zoom ladder and offline tile packs), `.docs/10-mobile/offline-strategy.md` (three-tier offline storage), most of `.docs/wireframes/`, and ADRs 001–010 were written for a client that will now be built later, against a then-current toolchain. Expect some of it to need revision when mobile resumes. The IA, journeys, design system and neutrality work inside those documents remain valid.

2. **The citizen "near me" journey weakens.** J1 depended on device geolocation and a map-first entry. Browser geolocation exists but is a worse experience and is often denied. The citizen audience is genuinely better served on mobile, and this pivot accepts a delay in serving them well.

3. **Offline resilience is largely lost.** `.docs/10-mobile/offline-strategy.md` was built for intermittent, metered Indian networks. A website degrades on a bad connection with far fewer options. This is a real reduction in reach for exactly the users with the weakest connectivity, and it should be revisited when mobile ships.

4. **Risk of a second pivot.** Two platform reversals in one project would be expensive. This decision should be treated as settled through web launch.

None of these outweighs PR-1, but they are the price and should not be discovered later as surprises.

---

## What happens to the mobile documents

**Nothing is deleted.** `.docs/00-overview/document-audit.md`–`25`, `.docs/adr/001`–`010` and `.docs/wireframes/` remain as the mobile specification, to be resumed after web launch.

Each mobile-specific ADR gets a status header (`Deferred — pending web-first delivery; see .docs/decisions/web-first-pivot.md`). The documents themselves are not rewritten, per the standing convention that **ADRs append and are never rewritten**.

New web documents:

| Document                                                                              | Contents                            |
| ------------------------------------------------------------------------------------- | ----------------------------------- |
| [`.docs/02-architecture/web-architecture.md`](../02-architecture/web-architecture.md) | The web application architecture    |
| [`.docs/01-product/roadmap-web.md`](../01-product/roadmap-web.md)                     | Phased delivery to launch           |
| [`adr/011-web-framework.md`](../adr/011-web-framework.md)                             | Framework decision                  |
| [`adr/012-web-api-strategy.md`](../adr/012-web-api-strategy.md)                       | REST vs GraphQL, re-decided for web |
