# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**LokDarpan (लोकदर्पण)** — a public-finance, governance and infrastructure intelligence platform for India, built entirely on official government records. It links revenue → budget → allocation → release → expenditure → tender → contractor → work progress → audit into one traceable ledger and runs mathematical-consistency checks over it.

**There is no application code yet.** This repository currently contains only specifications, architecture, and a verified data-source registry. There is no `package.json`, no build, no lint, no test suite — do not go looking for them, and do not invent them.

**The product is web-first (decided 2026-08-24).** The website ships first; the mobile app follows after launch. The first code to be written is `apps/web/` — a Next.js app — per `.docs/28-web-implementation-roadmap.md`. This reversed an earlier mobile-only decision, so **treat `.docs/00`–`25` as the deferred mobile specification, not the active plan**. `.docs/26-web-first-pivot.md` records what changed and, more usefully, what did not.

`.agents/`, `.claude/` and `skills-lock.json` are local skill installations, untracked and unrelated to the project.

## The three documentation layers

Read in this order; later layers supersede earlier ones where they conflict.

| Layer | Contents | Authority |
|---|---|---|
| `docs/` (00–20) | Platform spec: mission, PRD, system architecture, PostgreSQL/PostGIS schema, analytics formulas, risk scoring, AI guardrails, security, scalability, **legal/ethical rules** | Backend and data model |
| `.docs/26`–`28` + `adr/011`–`012` | **Active web specification** — architecture, roadmap, framework and API decisions | The client being built |
| `.docs/00`–`25` + `adr/001`–`010` + `wireframes/` | **Deferred mobile specification.** Retained, not deleted. Much of it (journeys, IA, design system, neutrality primitives, contract findings) is platform-agnostic and carries over | Reference + future mobile |
| `.docs/data-sources/` | Verified government source registry — where the data actually comes from | Ingestion |

`docs/16` Month 3 (the Next.js dashboard month) and `docs/17`'s `apps/web/` were annotated as superseded during the mobile-only phase; both are now **reinstated** and annotated accordingly.

Start points: `.docs/26-web-first-pivot.md`, then `.docs/README.md` and `.docs/data-sources/SOURCE-DISCOVERY-REPORT.md`.

### The distinction that matters most when reading the mobile docs

The mobile phase rejected 14 UI patterns. They were rejected for **two different reasons**, and only one kind reverses on web:

- **Rejected because of the phone** — wide data tables, bulk export, multi-pane views, breadcrumbs, sidebar navigation, a dedicated analytics surface. These all **return on desktop**.
- **Rejected because of `docs/15`** — global anomaly feeds, rankings, any score on a contractor, chart-to-PNG export, free-floating AI chat, gamification. These **never return**, on any platform.

When someone proposes something the mobile docs rejected, ask which kind it was. `.docs/26` §"What reverses — and what does not" has the full table.

## `docs/15-Legal-Ethical-Rules.md` is binding on everything

This is the most important architectural fact in the repository. LokDarpan presents facts, calculations and neutral comparisons from official records. It is **not** an anti-corruption tool, an accusation engine, or a legal authority. Where any spec, feature, model output or copy conflicts with `docs/15`, `docs/15` wins and the feature is withheld.

This is not a policy document to nod at — it determines concrete engineering decisions throughout:

- **No red anywhere** in variance, severity, verification priority or status. A red badge implies wrongdoing before a word is read. Red is reserved for destructive user actions only. No red/green diverging ramps (also fails colour-vision deficiency).
- **No global anomaly feed, no anomaly push notifications, no rankings or leaderboards.** `docs/07` forbids ranking people. Observations are always scoped to an entity the user navigated to.
- **Contractor screens carry no score, rank, badge or flag.** Concentration statistics (HHI) attach to a *scope* (taluka, FY), never to a firm. This omission is deliberate and tracked in `.docs/20-screen-data-matrix.md` §3 so it stays auditable.
- The risk score is labelled **"Verification Priority"**, never "corruption risk", and is never rendered without its factor breakdown and confidence.
- Audit findings are **cited documents**, never inputs to the analytics engine — an auditor's conclusion is categorically different from arithmetic.

## Invariants that will bite you

These come from cross-referencing several documents; each is load-bearing.

**Money is a `bigint` of paise, never a float or a JSON number.** `docs/04` stores `NUMERIC(20,2)`; a national multi-year aggregate exceeds `Number.MAX_SAFE_INTEGER` and would fail *silently*, producing a wrong government figure with a correct-looking source link. Amounts cross the wire as decimal strings.

**A figure cannot be rendered without its provenance.** `<Figure>` requires a `provenance` prop — it is a compile error, not a code review item. A fact arriving without provenance is suppressed and logged as a contract violation.

**Neutral copy cannot be authored in a component.** Observation text is server-generated from vetted templates and typed as a branded `ServerText`; a string literal will not type-check. Paired with a CI lint over every locale file.

**Two variances, always, each with its denominator.** Release variance (R−U) and allocation variance (A−U) are different quantities. A field named `variance` must not exist. Never render a bare percentage.

**Three confidences, not one.** `extractionConfidence` (did we read it right?), `linkageConfidence` (does it belong to this project?), `scoreConfidence`. Low linkage confidence is the more serious of the first two and needs its own wording.

**Missing is never zero.** A null financial value renders a missing-data state naming the expected source and last-checked date. No variance is computed across a missing stage — status becomes `insufficient_data`.

**"Offline" and "not published" are different states** with different copy and iconography. Conflating them turns a dropped connection into an implied accusation against a government body. (Mobile-specific in practice, but the underlying rule — never imply non-publication — binds every surface.)

**The client computes no financial arithmetic.** Variance, deviation %, cost/km, peer medians, HHI, roll-up gaps and Verification Priority all arrive computed, versioned and source-linked from the backend.

**`admin_unit` is the one hierarchy.** `docs/04` retains a legacy `district` table alongside the generic `admin_unit` closure; clients target `/units/:id` exclusively. Two code paths for "a place" is the fastest route to an unmaintainable app, and on web it would also produce two indexable URLs for one entity.

## Architecture in one pass

**Backend** (`docs/02`): source-driven ingestion → ETL (parse/validate/normalize/dedupe/load with provenance) → PostgreSQL+PostGIS canonical ledger → analytics/anomaly/risk → materialized views → read-only API. The only write path to the ledger is ETL; everything downstream is read-only. Event-driven on the write path, cache-served on the read path, keyed by a monotonic `datasetVersion`.

**Web** (`.docs/27-web-architecture.md`): Next.js App Router, TypeScript strict, **React Server Components + ISR** for entity pages with client islands only for interaction. Entity pages ship almost no JavaScript and are server-rendered because **SEO is the acquisition channel** — with no app store, an unfindable civic site has a structural reach problem. ISR is revalidated by `datasetVersion` cache tag, not by time, which is what makes ~10⁶ concurrent users affordable on grant funding.

**One level-agnostic Unit page replaces the six dashboards of `docs/09`** — same six sections (money in / money out / what was built / consistency / sub-units / coverage) at state, district, taluka, ULB, Gram Panchayat and ward. This is what keeps a 15-level, 12-domain national platform inside one codebase; per-level or per-domain pages would break it. The insight came from the mobile phase and carries over.

**API** (`.docs/adr/012`): **REST, called server-side from RSC — not GraphQL.** GraphQL was genuinely reconsidered for web (the mobile arguments about bundle size and offline caching don't apply) and declined on new grounds: RSC already solves over-fetching by moving the fetch to the server, and one payload must carry one `datasetVersion` or two figures on a page carry different provenance vintages — a traceability defect, not a caching one.

**Mobile, deferred** (`.docs/05-mobile-architecture.md`): Expo + React Native, four enforced layers, four bottom tabs. Stands for when mobile resumes; revalidate the toolchain at that point.

Twelve ADRs in `.docs/adr/` record technology decisions with alternatives and trade-offs. **ADRs append; they are never rewritten.** 011–012 are active; 001–010 carry a `Deferred` status header and stay.

## Working with the data-source registry

`.docs/data-sources/` catalogues 99 curated sources (96 verified) plus a 6,466-row catalogue crawled from the Integrated Government Online Directory.

**The rule the registry is built on:** never record "the government does not publish X" because you could not find X. Record "X was not identified in the sources reviewed as of \[date\]."

This is not pedantry. A set of `.gov.in`/`.nic.in` hosts were unreachable from the verification environment; `lgdirectory.gov.in` was among them and then succeeded on a second network channel — proving the pattern was a vantage-point restriction, not site failure. Verification therefore uses **two independent network channels**, and every unreachable host is recorded as *"not reachable from the verification vantage point on \[date\]; existence not disproven"*.

**No URL is written from memory.** Every one is discovered from an official government directory or a `gov.in`/`nic.in`-restricted search, then fetched with HTTP status, final URL and page title recorded. Status model: `DISCOVERED` → `VERIFIED` (it responds) → `PRODUCTION_READY` (we know what it holds and how to get it). Nothing is `PRODUCTION_READY` yet.

Fields with no evidence are `null` or `"unknown"` — never guessed. If you add a source, verify it and record the evidence.

## Known blockers and open decisions

Do not treat these as settled; they are tracked in `.docs/README.md` and `.docs/data-sources/SOURCE-DISCOVERY-REPORT.md`.

- **Code licence is undecided.** AGPL has known friction with App Store distribution. This blocks store submission. Recommendation on file: Apache-2.0 or MPL-2.0 for `apps/mobile`.
- **The execution-data gap.** No public works register was located; no verified source for physical progress, financial progress, work orders, completion or per-project expenditure. `docs/06`'s central `Released − Utilized` variance therefore has **no verified source today**. The project-level Money Trail — the product's signature screen — depends on it. PMGSY's OMMAS is the highest-value unverified candidate.
- **Backend P0 items** (`.docs/18-mobile-api-contract.md` §7, re-prioritised for web in `.docs/28` §Backend dependencies): a search endpoint (absent entirely from `docs/10`), money as decimal strings, both variances, three confidences, provenance page anchors, no inline geometry, and a CGNAT-safe rate tier — per-IP limits misfire on Indian carrier NAT, which affects web users too. The composite BFF dropped from P0 to P2: a server-rendered client can make parallel calls.
- ~~Mobile-only removes the desktop workflow for researchers and journalists~~ — **resolved.** PR-1 was the reason for the web-first pivot; the researcher surfaces (tables, bulk export, API access) ship before launch in W9.
- **A second platform pivot would be expensive.** Web-first should be treated as settled through launch.

## Conventions

- `docs/` is the platform spec; `.docs/` is the mobile spec; `.docs/adr/` holds decisions. Code comments explain *why*; `.docs/` explains *what and how*.
- A change to an architectural decision updates the relevant `.docs/` file or adds an ADR **in the same PR**. A decision that lives only in a commit message will be silently reversed within two quarters.
- Every document in `.docs/` is intended to have at least one automated check backing it once code exists (`.docs/23-repository-structure.md` maps them). A specification with no enforcement mechanism becomes fiction.
- When code lands, `apps/web` joins the monorepo of `docs/17` (with `apps/mobile` added later) — not separate repositories — so the neutrality word list, API contract, domain types and money formatting are shared packages rather than duplicated copies that drift.
