# LokDarpan — Product, Feature & Architecture Audit

**Date:** 29 September 2026 · **Branch audited:** `docs/current-state-clean` @ `7ca2ad2` · **Scope:** the 32 target capabilities, six user journeys, and the Maharashtra PWD Road Intelligence phase

**Method.** Every claim below comes from one of three sources, and each says which:

- **[code]** — the repository was read: migrations `0001`–`0036`, `packages/database`, `packages/domain`, `apps/web/src/app`, `services/*`, CI workflows.
- **[prod]** — read-only `SELECT` counts against the production Neon database (`lokdarpan-production`), run on 29 September 2026.
- **[local]** — the same counts against the local Docker Postgres, which holds data that production does not.
- **[docs]** — `.docs/`. It is cited only where the code or data could not settle a question, and it is marked as documentation, not evidence.

`.docs/17-legal/legal-ethical-rules.md` binds this audit like every other document. Several of the 32 target capabilities are phrased in ways it forbids (§5.2). Those are audited against the **permitted form** of the capability, and the conflict is stated, not smoothed over.

---

## Executive Blocker Summary

```text
┌────────────────────────────────────────────────────────────────────────┐
│ TOP BLOCKER                                                            │
│                                                                        │
│ There is no public, republishable source for a Maharashtra PWD         │
│ "project", "contract" or "contractor". Maharashtra's tender portal     │
│ forbids crawling, award data is CAPTCHA-gated on every GePNIC portal,  │
│ PWD publishes no works register, and the one work-level register       │
│ found (PMGSY/OMMAS) forbids republication.                             │
│                                                                        │
│ This is a DATA / LICENCE blocker, not an engineering one. No schema    │
│ work removes it.                                                       │
│                                                                        │
│ Blocks: Projects · Timeline · Follow-the-money · Contracts ·           │
│         Contractors · Cost & delay analysis · "What happened?" · AI    │
└────────────────────────────────────────────────────────────────────────┘
```

**The second finding matters as much as the first.** The production ledger is narrower than the repository's own status pages say:

| [prod], 29 Sep 2026                          |     Count | What `CLAUDE.md` / `what-the-ledger-is-today.md` say |
| -------------------------------------------- | --------: | ---------------------------------------------------- |
| `admin_unit` — states · districts            |  36 · 787 | "LGD state hierarchy" ✔                              |
| `admin_unit` — sub-districts, villages, ULBs |     **0** | (local holds 355 · 40 · 18)                          |
| `admin_unit_boundary` (OSM)                  |       823 | ✔                                                    |
| `document` · `document_page`                 | **0 · 0** | "CAG audit reports" — **not in production**          |
| `document_fact` (any status)                 |     **0** | "5,088 published facts" — **local only**             |
| `department` · `budget_scheme` · finance     |     **0** | "BEAMS actuals collected" — **local only**           |
| `tender`                                     |     1,318 | ✔ (21 portals)                                       |
| `tender` from Maharashtra                    |     **0** | — (`Disallow: /`, correctly not collected)           |

So on production today, `/documents` renders an empty list, the department page has nothing to render, and the only real, populated product surface is **the district map of open tenders in 21 states that are not Maharashtra**. The CAG corpus, the strongest asset the project has, is sitting in a local Docker volume.

### Top 10 blockers

| #   | Blocker                                                                                                           | Kind                            | Blocks                                                                                       | Fix complexity                                             |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| B1  | CAG corpus and reviewed facts never loaded into production                                                        | Operations                      | Documents (13), Evidence (14), Audit (31), document search, citizen journey end              | **S** — a runbook and one load                             |
| B2  | No Maharashtra tender data: `mahatenders.gov.in` serves `Disallow: /`                                             | Data / access                   | Tender explorer for MH (8), every PWD surface                                                | **Not engineering** — access request drafted, unsent       |
| B3  | Award-of-contract data CAPTCHA-gated on every GePNIC portal and CPPP                                              | Data / access                   | Contract, contractor, award value, concentration (9, 10, 22)                                 | **Not engineering**                                        |
| B4  | No public works register (PWD) and OMMAS forbids republication                                                    | Data / licence                  | Canonical project (5), timeline (6), follow-the-money (7), delay/cost (20, 21), summary (32) | **Not engineering** — NRIDA draft unsent                   |
| B5  | Tender details and BEAMS figures withheld pending permission; no request has been sent                            | Licence (self-imposed, correct) | Tender detail pages (8), budget explorer (12), department page (3)                           | **S** to send; the answer is outside our control           |
| B6  | No canonical `project`, `contract`, `contractor`, `scheme` (as a cross-source entity) or entity-link table        | Architecture                    | Every cross-source join (5, 7, 9, 11, 31)                                                    | **M** — but premature until B3/B4 move (§11)               |
| B7  | Search is `ILIKE '%term%'` over place names and document titles only; no tenders, facts or pages; no index        | Architecture                    | Global search (15), filters (16), researcher journey, AI (28, 29)                            | **S–M**                                                    |
| B8  | Sub-district, ULB and village geography absent from production                                                    | Operations                      | State explorer below district (2), local-body map (4)                                        | **S** — load what local already holds                      |
| B9  | Public API has no rate limit, no pagination cursor, no OpenAPI description; P0 "CGNAT-safe rate tier" unmet       | Architecture / security         | Open data API (27), developer journey, production safety                                     | **S–M**                                                    |
| B10 | Contractor extraction from CAG text has never produced a verified row (0 verified · 257 rejected · 50 unverified) | Data quality                    | Any contractor surface built from audit text (9)                                             | **M** — parser redesign, or accept that it is not a source |

### Recommended execution order (adjusted to the repository)

The generic order (foundation → ingestion → entity resolution → projects → tenders → contractors → map → analytics → AI) **does not fit this repository**. Foundation and provenance are already the strongest part of it. Projects and contractors are blocked by data, not by sequence. The order that follows from the evidence:

```text
1. SHIP WHAT IS HELD            B1, B8 — load CAG corpus + sub-district geography to prod
      ↓                          unlocks: Documents, Evidence, Audit explorer, deeper Unit pages
2. MAKE IT FINDABLE             B7 — one search index over places, documents, pages, facts, tenders
      ↓                          unlocks: Global search, filtered lists, researcher journey
3. HARDEN THE PUBLIC SURFACE    B9 — rate tier, cursor pagination, OpenAPI, ISR by datasetVersion
      ↓                          unlocks: Open data API, bulk CSV export, developer journey
4. SEND THE LETTERS             B5, B2, B4 — mahatenders, departments, Finance Dept, NRIDA
      ↓                          unlocks (on "yes"): MH tenders, tender detail, budget explorer, PMGSY works
5. DOCUMENT-BORNE ENTITIES      B6 — entity + entity_link + alias tables, fed first by CAG and GRs
      ↓                          unlocks: Audit ↔ place ↔ scheme links; project pages where a document names a work
6. WATCH & EXPORT               watchlists on figures, CSV with provenance columns
      ↓
7. SCOPE-BOUND AI               only over steps 1–5, only with citations
```

Steps 1–3 are fully in the team's control and deliver a real, lawful product. Step 4 decides whether "Maharashtra PWD Road Intelligence" can exist at all. Every PWD-specific feature waits on it. The letters cost nothing, so they should be sent on day one, in parallel with step 1.

---

## 1. Executive summary

**What LokDarpan is today.** It is a provenance-first ledger with a disciplined ingestion layer. Content-addressed raw artefacts, a monotonic `dataset_version`, per-row extraction confidence, a human review queue with history, and page-rectangle geometry for every extracted figure. It serves a deployed web client whose one populated surface is a national map of open tenders by district. The engineering quality of the foundation is high. The rules that protect neutrality are enforced by types, views and CI gates, not by convention.

**What it is intended to become.** A traceable chain from revenue to audit, starting with Maharashtra PWD roads.

**Current maturity.** Foundation: strong. Data held: narrow. Data published: narrower still. Product surfaces: early. The gap between intent and today is **mostly data access and licensing, then operations, then engineering**, in that order of size.

**Biggest blockers.** B2–B4 decide whether the Phase-1 vision is reachable; B1 and B7 decide how much of the lawful product is visible.

**The most important architectural decisions ahead:**

1. **Whether Phase 1 stays "Maharashtra PWD".** On the evidence, Maharashtra is the _least_ reachable state for tenders: its portal is the one that forbids crawling. A Phase 1 re-scoped to "CAG-audited roads + tenders in collectable states + the LGD hierarchy" is buildable now. "Maharashtra PWD project pages" are not.
2. **How project identity is modelled before any project source exists** (§10.B). The recommendation is document-borne entities with a link table, not a `project` table waiting to be filled.
3. **Whether `services/api` or `apps/web/src/app/api/v1` is the API.** Today the web routes are the real API and `services/api` holds an in-memory fixture. Keeping both is the "two code paths" failure `CLAUDE.md` warns about for places.

---

## 2. Current architecture [code]

```text
                    ┌──────────────── GitHub Actions ─────────────────────┐
                    │ nightly 20:00 UTC: ingest:gepnic --all (21 portals) │
                    │ CI: format · lint · types · neutrality · palette    │
                    │     · import rules · migrations · tests · e2e       │
                    └───────────────────────┬─────────────────────────────┘
                                            │ direct (unpooled) conn, ETL role
 Local operator CLIs (not scheduled):       ▼
  lgd · osm · cag · beams · pincode   ┌───────────────────────────────┐
  review · triage · place · resolve ─▶│ Neon Postgres 18 + PostGIS    │
                                      │ admin_unit (+closure,boundary)│
  services/ocr (Python, Tesseract)    │ source_artifact · dataset_ver │
   → benchmark only; not in ledger    │ document · page · fact · text │
     (ADR-039)                        │ department · scheme · finance │
                                      │ tender · version · decision   │
                                      │ ingestion_run · coverage      │
                                      └──────────────┬────────────────┘
                                                     │ pooled, read-only role
                                      ┌──────────────▼────────────────┐
                                      │ Vercel · Next.js App Router   │
                                      │ /explore (MapLibre, client)   │
                                      │ /units, /units/[id], /dept    │
                                      │ /documents, /documents/[id]   │
                                      │ /project/[id]  ← FIXTURE      │
                                      │ /api/v1/{units,geo,tenders,   │
                                      │   documents,search}           │
                                      └───────────────────────────────┘
 services/api (tsyringe DI) — in-memory ProjectRepository; not deployed
 services/{ai,analytics,entity-resolution,normalization,risk-engine} — empty
 Redis — in docker-compose; no code path uses it
```

| Layer     | What exists                                                                                                                                                                              | Assessment                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Frontend  | Next.js RSC; MapLibre explorer with district shading, level switching and label de-duplication; unit, department and document pages; copy in `src/copy/`; `<Figure>` requires provenance | Good discipline. Every page is `force-dynamic`, not ISR by `datasetVersion` as ADR-012 and web-architecture specify |
| Backend   | Route handlers in `apps/web/src/app/api/v1` over `packages/database` repositories; `respond()` wraps errors and version headers                                                          | Real, small, correct. No rate limiting, no middleware, no auth tier                                                 |
| Database  | 36 migrations; FKs to `source_artifact` and `dataset_version` on every data table; CHECKs encode the invariants                                                                          | The strongest part of the system                                                                                    |
| Ingestion | TypeScript collectors per source; `fetch-with-limits`, `robots.txt` honoured, `raw-store` by sha256, `ingestion_run`, advisory lock                                                      | Solid for batch. Only GePNIC is scheduled                                                                           |
| Workers   | None as such: CLIs, plus one scheduled GitHub Action                                                                                                                                     | Adequate at current volume (§16)                                                                                    |
| Storage   | Raw bytes on disk under `storage_path`; no object store referenced                                                                                                                       | **Risk**: where do production raw artefacts live? (§11.7)                                                           |
| Search    | `ILIKE` over `admin_unit.name_en` and `document.title`; a GIN FTS index on `document_page` exists and **no query uses it**                                                               | Inadequate (§15)                                                                                                    |
| GIS       | PostGIS, GiST on boundaries, server-side simplification per level (ADR-064/065), hosted base map (ADR-066)                                                                               | Good for polygons. No point geometry anywhere                                                                       |
| Infra     | Vercel + Neon (512 MB branch limit) + GitHub Actions                                                                                                                                     | Right-sized                                                                                                         |

---

## 3. Current data model [code]

```text
source_artifact (sha256 PK, url, retrieved_at, status, storage_path)
      ▲ every table below FKs here, and to dataset_version
      │
admin_unit ──parent──▶ admin_unit           admin_unit_closure (ancestor, descendant, depth)
  lgd_code, level, name_en, name_local,     admin_unit_boundary (1:1, geometry, source_kind)
  osm_relation_id, valid_from/valid_to      geography_coverage (state × level → complete/partial/not_collected)
      ▲                ▲                ▲
      │                │                │
department ──▶ budget_scheme ──▶ scheme_finance (FY, BE/RE/release/actual…)   ← BEAMS
      └──────▶ department_finance
      │
document (doc_type, title, issuing_authority, published_on, admin_unit_id?) ← CAG
  ├─ document_page (page_number, content, script)            GIN FTS (english)
  ├─ document_text_item (page geometry per text run)
  └─ document_fact (kind, raw_text, normalised_value, method, parser_version,
                    confidence, verification_status, verified_by/at, corrected_value,
                    same_figure_as, validation verdict, region)
        └─ document_fact_review_history
        view: published_fact  (only verified/corrected rows)

tender (portal_code, portal_tender_id UNIQUE, reference, title, closing/opening,
        department TEXT, organisation_chain, location, pincode, categories,
        tender_value_paise, emd_paise, admin_unit_id?, linkage_confidence,
        district_source, district_evidence…, first/last_seen_at)
  ├─ tender_version (prior states)
  ├─ tender_district_decision (reviewer placements)
  └─ tender_collection_window (collecting_since per portal)
pincode_office · ingestion_run
```

**What is not in the schema:** project, work, contract, contractor, payment, expenditure-per-work, scheme as a cross-source entity, audit observation as a structured entity, government response, timeline event, any user or saved-state table, any entity-to-entity link table, any point geometry.

---

## 4. Intended product model — what should be canonical, and what should not

The target list in the brief has about 35 nouns. Treating each one as a table would create a schema that is mostly empty and would invite UI that implies knowledge the ledger does not hold. That is the failure `0012_tender.sql` names: _"a nullable column would invite a screen to imply we might know."_ The recommended classification:

| Class                                    | Members                                                                                   | Why                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Canonical reference entities** (exist) | Admin unit (country → ward, one table), Source artifact, Dataset version                  | Already right. Divisions should be added as a _grouping_ over districts, not a level, because LGD does not make them a tier of the hierarchy |
| **Canonical entities, to add**           | `entity` (kind ∈ scheme, department, work, organisation) + `entity_alias` + `entity_link` | One generic table with typed kinds. Needed because every cross-source join is a _claim with evidence_, not a foreign key                     |
| **Source records** (exist or add)        | Tender, Document, Budget line (`scheme_finance`), Audit report                            | Each keeps its source's own grain and identity. Never merged into a canonical row; _linked_ to one                                           |
| **Extracted claims**                     | `document_fact` (exists), later award facts, sanction facts                               | Candidates → reviewed → published. Already the right shape                                                                                   |
| **Events**                               | Timeline event = a dated fact with an event type, _derived by query_ from source records  | No `timeline_event` table until at least two sources provide dated events for the same entity                                                |
| **Derived views**                        | Variance, concentration, counts per unit, coverage                                        | Materialised views keyed by `dataset_version`; never stored as facts                                                                         |
| **User state**                           | Watchlist, saved view                                                                     | Separate schema and separate database role; never joined into ledger reads                                                                   |
| **Not modelled**                         | Contractor "network" of directors and parent companies                                    | See §5.2 and Feature 10                                                                                                                      |

---

## 5. The 32-feature audit

### 5.1 Status matrix

Legend: ✔ works · ◐ partial · ✖ absent · ⊘ blocked by data or licence · — not applicable. "Evidence" means page-level provenance reaches the reader.

| #   | Feature                  | FE          | BE       | DB  | Data (prod) | Pipeline | Evidence | Status                 | Root blocker       |
| --- | ------------------------ | ----------- | -------- | --- | ----------- | -------- | -------- | ---------------------- | ------------------ |
| 1   | National overview        | ◐           | ◐        | ◐   | ◐           | ◐        | ◐        | PARTIALLY_IMPLEMENTED  | B1, B3, B4         |
| 2   | State explorer           | ◐           | ✔        | ✔   | ◐           | ✔        | ✔        | PARTIALLY_IMPLEMENTED  | B8                 |
| 3   | Department explorer      | ◐           | ✔        | ◐   | ✖           | ✔        | ✔        | BLOCKED                | B5, B1             |
| 4   | Interactive map          | ✔           | ✔        | ◐   | ◐           | ✔        | ◐        | PARTIALLY_IMPLEMENTED  | B4 (no points), B8 |
| 5   | Project explorer         | ✖ (fixture) | ✖        | ✖   | ⊘           | ✖        | —        | DATA_BLOCKED           | B4, B6             |
| 6   | Project timeline         | ✖           | ✖        | ✖   | ⊘           | ✖        | —        | DATA_BLOCKED           | B4                 |
| 7   | Follow the money         | ◐ (fixture) | ✖        | ◐   | ⊘           | ◐        | —        | DATA_BLOCKED           | B4, B5             |
| 8   | Tender explorer          | ◐           | ✔        | ✔   | ◐ (no MH)   | ✔        | ◐        | PARTIALLY_IMPLEMENTED  | B2, B5             |
| 9   | Contractor explorer      | ✖           | ✖        | ✖   | ⊘           | ✖        | —        | DATA_BLOCKED           | B3, B10            |
| 10  | Contractor network       | ✖           | ✖        | ✖   | ⊘           | ✖        | —        | NOT_FEASIBLE_YET       | B3 + legal §5.2    |
| 11  | Scheme explorer          | ✖           | ✖        | ◐   | ✖           | ◐        | —        | BLOCKED                | B5, B6             |
| 12  | Budget explorer          | ◐           | ◐        | ✔   | ✖           | ✔        | ✔        | BLOCKED                | B5, B1             |
| 13  | Document explorer        | ✔           | ✔        | ✔   | ✖           | ✔        | ✔        | BROKEN (in production) | B1                 |
| 14  | Evidence view            | ✔           | ✔        | ✔   | ✖           | ✔        | ✔        | BROKEN (in production) | B1                 |
| 15  | Global search            | ◐           | ◐        | ◐   | ◐           | —        | ◐        | PARTIALLY_IMPLEMENTED  | B7                 |
| 16  | Advanced filters         | ◐           | ◐        | ◐   | ◐           | —        | —        | PARTIALLY_IMPLEMENTED  | B7, B9             |
| 17  | Compare                  | ✖           | ✖        | ◐   | ◐           | —        | —        | MISSING                | B1, B5             |
| 18  | Spending analytics       | ✖           | ✖        | ◐   | ✖           | ◐        | —        | BLOCKED                | B5                 |
| 19  | Project status           | ✖           | ✖        | ✖   | ⊘           | ✖        | —        | DATA_BLOCKED           | B4                 |
| 20  | Delay analysis           | ✖           | ✖        | ✖   | ⊘           | ✖        | —        | DATA_BLOCKED           | B4                 |
| 21  | Cost analysis            | ✖           | ✖        | ✖   | ⊘           | ✖        | —        | DATA_BLOCKED           | B3, B4             |
| 22  | Contractor concentration | ✖           | ✖        | ✖   | ⊘           | ✖        | —        | DATA_BLOCKED           | B3                 |
| 23  | Alerts / watchlists      | ✖           | ✖        | ✖   | —           | ◐        | —        | MISSING                | B9 (no user tier)  |
| 24  | Saved work               | ✖           | ✖        | ✖   | —           | —        | —        | MISSING                | B9                 |
| 25  | Guided "trace a record"  | ✖           | ✖        | —   | ◐           | —        | —        | MISSING                | B1, B7             |
| 26  | Export                   | ✖           | ◐ (JSON) | ✔   | ◐           | —        | ◐        | PARTIALLY_IMPLEMENTED  | B9                 |
| 27  | API / open data          | —           | ◐        | ✔   | ◐           | —        | ✔        | PARTIALLY_IMPLEMENTED  | B9                 |
| 28  | AI assistant             | ✖           | ✖        | —   | ✖           | ✖        | —        | ARCHITECTURE_BLOCKED   | B1, B7, B6         |
| 29  | NL investigation         | ✖           | ✖        | —   | ✖           | ✖        | —        | ARCHITECTURE_BLOCKED   | B7, B6, B4         |
| 30  | Anomaly signals          | ✖           | ✖        | ◐   | ✖           | ◐        | —        | BLOCKED                | B4, B5             |
| 31  | Audit explorer           | ◐           | ✔        | ◐   | ✖           | ✔        | ✔        | BROKEN (in production) | B1, B6             |
| 32  | "What happened?"         | ✖           | ✖        | ✖   | ⊘           | ✖        | —        | DATA_BLOCKED           | B4                 |

**Tally.** Implemented end to end in production: **0**. Partially implemented: 8. Built but broken in production: 3 (13, 14, 31, all because of B1). Data-blocked: 9. Blocked by another capability: 5. Missing: 4. Architecture-blocked: 2. Not feasible yet: 1.

### 5.2 Where the brief conflicts with the binding legal rules

These are not preferences. `.docs/decisions/web-first-pivot.md` §"stay rejected, permanently" and `.docs/17-legal/legal-ethical-rules.md` withhold them, and this audit recommends building only the permitted form.

| Brief asks for                                              | Rule                                                                               | Permitted form                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| F22 "Top contractors" ordered by awarded value              | No rankings of people or firms                                                     | HHI and top-k _share_ for a **scope** (district × FY × department), with no ordered list of named firms (screen-inventory S-44)    |
| F10 Directors, parent companies, joint ventures             | Rule 1 (never characterise individuals); rule 4 (facts from official sources only) | Only relationships an official document states, as cited facts. No inferred graph. Directors are private individuals: not modelled |
| F30 labels such as "repeated revisions", surfaced as a list | No global anomaly feed; observations scoped to an entity the reader navigated to   | Templated `ServerText` observations on the entity's own page, with evidence links and the disclaimer                               |
| F23 alerts on "signals"                                     | No anomaly push notifications                                                      | Alerts on **figures and documents** only: new tender, new document, figure superseded                                              |
| F25 / Journey E "Investigator", "Start investigation"       | Positioning: "It does not investigate, accuse, or make legal findings"             | The same guided flow named "Trace a record"; the product vocabulary changes, the workflow does not                                 |
| F26 chart export                                            | Chart-to-PNG export forbidden                                                      | CSV/JSON with provenance columns; a share link that carries the source                                                             |
| F28 free chat                                               | Free-floating AI chat forbidden                                                    | Scope-bound "ask about this unit" with citation enforcement (`.docs/09-ai/ai-layer.md`)                                            |
| F32 generated prose                                         | Neutral copy cannot be authored ad hoc                                             | Template-generated from typed facts on the server; an LLM may not author it                                                        |

### 5.3 Feature by feature

Each entry: what exists → what is missing → the dependency chain → the next step.

**F1 · National overview — PARTIAL.** The home page (`app/page.tsx`) is an intro paragraph with two links, one of them to the fixture project. `/explore` is the de-facto national view: states → districts, with open-tender counts shaded per district. _Trustworthy metrics available now:_ open tenders held, per state and district, with `collecting_since` (a floor, not a total); districts and states held. _Not available:_ total projects, active or completed projects, contractors, spending (B3, B4, B5). Chain: `overview → counts per entity → canonical entities → sources`. **Next:** a home-page strip built only from what is held, with each count carrying its collection window. Never "Total Projects".

**F2 · State explorer — PARTIAL.** `/units`, `/units/[id]` and the map drill states → districts → sub-districts. In production that stops at district (B8), because only 36 + 787 units are loaded. Local holds 355 sub-districts, 40 villages and 18 ULBs, and `geography_coverage` records that ULBs are partial. The Unit page renders name, LGD code, children and a provenance note. It does **not** render the six sections (money in / out / built / consistency / sub-units / coverage) that the architecture makes central. Divisions are not modelled. **Next:** load sub-district geography to prod (B8). Add the coverage and documents sections to the Unit page.

**F3 · Department explorer — BLOCKED.** `/units/[id]/departments/[code]` and `department-finance.repository.ts` exist. BEAMS departments are identified by a single-letter code with `name_en` null by design, and display is withheld (`PUBLISH_BEAMS_FIGURES`). Production holds 0 departments. Separately, `tender.department` is free text from the portal's organisation chain and is **not linked** to the `department` table. There are two notions of "department" with no join. **Next:** after B5, a department entity with aliases that both BEAMS codes and portal chain segments resolve to (§16).

**F4 · Interactive map — PARTIAL.** The strongest UI in the repository: MapLibre, level-aware boundary simplification, a hosted base map, label de-duplication, a URL that carries state (ADR-061), versioned payloads (ADR-053), and a measured JS budget (CI gate G7). _Missing:_ point geometry of any kind (no project has coordinates, because there are no projects), and ULB and taluka polygons in prod. A tender is placed by **issuing office**, which is not where the work is (see the comment in migration 0013), so tender _markers_ would be dishonest. District shading is the correct representation. Clustering and marker scalability are moot until a point source exists. Historical boundaries: `admin_unit_boundary` is keyed 1:1 on `admin_unit_id`, so there is one geometry per unit (§11).

**F5 · Project explorer — DATA_BLOCKED.** `/project/[id]` renders `FIXTURE_PROJECT_501` for any id, with a warning banner. `services/api` has an `InMemoryProjectRepository` with one row. There is no `project` table. Chain: `project page → canonical project identity → a source that names works with stable IDs → PWD works register (not public, Sprint 0 Q1) | OMMAS (licence-forbidden) | GRs / sanctions (not collected)`. Can a project be uniquely identified across sources today? **No source that is held names a project.** The `work_reference` fact kind exists in the enum and has zero rows locally. **Next:** do not build a `project` table. Collect Government Resolutions and administrative approvals as documents, and let a _work_ entity be born from a cited document (§10.B).

**F6 · Timeline — DATA_BLOCKED.** No event model. The dates actually held: the tender's `closing_at` and `bid_opening_at`; `first_seen_at`/`last_seen_at` (observation, not publication, and the schema says so); and `document.published_on`, which is **null for all 30 CAG documents** [local]. AA, TS, award, work start, payment and completion dates have no source. **Next:** record `published_on` for CAG reports (it is printed on the cover). That is the first dated event.

**F7 · Follow the money — DATA_BLOCKED.** `<MoneyTrail>` renders the fixture's Allocated → Released → Utilized chain. The `scheme_finance_variance` view computes both variances per scheme × FY from BEAMS [code], but BEAMS is withheld and absent from prod. Every link below scheme level is missing: sanction, tender↔work (Join 1), award, expenditure per work (Join 2). `.docs/04-data-engineering/entity-linking.md` names both joins as unverified. **What is reachable:** scheme-level budget → release → expenditure for Maharashtra, if B5 resolves. That is a real "follow the money" at the scheme grain, and it should be framed as such rather than as a project trail.

**F8 · Tender explorer — PARTIAL.** 1,318 tenders from 21 GePNIC states, collected nightly, with version history, placement evidence and reviewer decisions [prod]. Filters by district, department, unplaced and state (`/api/v1/tenders`). Details are withheld: the API returns `heldCount` and a portal link. _Missing:_ Maharashtra (0 rows; `Disallow: /`), award value, award date, contractor, and any status beyond "open" (landing pages list open tenders only, so the ledger cannot observe an award or a cancellation). No value or date filters. Chain for MH: `MH tenders → mahatenders access (B2) → request drafted (permission-requests.json: draft_ready)`.

**F9 · Contractor explorer — DATA_BLOCKED.** No contractor entity. The only contractor signal is `document_fact.kind = 'contractor_reference'` from CAG prose: **0 verified, 257 rejected, 50 unverified** [local]. Every row a person has decided was rejected, so the extractor's precision is currently 0. Chain: `contractor profile → awards → award-of-contract pages (CAPTCHA-gated, B3) → or → contractor names in CAG text (extractor unusable, B10)`. **Next:** nothing until B3 moves. Do not build contractor normalisation against an empty input.

**F10 · Contractor network — NOT_FEASIBLE_YET.** Needs B3, and then a company-registry source that is out of scope and raises §5.2 concerns. The schema could support stated relationships later through `entity_link` (§16). No graph database is warranted.

**F11 · Scheme explorer — BLOCKED.** `budget_scheme` exists (524 rows locally) as a BEAMS chart-of-accounts coordinate (demand, scheme code). That is a _budget head_, not a _programme_ like PMGSY. There is no programme entity and no link from a tender or a CAG report to a scheme. **Next:** a scheme entity with aliases; link budget heads to it by a hand-curated, cited mapping.

**F12 · Budget explorer — BLOCKED.** Schema, loader, variance view, department page and the `PUBLISH_BEAMS_FIGURES` switch all exist. Local holds 33 departments, 524 schemes, 9,369 scheme-finance rows and 261 department-finance rows. Prod holds 0. Blocked by B5, then by B1-style loading. Reconciling budget heads with project-level data is not possible (Join 2).

**F13 · Document explorer — BROKEN in production.** `/documents`, `/documents/[id]` and `/api/v1/documents` work against the local corpus (30 CAG reports, 6,339 pages). Prod has 0 documents, so the page is empty. Only one `doc_type` has ever been collected (`audit_report`). GR, tender-notice, award, work-order and completion types exist in the enum with no collector. `published_on` is null on every document. `document.admin_unit_id` holds a single unit, although a CAG report covers a state and names many districts.

**F14 · Evidence view — BROKEN in production.** The best-engineered capability: page number, raw sentence, normalised value, extraction method, parser version, confidence, reviewer, review history, same-figure linkage, validation verdict, and the page rectangle (`document_text_item`, ADR-036). `<Figure>` cannot compile without provenance. It shows nothing in production because of B1. Tender evidence is weaker: `source_sha256` points at the landing or detail page, but there is no field-level locator.

**F15 · Global search — PARTIAL.** `/api/v1/search` runs `ILIKE '%term%'` over place names and document titles and returns 12 results. It runs a recursive CTE per matched row to find the state, although the closure table would do this in one join (`geography.repository.ts:418`). It does not search tenders, page text or facts. The GIN FTS index on `document_page` uses the `english` configuration, which does not tokenise Devanagari meaningfully, and no query uses it. There is no trigram index, so every search is a sequential scan. That is tolerable at 823 units, not at roughly 650,000 villages.

**F16 · Advanced filters — PARTIAL.** Tenders filter by one district, one department, unplaced, or state. There are no value, date, category or multi-select filters. Lists are capped by `LIMIT`, and there is no cursor pagination anywhere.

**F17 · Compare — MISSING.** Nothing held in production supports a like-for-like comparison. With B1 resolved, comparing CAG figures across reports is not meaningful. With B5 resolved, district × FY scheme comparisons become possible. Peer medians are specified in `07-analytics` and not implemented (`services/analytics` is empty).

**F18 · Spending analytics — BLOCKED** on B5. There are no materialised views; `scheme_finance_variance` is a plain view.

**F19 · Project status — DATA_BLOCKED.** No status source. Correctly, nothing is derived: the only status held is "open tender" (closing in the future: 1,179 of 1,318 [prod]).

**F20 · Delay analysis — DATA_BLOCKED.** Needs original, revised and actual completion dates. None is held for any work.

**F21 · Cost analysis — DATA_BLOCKED.** The tender estimate is held (`tender_value_paise` on 1,028 of 1,318, 78%) and withheld from display. Award, revised and actual values: none.

**F22 · Contractor concentration — DATA_BLOCKED** on B3, and legally constrained (§5.2).

**F23 · Watchlists — MISSING.** No user tier, no auth, no storage for user state. The event detection it would need partly exists: `tender_version` and the `ingestion_run` counts record inserts and updates per run. There is no outbound channel.

**F24 · Saved work — MISSING.** Recommendation: shareable URLs first (ADR-061 already makes links carry state). Accounts later, if ever.

**F25 · Guided trace — MISSING.** Depends on B1 and B7. It is a UX flow over existing pages, not new infrastructure.

**F26 · Export — PARTIAL.** Every `/api/v1` route returns JSON with `datasetVersion` and licence terms (ADR-055). No CSV, no bulk download.

**F27 · API — PARTIAL.** Versioned path, JSON, dataset version and terms in every payload, read-only DB role. _Missing:_ rate limiting (there is no middleware; the P0 "CGNAT-safe rate tier" in `11-api/client-api-contract.md` §7 is unmet), cursor pagination, an OpenAPI document, and a decision about `services/api`.

**F28 · AI assistant — ARCHITECTURE_BLOCKED.** `services/ai` is empty, which is correct. The preconditions are not met: nothing is published in production to ground answers in, search cannot retrieve facts, and there is no entity layer to resolve "Nagpur road projects" against.

**F29 · NL investigation — ARCHITECTURE_BLOCKED.** Same, and the brief's example questions ("which contractors received the most…", "which projects are delayed") are unanswerable from any held data. The first is also a ranking (§5.2).

**F30 · Anomaly signals — BLOCKED.** The analytical inputs (variance per stage, revisions over time, peer baselines) exist only for BEAMS scheme lines, which are withheld. The CAG validation verdicts (migration 0019) are consistency checks on _our extraction_, not signals about the government, and must stay that way. `services/risk-engine` is empty.

**F31 · Audit explorer — BROKEN in production.** A CAG report → page → fact, with evidence, works locally. _Missing:_ the observation as a unit (a CAG paragraph with its heading), the government's response, and links from an observation to a place, scheme or work. `document.admin_unit_id` allows one unit per report, and ADR-051 already records that the issuing office is not the audited area.

**F32 · "What happened?" — DATA_BLOCKED.** Needs a dated event chain for one entity from at least two sources. None exists.

---

## 6. User-journey audit

| Journey                        | Reaches                                                         | Stops at                                                                       | Stops because                         |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------- |
| A · Citizen (MH district)      | Open → Maharashtra → district on the map                        | "View projects": the district shows 0 tenders (MH not collected), no documents | B2, B1, B4                            |
| B · Journalist                 | Search a contractor name                                        | Search does not index contractors; no contractor entity exists                 | B3, B7, B10                           |
| C · Researcher                 | Department → period → geography                                 | No budget in prod, no bulk CSV, no time filter                                 | B5, B1, B9                            |
| D · Developer                  | Discovers `/api/v1/*` by reading the source                     | No documentation, no key, no rate contract                                     | B9                                    |
| E · "Trace a record" (renamed) | Could trace a CAG figure to its page and rectangle, **locally** | Nothing to trace in production                                                 | B1; then B4 for anything beyond audit |
| F · AI                         | —                                                               | Step one                                                                       | Deliberately not started              |

**The journey that is fully achievable after B1 and B7 alone:** _"Find what the CAG reported about roads in my state, and see the exact page and line."_ That is the product `what-the-ledger-is-today.md` describes, and it is not yet live.

---

## 7. Feature dependency graph (derived from the repository)

```text
                 ┌──────────── EXTERNAL: access & licence ─────────────┐
                 │ mahatenders robots (B2) · GePNIC award CAPTCHA (B3) │
                 │ PWD works register absent / OMMAS licence (B4)      │
                 │ BEAMS + tender-detail permission (B5)               │
                 └───┬───────────────┬───────────────┬───────────────┬─┘
                     │               │               │               │
 ┌─ BUILT ───────────▼───────────────▼───────────────▼───────────────▼─┐
 │ source_artifact · dataset_version · ingestion_run · review queue    │
 │ admin_unit (+closure, boundary, coverage)  ← LGD + OSM              │
 └───┬───────────────────────┬──────────────────────────┬──────────────┘
     │                       │                          │
 CAG documents ─(B1)─┐   tenders (21 states)       BEAMS (local) ─(B5,B1)─┐
     │               │       │                          │                 │
     ▼               ▼       ▼                          ▼                 │
 facts+evidence   Documents  Map shading / counts    Budget, Dept pages   │
     │           Audit expl.    │                       │                 │
     └──────┬────────┴──────────┴───────────┬───────────┘                 │
            ▼                               ▼                             │
      SEARCH INDEX (B7) ──────────▶  API hardening (B9) ──▶ Export, Dev   │
            │                                                             │
            ▼                                                             │
   ENTITY + ALIAS + LINK (B6) ◀── GRs / sanctions (not collected) ◀───────┘
            │            ▲
            │            └── awards (B3) → contractor entity → scope concentration
            ▼
   work entity (from documents) → timeline → cost/delay → "What happened?"
            │
            ▼
   scope-bound AI (F28/F29)   — last, and only over published, cited facts
```

---

## 8. Blocker matrix

| Blocker                                  | Blocks (features)                  | Severity                       | Root cause                                                                     | Resolution                                                                                                                         |
| ---------------------------------------- | ---------------------------------- | ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| B1 CAG corpus absent from prod           | 13, 14, 31, 15 (records), 25, A, E | **P0**                         | Loaders are local CLIs; no production runbook step loads documents or facts    | Add a runbook to `16-operations/`; run the CAG load, facts load and review decisions against prod with the ETL role; verify counts |
| B2 No Maharashtra tenders                | 8 (MH), every PWD view             | **P0** for Phase 1 as scoped   | `mahatenders.gov.in` `Disallow: /` (evidence file in `06-government-sources/`) | Send `mahatenders-access-request-draft.md`. Until then, re-scope Phase 1 (§9)                                                      |
| B3 Award data CAPTCHA-gated              | 9, 10, 21, 22, 7 (award link)      | **P0** for contractor features | Platform design; `gepnic-access-findings.md`                                   | Request structured access; examine CPPP's published awards; accept the absence until then. Never bypass a CAPTCHA                  |
| B4 No project/work source                | 5, 6, 7, 19, 20, 21, 32            | **P0** for project features    | PWD publishes no register (Sprint 0 Q1); OMMAS licence                         | Send the NRIDA request; collect GRs/AAs as documents; build work entities from documents (§10.B)                                   |
| B5 Permission not sought                 | 3, 8 (detail), 12, 17, 18, 30      | **P1**                         | Deliberate (25 Sep decision): drafts ready, none sent                          | Send the drafted requests; `permission-requests.json` tracks status                                                                |
| B6 No entity/link layer                  | 3, 5, 9, 11, 31 (links), 28, 29    | **P1**                         | Nothing yet to link                                                            | `entity`, `entity_alias`, `entity_link` with evidence and confidence (§16), fed first by CAG                                       |
| B7 Search inadequate                     | 15, 16, 25, 28, 29, B, C           | **P1**                         | Written for places first; tenders and facts added later                        | One `search_doc` materialised view + `pg_trgm` + `simple`-config FTS (§16)                                                         |
| B8 Sub-district geography absent in prod | 2, 4                               | **P1**                         | Loaded locally only                                                            | Load LGD sub-districts and ULBs to prod; `geography_coverage` already records partiality                                           |
| B9 API unhardened                        | 27, 26, D; production safety       | **P1**                         | No middleware; lists capped, not paged                                         | Edge rate tier keyed on more than the IP; cursor pagination; OpenAPI from the Zod contracts                                        |
| B10 Contractor extraction unusable       | 9 (from audit text)                | **P2**                         | Pattern extraction over prose; every reviewed row rejected                     | Stop surfacing this kind to reviewers until it is redesigned; contractors come from awards, not prose                              |
| B11 `published_on` never populated       | 6, 13 (sorting), 31, freshness     | **P2**                         | The CAG loader does not read the cover date                                    | Extract it from the cover page with review, like any fact                                                                          |
| B12 Pages are `force-dynamic`, not ISR   | Performance at scale, SEO cost     | **P2**                         | ISR-by-tag not yet wired                                                       | `revalidateTag(datasetVersion)` when a load completes                                                                              |
| B13 Two API codebases                    | 27, maintainability                | **P2**                         | `services/api` scaffolded before the web routes proved sufficient              | Decide in an ADR: retire `services/api`, or move the routes into it                                                                |

---

## 9. Critical path to a functional Phase 1

**Phase 1 as written ("Maharashtra → PWD → district → project → tender → contractor") is not reachable** on current evidence. Four of its links (MH tenders, project, contract, contractor) are blocked by B2–B4, and none of those can be resolved by engineering.

**The shortest path to a functional, lawful Phase 1** re-scopes to what the data permits:

> **Phase 1′ — "Roads and public works, as the official record shows them":** the LGD hierarchy to taluka and ULB; every CAG report on roads and public works, cited to the page; open tenders in the 21 collectable states, by district; searchable; exportable with provenance; with Maharashtra's budget lines added the day permission arrives.

Critical path: **B1 → B8 → B7 → B9, with the permission letters sent on day one in parallel.** Each of the first four is small (§17). The letters cost nothing, and their answers gate everything after.

---

## 10. Data blockers and the special focus areas

### Data blockers (Rule 3: these are not engineering failures)

| Needed for                     | Required data                           | Status                                                                                   |
| ------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| MH tenders                     | mahatenders listing and detail          | **Inaccessible**: `robots.txt` `Disallow: /`; access request drafted, not sent           |
| Contracts, contractors, awards | Award-of-contract records               | **Inaccessible**: CAPTCHA on every GePNIC deployment tested and on CPPP                  |
| Projects / works (PWD)         | A works register                        | **Not identified** on PWD's public site as of 25 Aug 2026 (not a claim that none exists) |
| Projects / works (rural roads) | OMMAS work register                     | **Available, licence-forbidden** without NRIDA's written permission                      |
| Expenditure per work           | Treasury data attributable to a work ID | **DATA AVAILABILITY NOT VERIFIED**; BEAMS is at head × DDO grain                         |
| Budget display                 | BEAMS                                   | **Available, withheld** pending permission                                               |
| Physical progress, completion  | Any source                              | **DATA NOT AVAILABLE** from the sources reviewed                                         |
| Coordinates of works           | Any source                              | **DATA NOT AVAILABLE**; tender `location` is free text, often an office                  |

### A. Geographic identity — the one solved problem

The LGD code is the key, with `UNIQUE (lgd_code, level)`, `osm_relation_id` for geometry, and a closure table for "everything under". Name variation is handled by ADR-032 ("a name sits inside its place") and by state-scoped matching, which removed 18 cross-state district collisions (Pune/Panna). "Nagpur district" and "Nagpur Municipal Corporation" are different units at different levels, correctly. **Two gaps:**

1. `UNIQUE (lgd_code, level)` plus `valid_from`/`valid_to` cannot hold two versions of the same unit. A boundary or name change would overwrite rather than version, against rule 9 ("preserve historical versions"). The fix is a partial unique index `WHERE valid_to IS NULL`.
2. Divisions are not modelled. Add them as a named grouping, since they are not an LGD tier.

### B. Project identity — no source; design for documents first

No held source names a work, so no project ID can be generated. When one arrives, it will be one of: an OMMAS package ID, a GR/AA number, a tender reference (proven non-unique: `1657/2026/E1` appeared on six tenders), or a CAG paragraph that names a work. The recommendation is to **never mint a project from a single source's key**:

- Mint a `work` entity (§16) whose identity is LokDarpan's own.
- Each source key becomes an `entity_alias(source_id, source_key)`.
- Each link between a work and a tender, GR or audit paragraph is an `entity_link` row carrying evidence (`source_sha256`, page), `linkage_confidence`, method and reviewer.

This is the pattern tenders already use for districts (ADR-067/068), generalised.

### C. Contractor identity — no input; design now, build later

When award data exists, canonicalise in three tiers:

1. Exact registration identifiers where published (GSTIN, CIN, portal bidder ID): high confidence.
2. Normalised name (legal-suffix folding such as "Pvt Ltd" / "Private Limited", punctuation, "Infra" / "Infrastructure"), scoped to one state: medium confidence, reviewer-confirmed.
3. Cross-state name match: never automatic (`entity-linking.md` §5).

Every alias is displayed on the profile (S-42), so the canonicalisation itself is auditable.

### D. Document provenance — excellent, and invisible in production

Every field the brief lists is stored: source URL, artefact hash (a stronger version identity than a version number), retrieval timestamp, page, raw text, rectangle, extraction method, parser version, confidence, reviewer, correction and history. Missing: publication date (B11) and field-level locators for tenders.

### E. Freshness — modelled better than most production systems

`ingestion_run` (per-run counts, including `unchanged`), `tender_collection_window.collecting_since`, `geography_coverage` and `dataset_version` together separate _collected_, _current_ and _complete_ (ADR-054). **Gap:** nothing alerts when a run fails or does not run. There are 125 runs, all `succeeded` [prod]. A collector that stops being scheduled leaves no row at all, and nothing notices.

### F. Cross-source relationships — none exist yet

Of the joins budget ↔ scheme ↔ project ↔ tender ↔ contractor ↔ payment ↔ audit, none is implemented. The only two sources that could be joined today (CAG ↔ BEAMS, through `same_figure_as` and the consistency checks) are joined at the _figure_ level for validation, not at the entity level for display.

---

## 11. Architecture blockers (decisions that constrain the future)

1. **`admin_unit` uniqueness prevents versioning** (§10.A). Cheap to fix now, expensive after other tables hold FKs to superseded units.
2. **`admin_unit_boundary` is 1:1 with the unit**, so historical boundaries need a new key. Add `(admin_unit_id, valid_from)` when the first boundary change is collected, not before.
3. **`document.admin_unit_id` is a single FK.** An audit report is about many places. Replace it with `entity_link` rows (document → unit, with evidence) before audit-to-place links are built on the column.
4. **`tender.department` is free text** with no link to `department`. Harmless now; it becomes two department hierarchies the day BEAMS is displayed.
5. **Search has no index strategy** (§15). Every feature that lists things will reimplement `ILIKE` unless one search view exists.
6. **Two API codebases** (B13).
7. **Raw-artefact storage is `storage_path` on a disk.** Loads are run from an operator's machine, so the bytes behind production rows may exist only on that machine. That would break the guarantee in migration 0006: _"re-extraction with a better parser must always be possible from what was actually retrieved."_ **Verify where the bytes are, and move them to object storage with the sha256 as the key.**

What is _not_ an architecture blocker, and should not be changed: REST over GraphQL, Postgres for everything, a CLI-plus-scheduler ingestion model, one `admin_unit` hierarchy, and candidate → review → `published_fact`.

---

## 12. Technical debt

| Debt                                                                    | Where                                                                 | Impact                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Status documents describe local data as if it were production           | `CLAUDE.md`, `what-the-ledger-is-today.md`                            | Planning on a false premise; this audit's first finding                        |
| Fixture project linked from the home page                               | `app/page.tsx`, `project/[id]/page.tsx`                               | The only "project" a visitor can find is fictional (it says so)                |
| `services/api` in-memory repository ("The database does not exist yet") | `services/api/src/modules/projects`                                   | A dead code path that looks alive                                              |
| Empty service skeletons                                                 | `services/{ai,analytics,entity-resolution,normalization,risk-engine}` | Implies capability; harmless but misleading                                    |
| Redis in `docker-compose.yml`, unused                                   | —                                                                     | Operational noise                                                              |
| `force-dynamic` on every page                                           | `app/*/page.tsx`                                                      | Every view is a DB round-trip; contradicts ADR-012                             |
| FTS index on the `english` config, unused                               | migration 0006                                                        | Index maintenance with no reader; wrong config for Devanagari                  |
| `lang="hi"` on every `name_local`                                       | `units/[id]/page.tsx`                                                 | Marathi (`mr`), Tamil, Bengali and others announced as Hindi to screen readers |
| Recursive CTE per search row despite a closure table                    | `geography.repository.ts:418`                                         | O(results × depth) work; the closure table exists for this                     |
| `contractor_reference` / `officer_role_reference` extraction still runs | CAG facts pipeline                                                    | 505 rows of reviewer time spent, 0 kept                                        |
| No failure alerting on ingestion                                        | nightly workflow                                                      | Silent staleness                                                               |

---

## 13. Data quality — what can actually be measured

All figures are from 29 September 2026. "Not measurable" means not measurable with the current implementation.

**Tenders [prod], n = 1,318**

| Measure                                         | Value                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| With detail page parsed                         | 1,229 · **93.2%**                                                      |
| With department                                 | 1,229 · 93.2%                                                          |
| With stated value                               | 1,028 · **78.0%**                                                      |
| Placed in a district                            | 791 · **60.0%** (the rest stay reachable as "unplaced")                |
| Placement accuracy                              | **Not measurable with current implementation**: no ground-truth sample |
| From Maharashtra                                | 0 (not collected)                                                      |
| Department text matching "Public Works" / "PWD" | 167 (other states)                                                     |
| Closing in the future                           | 1,179 · 89.5%                                                          |
| With a recorded prior version                   | 1                                                                      |
| Uniqueness                                      | Enforced: `UNIQUE (portal_code, portal_tender_id)`                     |
| Portals · runs · failed runs                    | 21 · 125 · 0 recorded                                                  |

**CAG documents and facts [local]: 30 reports, 6,339 pages**

| Measure                                 | Value                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Documents with a publication date       | **0 / 30**                                                                    |
| Documents attributed to a unit          | 30 / 30                                                                       |
| Monetary candidates decided by a person | 6,271 of 10,119 (62.0%)                                                       |
| — kept (verified 5,034 + corrected 59)  | 5,093 · **81.2%** of decided                                                  |
| — rejected                              | 1,178 · 18.8% of decided                                                      |
| — corrected, as a share of kept         | 59 · 1.2%                                                                     |
| Monetary candidates awaiting review     | 3,848 (the status page says 0; that was true of an earlier, 20-report corpus) |
| Linked as the same figure (bilingual)   | 600                                                                           |
| Contractor references kept              | **0** of 257 decided (50 undecided)                                           |
| Officer-role references kept            | **0** of 248 decided (38 undecided)                                           |

**Geography.** Prod: 823 units, all with boundaries (100%). Local: 1,236 units. ULB coverage is recorded as partial. Villages: 40 held locally, against roughly 650,000 nationally.

**Projects with coordinates, contractor, tender ID, source document or completion date; contractors normalised:** **DATA NOT AVAILABLE.** There are no projects or contractors to measure.

---

## 14. Security and reliability risks

| Risk                                                    | Severity   | Note                                                                                                              |
| ------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| No rate limiting on any `/api/v1` route                 | High       | `/api/v1/search` is an unindexed scan; a loop against it is a cheap denial of service on a 0.25–2 CU Neon compute |
| Neon credential rotation pending                        | High       | Recorded as deferred in the operator's session notes                                                              |
| Raw artefacts possibly held on an operator's disk       | High       | Losing the bytes breaks provenance for rows already published (§11.7)                                             |
| Silent ingestion failure                                | Medium     | No alert on a missing or failed run                                                                               |
| Neon branch size limit 512 MB; current storage ≈ 108 MB | Medium     | Loading 6,339 pages, text-item geometry and BEAMS may approach it; measure before B1                              |
| SSRF / fetch safety                                     | Low        | `net/fetch-with-limits.ts` bounds size and time; hosts come from registries, not user input                       |
| SQL injection                                           | Low        | Parameterised queries throughout the repositories read; state code validated by regex before it reaches a query   |
| XSS                                                     | Low        | React escaping in the pages read                                                                                  |
| Legal exposure (defamation)                             | Controlled | Neutrality gate, `ServerText`, no contractor surfaces, withheld details. These controls work                      |
| Publishing without permission                           | Controlled | Environment switches default off and open only on the exact string `"true"`                                       |

---

## 15. Performance risks

| Query                      | Today                                      | Breaks at                                                                                      | Fix                                                            |
| -------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Search                     | `ILIKE '%x%'`, seq scan, recursive CTE/row | Village load (~6.5 × 10⁵ units)                                                                | `pg_trgm` GIN on names; closure join; one search view          |
| Page full text             | Not queried                                | —                                                                                              | A `simple`-config tsvector column, actually used               |
| Tender lists               | `LIMIT n`, no cursor                       | A district with more than n open tenders truncates silently (the count is returned separately) | Keyset pagination on `(closing_at, id)`                        |
| Tender counts by district  | Aggregated per request                     | Low at 10³ rows                                                                                | A materialised view keyed by `dataset_version` beyond 10⁵ rows |
| Boundaries                 | Simplified per level at load (ADR-065)     | Fine                                                                                           | —                                                              |
| Every page `force-dynamic` | A DB round-trip per view                   | Traffic spikes                                                                                 | ISR tagged by `datasetVersion` (B12)                           |

---

## 16. Recommended target architecture

Keep the current architecture. Add four things, each justified.

```sql
-- One entity table for everything that is neither a place nor a source record.
entity        (id, kind  -- 'work' | 'scheme' | 'department' | 'organisation'
               , display_name, admin_unit_id NULL, created_from_sha256, dataset_version_id)
entity_alias  (entity_id, source_id, source_key, name_as_published, script,
               evidence_sha256, page, confidence, decided_by, decided_at)
entity_link   (subject_kind, subject_id, predicate, object_kind, object_id,
               evidence_sha256, page, method, linkage_confidence,
               decided_by, decided_at, valid_from, valid_to)
search_doc    MATERIALIZED VIEW (kind, id, title, body_tsv simple, name_trgm, unit_path,
               dataset_version) + GIN(tsv) + GIN(trgm)
```

| Component                    | Problem solved                                                       | Why Postgres suffices                                                                     | When it stops sufficing                                          |
| ---------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `entity` + `entity_alias`    | Project, scheme, department and contractor identity across sources   | Typed rows plus aliases is the whole model; there are thousands of entities, not billions | Not foreseeable                                                  |
| `entity_link`                | Every cross-source join is a cited claim with a confidence, not a FK | Recursive CTEs cover the two or three hops a "network" needs here                         | Unbounded graph traversal, which §5.2 rules out anyway           |
| `search_doc`                 | One index for places, documents, pages, facts and tenders            | FTS plus trigram handle 10⁶–10⁷ rows on one node                                          | Cross-language relevance tuning at 10⁸; then consider OpenSearch |
| Object storage for raw bytes | Provenance survives the operator's laptop                            | —                                                                                         | —                                                                |

**Explicitly not recommended:**

- **Kafka:** one nightly job; there is no stream.
- **Elasticsearch:** Postgres FTS is unused, not outgrown.
- **Neo4j:** no edges exist yet, and the ones that will are few and cited.
- **Kubernetes:** Vercel plus Actions fit the load.
- **Vector search:** there is nothing to embed until B1, and citation enforcement needs exact retrieval, not semantic neighbours.
- **Redis:** already in compose and unused; `dataset_version` ISR tags make it unnecessary.

**A job queue becomes justified when OCR enters the ledger** (ADR-039): 2.3 s/page across thousands of pages does not fit in a request or a single Actions step. A Postgres-backed job table (`FOR UPDATE SKIP LOCKED`) is enough at that point.

---

## 17. Implementation roadmap

| Pri    | Item                                                                                             | Depends on                | Size | Unlocks                                       |
| ------ | ------------------------------------------------------------------------------------------------ | ------------------------- | ---- | --------------------------------------------- |
| **P0** | Correct `CLAUDE.md` and `what-the-ledger-is-today.md` to separate production from local holdings | —                         | XS   | Honest planning                               |
| **P0** | Verify where production raw artefacts live; move them to object storage                          | —                         | S    | The provenance guarantee                      |
| **P0** | B1: runbook, then load CAG documents, facts and review decisions to prod                         | storage check, size check | S    | F13, F14, F31, journeys A (audit) and E       |
| **P0** | Send the drafted permission requests                                                             | —                         | XS   | Starts the only clock that gates Phase 1      |
| **P0** | A rate tier on `/api/v1` (Vercel firewall or middleware) that tolerates CGNAT                    | —                         | S    | Safe to link publicly                         |
| **P1** | B8: load sub-districts and ULBs to prod                                                          | —                         | S    | F2, F4 below district                         |
| **P1** | B7: `search_doc` with trigram and `simple` FTS; search tenders, pages and facts                  | B1                        | M    | F15, F16, F25, journeys B and C               |
| **P1** | Cursor pagination; OpenAPI from `@lokdarpan/contracts`; CSV with provenance columns              | —                         | M    | F26, F27, journey D                           |
| **P1** | Unit page: coverage, documents and tenders sections                                              | B1, B8                    | M    | F2, F1                                        |
| **P1** | Ingestion failure alert (no run in 26 h, or a `failed` run)                                      | —                         | XS   | Freshness honesty                             |
| **P2** | `admin_unit` versioning index fix                                                                | —                         | XS   | Historical geography                          |
| **P2** | `published_on` for CAG reports; a Government Resolution collector (Maharashtra GR portal)        | —                         | M    | F6's first events; a source for work entities |
| **P2** | `entity` / `entity_alias` / `entity_link`; move `document.admin_unit_id` into links              | B1                        | M    | F11, F31 links, F5 (document-borne works)     |
| **P2** | ISR by `datasetVersion`; retire or adopt `services/api` (by ADR)                                 | —                         | S    | Performance; one API                          |
| **P2** | Stop extracting contractor and officer references from prose                                     | —                         | XS   | Reviewer time                                 |
| **P3** | Watchlists on figures and documents (email to a verified address; no account)                    | B9, B1                    | M    | F23                                           |
| **P3** | Scheme-level money trail from BEAMS                                                              | B5 "yes"                  | M    | F7 (scheme grain), F12, F18                   |
| **P3** | Maharashtra tenders; tender detail pages                                                         | B2 / B5 "yes"             | S    | F8 for Maharashtra                            |
| **P3** | PMGSY works as `work` entities; timeline; cost and delay; "What happened?"                       | B4 "yes"                  | L    | F5, F6, F19–F21, F32 for rural roads          |
| **P3** | Contractor entity, aliases, scope concentration                                                  | B3 resolved               | M    | F9, F22                                       |
| **P3** | Scope-bound, citation-enforced AI                                                                | B1, B7, B6                | L    | F28, F29                                      |

---

## 18. Definition of Done — Phase 1

| #   | A Phase 1 user can…                     | Achievable?                      | Why / why not                                                      |
| --- | --------------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| 1   | Open Maharashtra                        | **Yes, today**                   | LGD + OSM                                                          |
| 2   | Explore PWD                             | **No**                           | No PWD entity; MH tenders not collected (B2); BEAMS withheld (B5)  |
| 3   | Select a district                       | **Yes, today**                   |                                                                    |
| 4   | See available projects                  | **No**                           | No project source (B4)                                             |
| 5   | Open a project                          | **No**                           | Only the fixture                                                   |
| 6   | Understand its financial information    | **No**                           | B4; B5 at scheme grain only                                        |
| 7   | See the project timeline                | **No**                           | No dated events for any work                                       |
| 8   | See the tender                          | **No for MH**; a count elsewhere | B2; details withheld (B5)                                          |
| 9   | See the contractor                      | **No**                           | B3                                                                 |
| 10  | View related documents                  | **After B1**                     | CAG reports, not project documents                                 |
| 11  | Verify facts against source evidence    | **After B1**                     | Page and rectangle, already built                                  |
| 12  | Search projects / contractors / tenders | **Partly, after B7**             | Tenders and documents yes; projects and contractors do not exist   |
| 13  | Filter results                          | **Partly**                       | District, department and state now; value and date after B7/B9     |
| 14  | View projects on a map                  | **No**                           | No point geometry exists for any work                              |
| 15  | Understand freshness                    | **Yes, largely**                 | Collection windows, dataset version, run history; alerting missing |

**Proposed Definition of Done for Phase 1′** (§9): items 1, 3, 10, 11, 12 (tenders, documents, places), 13 and 15 true **in production**; every count on screen carrying its collection floor; and every permission request sent and recorded in `permission-requests.json` with its date and reference.

---

## Readiness by capability

A bar is one of five criteria met, shown as two blocks each: **(1)** schema exists · **(2)** a collector exists · **(3)** data is in production · **(4)** a reader-facing surface renders it · **(5)** it can be shown under its source's terms. There is no overall score.

```text
Data foundation (provenance, versions, runs)  ██████████  1 2 3 4 5
Geographic foundation                         ████████░░  1 2 3 5 · (4 partial: stops at district in prod)
Evidence / provenance (CAG)                   ██████░░░░  1 2 5 · not in prod (3), so not shown (4)
Tender intelligence                           ██████░░░░  1 2 3 · details withheld (5), counts only (4 partial)
Budget intelligence (BEAMS)                   ████░░░░░░  1 2 · local only (3), withheld (5)
Search                                        ████░░░░░░  places + titles only
Project intelligence                          ░░░░░░░░░░  no source
Contractor intelligence                       ░░░░░░░░░░  no source
Analytics                                     ██░░░░░░░░  one variance view (1), over withheld data
Investigation / saved work                    ░░░░░░░░░░
AI                                            ░░░░░░░░░░  correctly not started
```

---

## The final question

> _"If we wanted to make the Maharashtra PWD Road Intelligence experience fully functional today, what are the exact blockers, in what order should they be fixed, and which user-facing features become unlocked after each?"_

**It cannot be made fully functional today.** The deciding blockers are access and licence, and they sit with government bodies, not with the code. Below is the order that gets furthest, soonest, and what each step unlocks.

```text
BLOCKER 1 · Production holds none of the audit corpus              (ours · days)
        ↓ load CAG documents, facts, review decisions; raw bytes to object storage
unlocks:
- Document explorer (F13) and Evidence view (F14), live
- Audit explorer (F31) at report → page → figure
- Citizen journey: "what did the CAG find about roads in my state", to the line

BLOCKER 2 · Geography stops at district in production              (ours · days)
        ↓ load sub-districts and ULBs
unlocks:
- State explorer to taluka and local body (F2)
- Map drill-down below district (F4)

BLOCKER 3 · Nothing is findable except place names and titles     (ours · 1–2 weeks)
        ↓ search_doc view, trigram + FTS; tenders, pages and facts indexed
unlocks:
- Global search (F15), filtered lists (F16)
- Researcher and journalist entry points; the "trace a record" flow (F25)

BLOCKER 4 · The public API is unhardened                           (ours · 1–2 weeks)
        ↓ rate tier, cursor pagination, OpenAPI, CSV with provenance
unlocks:
- Open data API (F27), export (F26), developer journey

BLOCKER 5 · Permission never requested                             (ours to send · theirs to answer)
        ↓ send the mahatenders, tender-department, Finance Dept and NRIDA requests
unlocks, on each "yes":
- Finance Dept → budget explorer (F12), department pages (F3), scheme-grain
  follow-the-money (F7), spending analytics (F18), district comparisons (F17)
- mahatenders → Maharashtra tenders on the map and in search (F8), incl. PWD
- tender departments → tender detail pages (F8)
- NRIDA → rural-road works as entities: project pages (F5), timeline (F6),
  status (F19), delay (F20), cost (F21), "What happened?" (F32)

BLOCKER 6 · No entity layer to link sources                        (ours · 2–3 weeks, after 1)
        ↓ entity, entity_alias, entity_link; GR collector; published_on
unlocks:
- Audit ↔ place ↔ scheme links (F31, F11)
- Works named by a Government Resolution or audit paragraph, as cited entities
- The structure an AI layer needs to resolve "Nagpur road projects"

BLOCKER 7 · Award data is CAPTCHA-gated                            (theirs · unknown)
        ↓ structured access, or a published award source
unlocks:
- Contractor explorer (F9), scope concentration (F22), the award stage of cost (F21)

BLOCKER 8 · Scope-bound AI                                         (ours · after 1, 3, 6)
unlocks:
- "Ask about this unit" (F28, F29), answering only from published, cited facts
```

**State highways and MDR/ODR roads under PWD Maharashtra stay out of reach even if every letter is answered "yes"**, unless PWD's works data is obtained by request or RTI. `phase-1-maharashtra-roads.md` anticipated this: the NRIDA route covers rural roads (PMGSY), not the PWD network. If "Maharashtra PWD" is the non-negotiable scope, the first action is a formal request to PWD Maharashtra for its works register, drafted alongside the others.
