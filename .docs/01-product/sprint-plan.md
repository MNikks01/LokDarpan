# Sprint Plan — Build to Launch

**Status:** Accepted · 2026-08-25 · **Supersedes** [`roadmap-web.md`](./roadmap-web.md) as the active delivery plan

`roadmap-web.md` planned the _frontend_ on the assumption a backend existed. It does not. This plan is cross-functional — data, backend, frontend, DevOps, observability, security — and sequences them against the real critical path, which is **data, not UI**.

---

## How to read this

Ten sprints, **two weeks each** (Sprint 0 is one week), ~19 weeks to public launch.

Every sprint carries six tracks. Not every track is loaded every sprint, but each is explicitly considered so nothing is discovered late:

`DATA` ingestion & the ledger · `API` backend services · `WEB` the client · `OPS` infrastructure & delivery · `OBS` observability · `SEC` security

## Assumptions — state them, don't hide them

|                        |                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| **Team**               | 1 data/backend engineer, 1 full-stack, 1 frontend, part-time designer, part-time SRE/security review |
| **Cadence**            | Two-week sprints, demo at the end of each, retro every second                                        |
| **Definition of done** | See §Standing bar — applies to every ticket, every sprint                                            |
| **Buffer**             | ~20% of each sprint is unplanned work. A sprint planned to 100% is a sprint that slips               |

**If the team is smaller, the sprints get longer — they do not get fuller.** Halving the team roughly doubles the calendar. Say so up front rather than discovering it in Sprint 4.

---

## The gate that governs everything

`.docs/06-government-sources/SOURCE-DISCOVERY-REPORT.md` established that **per-project expenditure and physical progress have no verified source.** `.docs/07-analytics/analytics-engine.md`'s central calculation — `Released − Utilized`, per project — therefore has no confirmed input, and the Money Trail is the product's signature screen.

Three questions decide the scope of everything after Sprint 1:

- **Q1** — does Maharashtra PWD publish a public works register with per-work progress and expenditure?
- **Q2** — is PMGSY's OMMAS publicly accessible, and what does it expose?
- **Q3** — does Maharashtra's BEAMS expose allocation without authentication?

**Sprint 0 exists to answer them.** Building UI for a chain we cannot populate would be the most expensive mistake available.

### The two branches this plan takes

|                | **Branch A — the chain exists** (Q1 or Q2 positive)                               | **Branch B — it does not**                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product        | Full follow-the-money: allocation → release → expenditure → progress, per project | **Tender-and-budget intelligence**: complete procurement records, unit-level budget/allocation, contractor award histories, audit citations, coverage reporting |
| Money Trail    | Populated                                                                         | Renders `insufficient_data` honestly; unit-level finance still works                                                                                            |
| Sprints 3–4    | As written                                                                        | Re-weight toward procurement depth and unit-level finance                                                                                                       |
| Honest framing | "Follow public money to the asset"                                                | "Follow public money as far as government publishes it — and show exactly where it stops"                                                                       |

Branch B is **stronger than this plan first assumed**. Sprint 0 confirmed BEAMS exposes departmental, scheme-wise and DDO-wise actual expenditure publicly, monthly, for ten financial years. That is a genuine financial ledger with real analytical depth — not a consolation prize. It is a narrower true claim, not a failure mode. What would be a failure is shipping Branch A's promises on Branch B's data.

---

## Sprint 0 · De-risk _(1 week)_

**Goal:** answer Q1–Q3, decide the branch, and remove every blocker that would stall Sprint 1.

| Track  | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATA` | **BEAMS field-verified 26 Aug** — endpoints, 19-column shape and ten-year coverage recorded in [`beams-discovery.md`](../06-government-sources/beams-discovery.md); PWD is `dept=H`. **Q1 answered NO, Q3 answered YES (25 Aug — [findings](../06-government-sources/sprint0-findings-q1-q3.md)). Q2 outstanding**, needs an **Indian network vantage point** (the discovery pass could not reach several `.nic.in` hosts). Field-verify one GePNIC portal end to end: exactly which tender fields are public, CAPTCHA presence, archive depth, pagination                                                                                                                                                                                                                                                               |
| `DATA` | **Done 25 Aug:** `robots.txt` surveyed across all 36 State/UT portals — [`access-and-permissions.md`](../06-government-sources/access-and-permissions.md). **State-selection sweep done 25 Aug** — Phase 1 **stays Maharashtra**; award data is CAPTCHA-gated platform-wide, so changing state buys nothing ([`gepnic-access-findings.md`](../06-government-sources/gepnic-access-findings.md)). **`data.gov.in` API tested 25 Aug** — catalogue open without a key; no Maharashtra procurement dataset ([`datagovin-api-findings.md`](../06-government-sources/datagovin-api-findings.md)). Still needed: a `data.gov.in` API key (self-service) to inspect the Assam procurement series; plus terms of use, rate limits and **licence** for the P0 sources. Licence is required for display and was collected for none |
| `API`  | Decide the search backend (Postgres FTS vs Meilisearch/Typesense) against a real transliteration test, not a preference                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `OPS`  | **Hosting chosen 25 Aug: Vercel free tier** ([`../adr/020-vercel-deployment.md`](../adr/020-vercel-deployment.md), runbook in [`../16-operations/deployment-vercel.md`](../16-operations/deployment-vercel.md)). Still open: a staging environment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `SEC`  | Threat-model the ingestion path: we execute parsers over files from ~1,000 third-party portals                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Exit:** Q1–Q3 answered in writing; branch chosen and recorded as an ADR; licence decided; one portal's field set documented.

**Risk:** if Q1/Q2 need FOI requests or official contact, they may take weeks. **Start them on day one and let Sprint 1 proceed in parallel** — Sprint 1's work is branch-independent.

---

## Sprint 1 · Ledger foundation

**Goal:** a real database with real government data in it — the administrative hierarchy.

| Track  | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATA` | **LGD ingestion** — the highest-confidence source in the registry. **States/UTs done 25 Aug** (36 loaded, live, with provenance). Districts → sub-districts → blocks → villages are **blocked on a NAPIX API key**: the district citizen view is CAPTCHA-gated, and NAPIX is the sanctioned route ([`lgd-access-findings.md`](../06-government-sources/lgd-access-findings.md))                                                                                                                                                                                                                                                                                                                                        |
| `DATA` | Immutable raw-artifact store: content-addressed by SHA-256, never mutated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `API`  | Postgres + PostGIS schema and migrations for `admin_unit` + closure table; provenance columns on every fact table; swap `InMemoryProjectRepository` for a Postgres adapter (one line in the composition root)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `WEB`  | Unit page rendering **real LGD data** at state → district → taluka                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `OPS`  | Docker Compose for local dev (Postgres+PostGIS, Redis); migration tooling in CI; staging environment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `OBS`  | **Done 25 Aug:** `/metrics` (Prometheus, route patterns and latency buckets — no identifiers), `contract_violation` integrity alarm, `X-Request-Id` correlation. OpenTelemetry auto-instrumentation **rejected** — it emits query text and entity ids, which `.docs/13-observability` forbids ([`../adr/018-telemetry-without-identifiers.md`](../adr/018-telemetry-without-identifiers.md)). **Log stream made shippable 25 Aug** — structured JSON on stdout with service/version/env, stable event keys, and two-pass redaction that closes a verified credential leak ([`../adr/019-log-shipping.md`](../adr/019-log-shipping.md)). The **destination** is deliberately deferred until the hosting shape is chosen |
| `SEC`  | Secrets management (no secrets in the repo); DB least-privilege — the API's role is **read-only**, only ETL writes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Exit:** a browsable administrative hierarchy of India from live LGD data, every row carrying provenance, served from Postgres through the API to a server-rendered page.

**Why LGD first:** highest confidence in the registry, unblocks `admin_unit` which nearly every other entity references, and it is useful regardless of how Q1–Q3 land.

---

## Sprint 2 · First ingestion connector

**Goal:** the pipeline end to end on one real source, proving the pattern for the other 35.

| Track  | Work                                                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATA` | Declarative source-registry format (YAML). **GePNIC connector** parameterised by base URL — one connector serves ~28 States/UTs. Maharashtra first  |
| `DATA` | Pipeline stages: fetch → hash → store → parse → validate → normalize → load, with quarantine rather than silent drops                               |
| `API`  | `/tenders`, `/units/:id/tenders`; cursor pagination; ETag keyed to `datasetVersion`                                                                 |
| `WEB`  | Tender pages; unit page gains a procurement section                                                                                                 |
| `OPS`  | Scheduled ingestion (cron/queue); **per-source rate limiting and circuit breakers** — a failing portal must not stall the pipeline                  |
| `OBS`  | Ingestion metrics: rows in, quarantined, parse failures, source reachability. **Alert on a source going quiet**                                     |
| `SEC`  | Politeness enforced in code: `robots.txt` honoured, throttling, identifiable user agent, **no CAPTCHA bypass**, public non-authenticated pages only |

**Exit:** one permitting state's tenders ingested on a schedule, source-linked, visible on the site. A second state added by config alone.

**Risk:** the GePNIC field set may vary by deployment. Sprint 0's field verification de-risks this; budget a spike if a second state disagrees.

---

## Sprint 3 · Money in

**Goal:** budget and allocation — the side of the ledger that _is_ verified.

| Track  | Work                                                                                                                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATA` | **BEAMS public MIS ingestion — confirmed available**: departmental/scheme/DDO expenditure, monthly, FY2017-18 onward, no authentication. Plus budget document extraction (Camelot/pdfplumber) with **extraction confidence recorded per figure** and an OCR path for scans |
| `DATA` | `allocation` / `release` / `expenditure` tables with versioning — `record_version`, `superseded_by`, so budget revisions are preserved, never overwritten                                                                                                                  |
| `API`  | Unit finance rollups; **both variances**, never a bare `variance`; `insufficient_data` as a first-class status                                                                                                                                                             |
| `WEB`  | Money Trail at **unit** level; `MissingData` wherever a stage is unpublished                                                                                                                                                                                               |
| `OPS`  | Longer-running extraction jobs; artifact storage growth                                                                                                                                                                                                                    |
| `OBS`  | Extraction-confidence distribution; quarantine backlog; **alert when low-confidence share rises**                                                                                                                                                                          |
| `SEC`  | Sandboxed PDF/OCR workers — resource-limited, no network, no filesystem escape. We parse untrusted files at scale                                                                                                                                                          |

**Exit:** real allocation figures rendering with provenance to a document page, at unit level, with missing data shown honestly.

**Branch B note:** this sprint is where Branch B earns its keep. Unit-level money-in is verified and useful even if project-level never materialises.

---

## Sprint 4 · Money out, and the project chain

**Goal:** connect money to works — or establish that it cannot be connected, and say so in the product.

| Track  | Work                                                                                                                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATA` | **Branch A:** works-register / OMMAS ingestion; project↔tender and expenditure↔project joins. **Branch B:** deepen procurement — awards, bidder counts, contract values — and document the join gap as a first-class coverage fact |
| `DATA` | **Entity resolution service**: contractor canonicalization with `linkage_confidence`, deterministic keys first, fuzzy second, review queue for the middle                                                                          |
| `API`  | Project endpoints; the finance chain; coverage endpoint (`expected` / `present` / `missing`)                                                                                                                                       |
| `WEB`  | Project page; Money Trail at project level; contractor pages — **no score, rank or flag**                                                                                                                                          |
| `OPS`  | Reprocessing capability: re-run extraction over stored artifacts without re-fetching                                                                                                                                               |
| `OBS`  | Join-success rate as a headline metric — _what share of tenders link to a project?_                                                                                                                                                |
| `SEC`  | Entity-resolution review UI is internal-only, SSO-gated; analysts curate **linkage**, never values                                                                                                                                 |

**Exit:** either a populated project-level chain, or a product that shows precisely where the chain breaks and why — with the coverage data to prove it.

---

## Sprint 5 · Find it

**Goal:** search and geography — the two ways people actually arrive.

| Track  | Work                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATA` | Boundary geometry from MRSAC/Bhuvan/Survey of India; **join geometry to LGD codes** (unverified — spike first); MVT tile pipeline                                  |
| `API`  | Search: exact-ID first, **bidirectional Devanagari↔Latin transliteration**, typo tolerance, contractor alias matching, grouped typed results, `zeroResultReason`   |
| `WEB`  | Search page (URL-driven, server-rendered, indexable); map as a client island with the zoom ladder and 400-feature cap; **the table equivalent as a co-equal view** |
| `OPS`  | Tile generation and CDN; search index build in the pipeline                                                                                                        |
| `OBS`  | Zero-result rate; search latency p50/p95; `map_feature_cap_hit`                                                                                                    |
| `SEC`  | **No query text in telemetry** — an activist searching a contractor has a real threat model. Enforced by a test                                                    |

**Exit:** a citizen finds their district by name or on a map; a journalist finds a contractor by an alias.

**Risk:** the LGD-code ↔ geometry join is unverified. If it fails, the map degrades to district-level only. Spike in Sprint 4.

---

## Sprint 6 · Consistency

**Goal:** the analytics that make this more than a data browser — expressed neutrally.

| Track  | Work                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATA` | Analytics service: variance, robust median/MAD peer comparison, cost-per-unit, HHI concentration, vertical roll-up gaps. Deterministic, versioned, reproducible |
| `DATA` | Anomaly engine writing neutral, template-generated observations with evidence links; Verification Priority with all six factors and its confidence              |
| `API`  | Observations, peers, roll-up consistency, coverage endpoints; **observation text as `{key, params, rendered.en}`** so Marathi/Hindi is possible                 |
| `WEB`  | Observations (scoped to an entity, never a global feed), Verification Priority breakdown, peer distribution, roll-up detail                                     |
| `OPS`  | Nightly recompute; scope-tagged ISR revalidation so a Maharashtra ingest does not invalidate India                                                              |
| `OBS`  | Recompute duration; observation counts by type; **`contract_violation{missing_provenance}` alerting at zero tolerance**                                         |
| `SEC`  | Neutrality gate extended to server-generated observation templates, in every locale                                                                             |

**Exit:** every observation is neutral, reproducible, and links to the exact figures and sources that produced it.

---

## Sprint 7 · Prove it

**Goal:** traceability all the way to a page of a government document — the product's whole claim.

| Track  | Work                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATA` | Document store with **HTTP `Range`** support; page anchors and bounding boxes captured at extraction; lineage graph including the reverse index (_which conclusions rest on this figure?_) |
| `API`  | `/sources`, `/sources/:id/artifact` (ranged), `/figures/:id/lineage`; source-registry health                                                                                               |
| `WEB`  | Source panel (zero-latency, provenance embedded), page-anchored document viewer with the **extracted-value card first**, lineage view, public source registry                              |
| `OPS`  | Artifact CDN; archived-copy fallback when a publisher URL dies                                                                                                                             |
| `OBS`  | **Source-open rate and document-open rate** — the best signals that the core promise is landing                                                                                            |
| `SEC`  | Document viewer hardening: host allow-list from the registry, SHA-256 verification against the extracted copy, no JS execution, size caps, sandboxed rendering                             |

**Exit:** a reader goes from a rupee figure to the page of the PDF it was read from, in two clicks, offline-safe metadata included.

---

## Sprint 8 · Researchers, and the API as a product

**Goal:** serve the audience that justified web-first.

| Track | Work                                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API` | Public REST API documented via OpenAPI; API keys with scopes and tiers; **CGNAT-safe rate limiting** — per-IP limits misfire on Indian carrier NAT; bulk dataset export with source columns |
| `WEB` | Sortable/filterable data tables, comparison builder, CSV export **with provenance columns**, API self-service, methodology and coverage pages                                               |
| `OPS` | Export generation off the request path; CDN for datasets                                                                                                                                    |
| `OBS` | API usage by tier; export volume; rate-limit hit rate                                                                                                                                       |
| `SEC` | API key handling (hashed at rest), scope enforcement, abuse protection, export throttling                                                                                                   |

**Exit:** a researcher obtains a versioned, source-linked dataset without contacting anyone. **This closes PR-1**, the risk that motivated web-first.

---

## Sprint 9 · Harden and launch

**Goal:** ship something we are willing to put the project's name on.

| Track  | Work                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `SEC`  | **External penetration test**; dependency and secret scanning; security headers; incident-response runbooks; disclosure process live |
| `WEB`  | **External accessibility audit including Marathi screen-reader users**; Core Web Vitals; 200% zoom; 320px                            |
| `DATA` | **Legal and neutrality review of all copy in all three locales** — the `docs/15` gate, with counsel                                  |
| `OPS`  | Load test; backup **and tested restore**; graceful degradation; staged rollout; rollback rehearsal                                   |
| `OBS`  | SLOs and alerting; on-call runbooks; status page; error budgets                                                                      |
| `ALL`  | Launch checklist; store/press/comms; non-affiliation statement prominent                                                             |

**Exit:** every quality-gate item green, external reviews passed, rollback rehearsed. Launch.

---

## Standing bar — applies to every ticket

Not sprint-specific, not optional, not a later sprint:

- Type-safe: no `any`, strict TS, domain types at every boundary
- Tests written **with** the feature: unit for logic, integration for services, E2E for journeys
- Every figure renders through `<Figure>` with provenance — a compile error otherwise
- Neutral copy only from the server; the gate runs on every locale
- No red in any variance, severity, priority or status
- Missing is never zero; no variance across a missing stage
- Structured logs, correlation IDs, **no query text, questions, coordinates or secrets in telemetry**
- Input validated at the boundary; least privilege; no secrets committed
- Migrations version-controlled; no manual schema changes
- Docs or an ADR updated **in the same PR**
- `feature/*` → `main`; CI green before merge ([`adr/023`](../adr/023-features-target-main.md))

---

## Deliberately deferred

Their absence is a decision, not an oversight:

| Deferred                                        | Why                                                                                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kubernetes, Kafka, microservice mesh**        | No concrete requirement. Docker Compose locally, a managed Postgres and a container host in production. Revisit at `docs/14` Phase 5+, on evidence |
| **The AI layer**                                | Advisory and secondary — _if AI and ledger disagree, the ledger wins._ It depends on the most backend work and adds the most risk. Post-launch     |
| **The mobile app**                              | `.docs/decisions/web-first-pivot.md`. Resume after launch; revalidate the toolchain then                                                           |
| **Accounts, saved items, notifications**        | A server-side watchlist would create the one genuinely sensitive dataset the platform otherwise avoids                                             |
| **States beyond Maharashtra**                   | Phase 1 is Maharashtra roads. The connector is parameterised, so expansion is config — but coverage claims must stay honest                        |
| **Read replicas, sharding, aggressive caching** | Optimise on measured bottlenecks, not anticipated ones                                                                                             |

---

## Decision gates

| After    | Decision                                                                       | Owner           |
| -------- | ------------------------------------------------------------------------------ | --------------- |
| Sprint 0 | **Branch A or B** — recorded as an ADR                                         | Product + data  |
| Sprint 0 | Licence; search backend; hosting shape                                         | Project lead    |
| Sprint 2 | Is one GePNIC connector really enough for ~28 states?                          | Data            |
| Sprint 4 | Can tender↔project and expenditure↔project be joined at acceptable confidence? | Data            |
| Sprint 5 | Does LGD ↔ geometry join? If not, map scope narrows                            | Data            |
| Sprint 6 | Are observations passing neutrality review at scale?                           | Legal + product |
| Sprint 8 | Launch scope: how much coverage is enough to be useful and honest?             | All             |

---

## What would invalidate this plan

Stated plainly, so they are recognised early rather than absorbed silently:

1. **Q1 and Q2 both negative** → Branch B. Sprints 3–4 re-weight; the product claim narrows. Not fatal.
2. **GePNIC deployments differ materially per state** → the one-connector assumption fails and Sprint 2 multiplies. Sprint 0's field verification is the early warning.
3. **A source disallows collection.** Already realised: Maharashtra's and Karnataka's procurement portals both serve `Disallow: /`. Two of thirty-six — but one is the Phase-1 target. See [`access-and-permissions.md`](../06-government-sources/access-and-permissions.md).
4. **Source licences forbid republication** → could restrict what is displayable. Sprint 0 captures licences precisely because this is unknown today.
5. **Extraction quality is too poor to publish** → if OCR confidence on state budget documents is low across the board, figures may not meet the bar. Sprint 3 will reveal it.
6. **The team is smaller than assumed** → calendar stretches proportionally. Do not compress sprints; extend them.

A plan that cannot be invalidated is not a plan; it is a wish.
