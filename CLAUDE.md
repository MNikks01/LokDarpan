# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**LokDarpan (लोकदर्पण)** — a public-finance, governance and infrastructure intelligence platform for India, built entirely on official government records. It links revenue → budget → allocation → release → expenditure → tender → contractor → work progress → audit into one traceable ledger and runs mathematical-consistency checks over it.

**There is no application code yet.** This repository currently contains only specifications, architecture, and a verified data-source registry. There is no `package.json`, no build, no lint, no test suite — do not go looking for them, and do not invent them. The first code to be written is `apps/mobile/` (see `.docs/25-implementation-roadmap.md`).

`.agents/`, `.claude/` and `skills-lock.json` are local skill installations, untracked and unrelated to the project.

## The three documentation layers

Read in this order; later layers supersede earlier ones where they conflict.

| Layer | Contents | Authority |
|---|---|---|
| `docs/` (00–20) | Platform spec: mission, PRD, system architecture, PostgreSQL/PostGIS schema, analytics formulas, risk scoring, AI guardrails, security, scalability, **legal/ethical rules** | Backend and data model |
| `.docs/` (00–25 + `adr/` + `wireframes/`) | Mobile product & architecture. The product is **mobile-only** — no website, no responsive web app, no desktop dashboard | The client |
| `.docs/data-sources/` | Verified government source registry — where the data actually comes from | Ingestion |

Two supersessions are annotated in place: `docs/16` Month 3 (built a Next.js dashboard) and `docs/17`'s `apps/web/`. Both are replaced by the mobile plan.

Start points: `.docs/README.md`, `.docs/data-sources/SOURCE-DISCOVERY-REPORT.md`.

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

**"Offline" and "not published" are different states** with different copy and iconography. Conflating them turns a dropped connection into an implied accusation against a government body.

**The client computes no financial arithmetic.** Variance, deviation %, cost/km, peer medians, HHI, roll-up gaps and Verification Priority all arrive computed, versioned and source-linked from the backend.

**`admin_unit` is the one hierarchy.** `docs/04` retains a legacy `district` table alongside the generic `admin_unit` closure; the mobile client targets `/units/:id` exclusively. Two code paths for "a place" is the fastest route to an unmaintainable app.

## Architecture in one pass

**Backend** (`docs/02`): source-driven ingestion → ETL (parse/validate/normalize/dedupe/load with provenance) → PostgreSQL+PostGIS canonical ledger → analytics/anomaly/risk → materialized views → read-only API. The only write path to the ledger is ETL; everything downstream is read-only. Event-driven on the write path, cache-served on the read path, keyed by a monotonic `datasetVersion`.

**Mobile** (`.docs/05-mobile-architecture.md`): Expo + React Native, TypeScript strict, four enforced layers (`app/` → `features/` → `domain/` ← `data/` → `platform/`), boundaries enforced by `dependency-cruiser` and ESLint rather than convention. Four bottom tabs; entity routes push onto the active tab's stack. **One level-agnostic Unit screen replaces the six dashboards of `docs/09`** — same six sections at state, district, taluka, ULB, Gram Panchayat and ward. This is what keeps a 15-level, 12-domain national platform inside one app; per-level or per-domain screens would break it.

**Data flow** (`.docs/04-data-flow.md`): screen-shaped composite endpoints (a mobile BFF), REST only — **not GraphQL**, because edge caching keyed on `datasetVersion` is what makes the offline story and the running cost work, and because one payload means one `datasetVersion` across every figure on a screen.

Ten ADRs in `.docs/adr/` record the technology decisions with their alternatives and trade-offs. **ADRs append; they are never rewritten.** A superseded ADR gets a status header and stays.

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
- **Backend P0 items** (`.docs/18-mobile-api-contract.md` §7): the mobile BFF, a search endpoint (absent entirely from `docs/10`), money as decimal strings, provenance page anchors, and a mobile rate tier — per-IP limits misfire on Indian carrier CGNAT and would throttle exactly the mobile-only users the product exists for.
- **Mobile-only removes the desktop workflow** for researchers and journalists, two of the six audiences named in `docs/01`, and removes SEO discovery. Recorded as PR-1 in `.docs/00-document-audit.md`; the public REST API is the designated mitigation.

## Conventions

- `docs/` is the platform spec; `.docs/` is the mobile spec; `.docs/adr/` holds decisions. Code comments explain *why*; `.docs/` explains *what and how*.
- A change to an architectural decision updates the relevant `.docs/` file or adds an ADR **in the same PR**. A decision that lives only in a commit message will be silently reversed within two quarters.
- Every document in `.docs/` is intended to have at least one automated check backing it once code exists (`.docs/23-repository-structure.md` maps them). A specification with no enforcement mechanism becomes fiction.
- When code lands, the mobile app joins the monorepo as `apps/mobile` — not a separate repository — so the neutrality word list, API contract, domain types and money formatting are shared packages rather than duplicated copies that drift.
