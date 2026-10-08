# LokDarpan — Feature Priorities, Roadmap and First Milestone

**Date:** 7 October 2026 · **Status:** Proposed · **Refreshes** [`00-overview/product-audit-2026-09-29.md`](../00-overview/product-audit-2026-09-29.md) for a 65-feature version of the same brief
**Binding:** [`17-legal/legal-ethical-rules.md`](../17-legal/legal-ethical-rules.md). Where a feature conflicts with it, the feature is planned in its permitted form or not at all (§2).

This document answers the "Master Product & Engineering Specification" brief of 7 October 2026. Most of
what that brief asks for already exists in `.docs/`, written against the code. Repeating it here would
create a second specification that drifts from the first, so this document does three things only:

1. classifies all 65 feature areas by priority, data availability and permitted form (§4);
2. sets out the 30/90/180/365-day roadmap and the backlog for the first 90 days (§5, §6);
3. names the smallest useful production milestone (§7).

For deliverables A and C–J it points to the document that already covers each, and records only what
this brief adds (§3).

---

## 1. The conclusion first

**The brief's P0, "a highly reliable Maharashtra PWD data chain" (department → division → district →
road/project → tender → award → contractor → contract → payment → completion → audit), cannot be built
from sources LokDarpan may use today.** The audit's data blockers are unchanged since 29 September:

| Link in the chain                 | Blocker                                                                                          | Kind             |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- |
| PWD tender                        | PWD NIT system and MahaTenders serve `robots.txt: Disallow: /` (re-verified 30 September)        | Access           |
| Bid, award, contractor            | Award-of-contract data is CAPTCHA-gated on every GePNIC portal tested and on CPPP                | Access           |
| Road / project / work, completion | No PWD works register identified; OMMAS (rural roads) forbids copying without written permission | Source / licence |
| Budget → allocation → expenditure | BEAMS is held locally and withheld until the Finance Department permits republication            | Licence          |
| Payment                           | Not identified in the sources reviewed as of 7 October 2026                                      | Source           |
| Audit                             | **Available and published** — 30 CAG reports, 5,088 reviewed figures (ADR-070)                   | —                |

The requests that could change four of these rows are drafted and **unsent**
(`06-government-sources/permission-requests.json`). **On 7 October the maintainer deferred them**
([`decisions/2026-10-07-permissions-deferred.md`](../decisions/2026-10-07-permissions-deferred.md)):
permission acquisition is not a development dependency, restricted sources are built for behind the
publication gate, and the requests are revisited once the core Maharashtra platform and data graph are
substantially complete. The plan below builds what is publishable now; each blocked feature is a
recorded grant and a switch away once its permission exists.

### What has moved since the 29 September audit

| Audit item                                  | 7 October                                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 · CAG corpus not in production           | **Done** — promoted 6 October (ADR-070)                                                                                                      |
| B7 · Search was an unindexed `ILIKE`        | **Done for places, report pages and verified figures** (0039); tenders deliberately not indexed (ADR-056)                                    |
| B9 · No rate tier on `/api/v1`              | **Done** — CDN caching plus a miss-only limit (`16-operations/rate-limiting.md`)                                                             |
| Raw bytes not kept durably                  | **Done** — R2, `stored_in` (0037, ADR-069)                                                                                                   |
| Ingestion failure alert                     | **Done** — the nightly check opens an issue (#169)                                                                                           |
| Maharashtra tender notices                  | **Partly** — MHADA and MSIDC collected locally, notice facts read for review (ADR-068, 0040–0044)                                            |
| B2–B5 · Permission requests                 | **Unchanged** — none sent                                                                                                                    |
| B8 · Sub-district and ULB geography in prod | Not re-measured since 29 September (production then held none)                                                                               |
| Plan for receipts and transfers             | **New** — [`02-architecture/PUBLIC_FINANCE_GRAPH_ARCHITECTURE.md`](../02-architecture/PUBLIC_FINANCE_GRAPH_ARCHITECTURE.md), tracked in #184 |

---

## 2. Where this brief conflicts with the binding rules

The audit's §5.2 already lists eight conflicts (contractor rankings, inferred contractor networks,
anomaly feeds, anomaly alerts, "investigator" framing, chart-to-PNG export, free AI chat, generated
prose). They stand. This brief adds these:

| Brief asks for                                                   | Rule                                                                                       | Permitted form                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F37 project health as `GREEN / YELLOW / RED`                     | No red in status; red-amber-green traffic lights are on the design system's forbidden list | F63's checklist instead: each stage held or not held, naming the source that would fill it. No colour carries a verdict.                                  |
| F46 source monitor shown `GREEN / YELLOW / RED`                  | Same                                                                                       | Status words from the existing `DataState` vocabulary (ADR-054), with times. The palette rule has no internal-page exemption.                             |
| F30 contractor vs contractor; F31 contractor dashboards          | No rankings of firms or people                                                             | Comparison of places, bodies, schemes and years only. A firm's own page (S-42) shows its cited records and descriptive totals, never beside another firm. |
| F33 "Which contractors receive the most PWD work in a district?" | Same                                                                                       | HHI and top-k share **for the district** (S-44), with no named, ordered list.                                                                             |
| F42 "Find contractors who won more than ₹100 crore…"             | A threshold over firms is an ordering of firms                                             | Not answered. The planner refuses queries whose result is "firms selected by how much they received" and offers the scope's concentration instead.        |
| F40 "Why did this project cost increase?"                        | No causal claims; an LLM may not author explanatory prose                                  | Each revision with its date, amount and the reason **the document states**, quoted and cited. Where none is stated, say so.                               |
| F29 "Notify me when Contractor X receives another contract"      | No anomaly notifications; no surveillance-style framing of a firm                          | Watch a firm's page for new cited records, exactly as for a place or a document; no "signals".                                                            |
| F38 / F11 partner and joint-venture graphs                       | Rule 4 (official sources only); no re-identification                                       | Only relationships an official document states, each cited. Nothing inferred from co-occurrence, shared addresses or names.                               |
| F55 reports "with charts" exported to PDF                        | Chart-to-PNG export forbidden                                                              | CSV/JSON with provenance columns; a print stylesheet for the page itself, whose figures keep their citations. No detached chart image.                    |
| F56 "investigative research tool", F53/F64 "investigation"       | Positioning: "It does not investigate, accuse, or make legal findings"                     | Same workflow, named "trace" and "saved trace" (audit §5.2).                                                                                              |

The brief's quality states `Inferred` and `Conflicting` are permitted and already modelled:
`district_source` names an inference, and two assertions are kept apart and reconciled, never merged.

---

## 3. Deliverables A–J: where each already lives

| Deliverable           | Already specified in                                                                                                         | What this brief adds, and where it goes                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · Architecture      | `02-architecture/system-architecture.md`, `web-architecture.md`, `PUBLIC_FINANCE_GRAPH_ARCHITECTURE.md` §5                   | Nothing new. The brief's diagram matches §5 of the architecture document, including "do not turn every box into a microservice".                            |
| C · Data model        | `PUBLIC_FINANCE_GRAPH_ARCHITECTURE.md` §6–§10                                                                                | The PWD-specific nodes the brief names — road, bridge, work, milestone, office, official — below.                                                           |
| D · PostgreSQL schema | `database/migrations/` (the schema of record); architecture document §7, §10, §17                                            | Do **not** use `05-data-model/database-design.md` as a target (#183).                                                                                       |
| E · Ingestion         | `04-data-engineering/maharashtra-tender-ingestion.md` §3; architecture document §13–§14; `16-operations/`                    | Per-source "discovered → fetched → parsed → normalised → validated → stored" belongs in the source registry (`06-government-sources/source-registry.json`). |
| F · API               | `11-api/api-documentation.md`, `client-api-contract.md`, `screen-api-matrix.md`; ADR-012 (REST from RSC)                     | Entity endpoints follow entities as they become publishable. Cursor pagination and OpenAPI are backlog items (§6).                                          |
| G · Frontend          | `01-product/screen-inventory.md`, `state-design.md`, `design-system.md`, `search-experience.md`; ADR-022, 057, 058, 061, 064 | The brief's `/district/:id`, `/local-body/:id` etc. collapse into the one level-agnostic Unit page (`CLAUDE.md`); bodies get one Body page.                 |
| H · AI                | `09-ai/ai-layer.md`, `ai-client-experience.md`                                                                               | An evaluation suite is required before any AI surface ships; extraction stays candidate-only (ADR-072).                                                     |
| I · Observability     | `13-observability/observability.md`; `ingestion_run`; the freshness check (#169)                                             | An internal source-health page (F46, F49) over tables that already exist.                                                                                   |
| J · Security          | `12-security/security.md`, `SECURITY.md`; ADR-052 (bounded fetches); rate limiting                                           | The corrections intake (F59) is the first public write path: it needs abuse controls and must never write to the ledger.                                    |

**PWD-specific nodes (deliverable C), for when a source exists.** Each follows the architecture
document's rules: identity from the executing system's own id, never a name; provenance and confidence
required; created only from a permitted source.

| Node        | Identity                                                                    | Source status, 7 October 2026                                                                 |
| ----------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `road`      | Road number as the road register prints it                                  | No public Maharashtra road register identified; OMMAS for rural roads, licence-blocked        |
| `bridge`    | The register's bridge id                                                    | Not identified                                                                                |
| `work`      | Works-MIS or CRIF job number; road number + chainage                        | Not identified for PWD; a works list is planned in `maharashtra-tender-ingestion.md` Phase H  |
| `milestone` | (work, stage, date), from the document stating it                           | Follows `work`                                                                                |
| `office`    | A `public_body` of kind `office` (circle, division, sub-division)           | Office names appear in GePNIC organisation chains for collected states, and in agency notices |
| `official`  | **Not modelled as a person.** A role at an office, never a named individual | Rule 1; officer references read from prose are already not published (audit §17)              |

---

## 4. Feature prioritisation (deliverable B)

**Priorities.** P0: needed for a trustworthy, correctable platform over what is publishable now.
P1: makes it genuinely useful. P2: intelligence and tracing features. P3: expansion and institutional
features.

**Gate** — the column that decides more than priority does:
**Ready** — publishable data exists, or the feature needs none ·
**Licence** — the source's terms are unrecorded (#182) ·
**Permission** — held or collectable, withheld until a request is answered ·
**No source** — not identified in the sources reviewed as of 7 October 2026 ·
**Rule** — built only in the §2 permitted form.

Complexity S/M/L. Risk is delivery risk (data, legal, technical), not effort. Backend, frontend,
database, infrastructure and testing work is broken out per task in §6 for the features scheduled in
the first 90 days; for later features it is written when they are scheduled.

| #   | Feature                       | P   | Gate                 | Exists today                                                | Depends on       | Cx  | Risk | Value | Notes / permitted form                                                               |
| --- | ----------------------------- | --- | -------------------- | ----------------------------------------------------------- | ---------------- | --- | ---- | ----- | ------------------------------------------------------------------------------------ |
| 1   | Canonical entity graph        | P0  | Ready                | Places, documents, facts, tenders; no bodies or links       | —                | L   | M    | High  | #184 phases 2–3: `public_body`, link tables, `graph_edge` view                       |
| 2   | India / Maharashtra map       | P0  | Ready (places)       | Explorer, boundaries, tender choropleth, layer registry     | 1                | M   | M    | High  | Project, road, bridge layers and PWD division boundaries: No source                  |
| 3   | Global search                 | P0  | Ready                | Places, pages, verified figures (0039)                      | —                | M   | L    | High  | Add bodies; tenders stay unindexed while withheld; transliteration is P2             |
| 4   | Explorer (five entry modes)   | P1  | Mixed                | Geography-first                                             | 1, 3             | M   | M    | High  | Government-first after F9; money-first: Permission; contractor-first: No source      |
| 5   | Project intelligence          | P2  | No source            | Fixture page only, labelled                                 | `work` source    | L   | H    | High  | Unblocked for rural roads only by OMMAS permission                                   |
| 6   | Project lifecycle             | P2  | No source            | —                                                           | 5                | M   | H    | High  | Stages shown as held / not held, each with its document                              |
| 7   | Tender intelligence           | P1  | Permission (details) | 21 portals: counts, placement, history; details withheld    | —                | M   | M    | High  | Counts and portal link now; details on permission; bids and awards: No source        |
| 8   | Contractor intelligence       | P2  | No source · Rule     | —                                                           | award source     | M   | H    | Med   | S-42 descriptive only; no score, rank or flag                                        |
| 9   | Department intelligence       | P0  | Ready (audit, names) | Department page, BEAMS behind a flag                        | 1                | M   | M    | High  | Body page: CAG figures about the body, its tenders; budget on permission             |
| 10  | PWD division intelligence     | P2  | No source            | —                                                           | 1, office source | M   | H    | Med   | Office hierarchy where chains or notices state it                                    |
| 11  | District intelligence         | P0  | Ready                | Unit page                                                   | —                | S   | L    | High  | Add tender counts with floors and audit figures; coverage first                      |
| 12  | Local body intelligence       | P1  | Ready (geography)    | ULBs held locally only                                      | B8 load          | S   | L    | Med   | Local-body finances: no source identified (audit §10)                                |
| 13  | Budget intelligence           | P1  | Permission · Licence | BEAMS loaders, variance view                                | `money_fact`     | M   | M    | High  | BEAMS on permission; Finance Accounts if #182 permits                                |
| 14  | Revenue → expenditure tracing | P2  | Licence              | —                                                           | #182, 13         | L   | M    | High  | Architecture document §8–§9                                                          |
| 15  | Centre → state → local flow   | P2  | Licence              | —                                                           | 14, programme    | L   | M    | High  | Both assertions shown and reconciled, never merged (architecture §10)                |
| 16  | Scheme intelligence           | P2  | Licence · No source  | —                                                           | programme        | M   | M    | Med   | Funding patterns as cited, time-bound facts                                          |
| 17  | Road intelligence             | P3  | No source            | —                                                           | road source      | L   | H    | High  | Rural roads via OMMAS on permission; state highways: none identified                 |
| 18  | Bridge intelligence           | P3  | No source            | —                                                           | bridge source    | M   | H    | Med   |                                                                                      |
| 19  | Expenditure intelligence      | P2  | Permission · Licence | Head-level (BEAMS)                                          | 13               | M   | M    | High  | Per-project expenditure: No source                                                   |
| 20  | Payment intelligence          | P3  | No source            | —                                                           | —                | M   | H    | Med   | Known / unavailable stated; never inferred                                           |
| 21  | Audit intelligence            | P0  | Ready                | 30 reports, pages, figures, evidence rectangles             | —                | M   | L    | High  | Response and action-taken status: no source identified                               |
| 22  | Audit → project linking       | P2  | No source (projects) | Report → state                                              | 1, 5             | M   | M    | High  | Audit → body and → place links are P1, from the report's own scope (ADR-051)         |
| 23  | Government documents          | P1  | Licence (GRs)        | CAG reports, agency notices                                 | GR terms         | M   | M    | High  | Maharashtra GR portal: record its terms first, as in #182                            |
| 24  | Document viewer               | P0  | Ready                | Page text, scan readings, figure rectangles                 | —                | S   | L    | High  | Linked bodies once F1 lands                                                          |
| 25  | Provenance                    | P0  | Ready                | Artefact, page, rectangle, method, version, confidence      | —                | S   | L    | High  | Extend to money rows (architecture §11)                                              |
| 26  | Data-quality indicators       | P0  | Ready                | `DataState` (ADR-054), coverage, collection floors          | —                | S   | L    | High  | One vocabulary on every page                                                         |
| 27  | Temporal intelligence         | P2  | Ready (partly)       | Tender and review history; version pins (ADR-061)           | `money_fact`     | M   | M    | Med   | "As of date X" replay is not supported; pins say so                                  |
| 28  | Change detection              | P1  | Ready                | `tender_version` (0022), review history                     | —                | S   | L    | Med   | Surface "what changed" on the record's own page                                      |
| 29  | Alerts                        | P2  | Rule                 | —                                                           | user tier        | M   | M    | Med   | Figures and documents only; email to a verified address; no anomaly alerts           |
| 30  | Comparison engine             | P2  | Rule                 | —                                                           | 11, 13           | M   | M    | Med   | Places, bodies, years, schemes; never firms                                          |
| 31  | Analytics dashboards          | P2  | Rule · Permission    | —                                                           | 13, 19           | M   | M    | Med   | Unit and Body pages are the dashboards; no separate leaderboard surface              |
| 32  | Money map                     | P2  | Permission · Licence | Tender layer                                                | 13, 2            | M   | M    | High  | Concentration layer per scope only                                                   |
| 33  | Concentration analysis        | P2  | No source · Rule     | Specified (`analytics-engine.md` §8)                        | award source     | M   | M    | Med   | Scope statistics only (S-44)                                                         |
| 34  | Procurement analytics         | P2  | Ready (counts)       | Tender counts                                               | 7                | M   | M    | Med   | Counts, corrigenda and deadline moves now; bids, awards, spread: No source           |
| 35  | Delay intelligence            | P3  | No source            | —                                                           | 5                | M   | H    | Med   | Reasons only as documented                                                           |
| 36  | Cost-change intelligence      | P3  | No source            | Tender value history (withheld)                             | 5                | M   | H    | Med   | Each revision cited; no causal text                                                  |
| 37  | Project health                | —   | Rule                 | —                                                           | —                | —   | —    | —     | Replaced by F63's checklist; no traffic lights                                       |
| 38  | Relationship explorer         | P2  | Ready (after F1)     | —                                                           | 1                | L   | M    | High  | Stated relationships only, each with evidence                                        |
| 39  | Timeline component            | P1  | Ready                | —                                                           | 28               | S   | L    | Med   | Tender history and document dates first                                              |
| 40  | AI research                   | P3  | Rule                 | —                                                           | 3, 1, eval       | L   | H    | Med   | Scope-bound, citation-enforced (`ai-layer.md`)                                       |
| 41  | Evidence-grounded AI          | P3  | Rule                 | Guardrails specified                                        | 40               | L   | H    | Med   | Refuses where retrieval returns nothing                                              |
| 42  | Natural-language queries      | P3  | Rule                 | —                                                           | 40, 3            | L   | H    | Med   | Planner emits SQL over published views only; refuses firm-ranking queries            |
| 43  | AI document extraction        | P2  | Ready (candidates)   | Parsers, OCR, review queue                                  | labelled set     | M   | M    | High  | Output is candidates; a person decides (ADR-068, ADR-072)                            |
| 44  | Entity resolution             | P1  | Ready (bodies)       | Placement rules and decisions                               | 1                | M   | M    | High  | Bodies now; firms only with an award source, cross-state by review only              |
| 45  | Marathi + English             | P1  | Ready                | Bilingual names, `simple` FTS, Marathi OCR                  | —                | M   | M    | High  | Transliterated search is P2                                                          |
| 46  | Source monitoring             | P1  | Ready                | `ingestion_run`, freshness check, #169                      | —                | S   | L    | Med   | Internal page; words, not colours                                                    |
| 47  | Ingestion platform            | P2  | Ready                | Bespoke collectors on shared infrastructure                 | 3 money sources  | M   | L    | Med   | `SourceAdapter` extracted at the third money source (architecture §14)               |
| 48  | Raw preservation              | P0  | Ready                | **Done** — R2, content-addressed (ADR-069)                  | —                | —   | —    | High  | Content addressing replaces the brief's date folders; sightings keep the dates       |
| 49  | Ingestion observability       | P1  | Ready                | Run counts, alerts                                          | 46               | S   | L    | Med   |                                                                                      |
| 50  | Data freshness                | P0  | Ready                | Collection windows, dataset version, runs                   | —                | S   | L    | High  | Shown at source, dataset and entity level                                            |
| 51  | API                           | P1  | Ready                | `/api/v1` units, geo, tenders, documents, search            | —                | M   | L    | High  | Cursor pagination; OpenAPI from `@lokdarpan/contracts`                               |
| 52  | Developer API                 | P3  | Ready                | —                                                           | 51               | M   | M    | Med   | Keys, quotas, a CGNAT-safe tier                                                      |
| 53  | Saved traces                  | P2  | Ready                | URL state (ADR-061)                                         | user tier        | M   | M    | Med   | Named "saved trace"                                                                  |
| 54  | Shareable URLs                | P1  | Ready                | **Done for the explorer** (ADR-061)                         | —                | S   | L    | Med   | Extend to every page                                                                 |
| 55  | Reports                       | P2  | Rule                 | —                                                           | 51               | M   | L    | Med   | CSV/JSON with provenance; print stylesheet; no chart images                          |
| 56  | Research workspace            | P3  | Ready                | —                                                           | 53, accounts     | L   | M    | Med   | Collaboration needs accounts; deferred                                               |
| 57  | Public transparency pages     | P0  | Ready                | Unit and document pages, server-rendered for search engines | —                | S   | L    | High  | One page per entity kind as each becomes publishable                                 |
| 58  | Methodology                   | P0  | Ready                | Linked from the footer; content lives in `.docs/`           | —                | S   | L    | High  | A reader-facing page per source and per derived figure                               |
| 59  | Corrections / disputes        | P0  | Ready                | A link to a new GitHub issue                                | —                | M   | M    | High  | Required by the rules; no GitHub account needed; keeps history; never edits a figure |
| 60  | Neutrality layer              | P0  | Ready                | **Done** — gate, `ServerText`, rule B (ADR-059)             | —                | —   | —    | High  | Maintained, not rebuilt                                                              |
| 61  | Data confidence               | P0  | Ready                | Extraction and linkage confidence on every row              | —                | S   | L    | High  | Low linkage worded on its own (`CLAUDE.md`)                                          |
| 62  | Conflict detection            | P1  | Ready (partly)       | Two BEAMS reports kept apart (0005)                         | `money_fact`     | M   | M    | High  | Reconciliation, never a silent choice                                                |
| 63  | Missing-data intelligence     | P0  | Ready                | Coverage, collection floors                                 | —                | S   | L    | High  | Per-entity checklist naming the source that would fill each gap                      |
| 64  | Trace graph (Money Trace)     | P2  | Mixed                | —                                                           | 1, 13–15, 38     | L   | M    | High  | Every hop shown, gaps named (architecture §18)                                       |
| 65  | National expansion            | P3  | Mixed                | GePNIC already covers 21 states                             | 47               | L   | M    | High  | State spine by the Finance Accounts template before any state's procurement          |

**Tally.** P0: 18 features (backlog adds LD-017 for the publication model), of which two are done (48, 60) and three partly done (3, 21, 25). P1: 17. P2: 21.
P3: 8. Replaced: 1 (F37, by F63). Gated by data, licence or permission rather than effort: 23.

---

## 5. Roadmap (deliverable K)

Dates from 7 October 2026. Each horizon has one test: what can a reader **see in production** at the
end of it that they could not before?

### 30 days — to 6 November: correctable, explained, Maharashtra as held

- A unified publication decision (terms, recorded grant, operator switch), so a restricted source
  can later be enabled without code changes (LD-017). Permission requests themselves are deferred
  (LD-001).
- Record terms for India Budget, CGA, state Finance Accounts, GRAS and the Maharashtra GR portal (#182).
- Correct `database-design.md` (#183).
- A corrections intake that needs no GitHub account (F59), and a methodology page (F58).
- Re-measure, then load sub-district and ULB geography to production (B8).
- `public_body` for Maharashtra and its departments, named from publishable sources (the CAG reports
  name the departments they audit); a Body page listing the audit figures about it (F1, F9).
- One data-state, freshness and gap vocabulary on Unit, Body and document pages (F26, F50, F63).

**Reader test:** open Maharashtra → Public Works Department → see every CAG figure about it, each cited
to its page; see what is not held and why; report an error without an account.

### 90 days — to 5 January: useful

- Link tender organisation chains and document issuers to bodies, with review (F44); a
  government-first explorer (F4).
- `budget_line` and `money_fact`; the first publishable money source, if #182 allows (F13); conflicts
  shown as reconciliations (F62).
- A timeline component over tender history and document dates (F28, F39).
- Cursor pagination, OpenAPI, and CSV with provenance columns (F51).
- More Maharashtra agencies, per `maharashtra-tender-ingestion.md` Phase H (F7; local until terms allow).
- An internal source-health page (F46, F49).

**Reader test:** a body's page shows what it was budgeted and spent from a publishable source, with both
variances and their denominators — or says exactly which permission or licence is missing.

### 180 days — to April 2027: a serious public-finance record

- Programmes, funding patterns, and Union → Maharashtra transfers with both assertions shown (F15, F16).
- Money Trace v1, every hop shown and gaps named (F64), and the relationship explorer over stated
  links (F38).
- Watchlists on figures and documents (F29); comparison of places, bodies and years (F30).
- Finance Accounts for further states (F65).
- LLM-assisted extraction producing candidates, measured against a labelled set before use (F43).
- Whatever the permission answers unlock: BEAMS figures, tender details, OMMAS works.

### 365 days — to October 2027: a product others can build on

- A state-level fiscal spine for every state whose accounts are publishable.
- Scope-bound, citation-enforced AI over published views, with an evaluation suite and refusal paths
  (F40–F42).
- A developer API with keys and quotas (F52); saved traces (F53).
- If OMMAS is permitted: rural-road works with lifecycle, delay and cost-change history (F5, F6, F17,
  F35, F36).

---

## 6. Backlog — first 90 days (deliverable L)

Later horizons stay at epic level until these land. Detailed tasks written now would have to be
rewritten once the permission and licence answers are known.

| ID     | Epic      | Feature    | Task                                                                                                                | Depends             | P   | Cx  | Backend                                                                         | Frontend                                   | Database                       | Infra                   | Testing                                                                                         | Acceptance criteria                                                                                                                |
| ------ | --------- | ---------- | ------------------------------------------------------------------------------------------------------------------- | ------------------- | --- | --- | ------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| LD-001 | Access    | —          | Send the drafted permission requests — **deferred** by the maintainer on 7 October 2026                             | M1, #184 phases 2–4 | —   | XS  | —                                                                               | —                                          | —                              | —                       | `permission-requests.json` test                                                                 | Revisited once the core Maharashtra platform and graph are substantially complete (`decisions/2026-10-07-permissions-deferred.md`) |
| LD-017 | Access    | 7, 13, 59  | Unified publication decision: publisher terms + recorded grant + operator switch; a flag alone never opens a source | —                   | P0  | S   | `publicationDecision()` in `@lokdarpan/domain`; `publishable.ts` reads switches | Withheld states unchanged                  | —                              | Env switches            | Grant registry ↔ `permission-requests.json` consistency test; flag-without-grant stays withheld | A restricted source can be enabled by recording a grant and setting its switch, with no code change                                |
| LD-002 | Access    | 13–15, 23  | Record terms for five sources (#182)                                                                                | —                   | P0  | S   | —                                                                               | —                                          | —                              | —                       | Registry schema test                                                                            | A licence entry, or a dated `unknown`, for each                                                                                    |
| LD-003 | Docs      | —          | Correction notice on `database-design.md` (#183)                                                                    | —                   | P0  | XS  | —                                                                               | —                                          | —                              | —                       | —                                                                                               | No `.docs/` file presents a schema the ledger forbids                                                                              |
| LD-004 | Trust     | 59         | Corrections intake: form, store, reviewer queue, history                                                            | —                   | P0  | M   | Intake route, rate-limited; review CLI                                          | "Report" control with the figure's context | `correction_request` + history | Abuse limits            | Neutrality gate on copy; no path to the ledger                                                  | A report names its figure and source; the reviewer's outcome is recorded; no figure is edited by it                                |
| LD-005 | Trust     | 58         | Methodology pages per source and per derived figure                                                                 | —                   | P0  | S   | —                                                                               | `/about/methodology/*`                     | —                              | —                       | Copy in `src/copy`; rule B                                                                      | Every source on the site and every formula has a page                                                                              |
| LD-006 | Geography | 11, 12     | Re-measure, then load sub-districts and ULBs to production                                                          | —                   | P0  | S   | Existing loaders                                                                | —                                          | —                              | Neon, runbook           | Counts before and after                                                                         | Production counts match local; coverage rows updated                                                                               |
| LD-007 | Graph     | 1, 9       | M1–M2: `public_body`, identifiers, names, jurisdiction; link `department`                                           | —                   | P0  | M   | Loader from CAG-named departments                                               | —                                          | Migration + tests              | Applied by hand to prod | Integration tests; no name without a source                                                     | Maharashtra and its audited departments exist with cited names                                                                     |
| LD-008 | Graph     | 9, 21      | Body page: audit figures about the body, coverage first                                                             | LD-007              | P0  | M   | `/api/v1/bodies/:id`                                                            | Body page (RSC, ISR)                       | `document_subject` (M8)        | —                       | E2E; `<Figure>` provenance compile check                                                        | The PWD page lists each CAG figure about it, with page citations                                                                   |
| LD-009 | Trust     | 26, 50, 63 | One data-state, freshness and gap checklist across pages                                                            | —                   | P0  | S   | `DataState` on every payload                                                    | Shared components                          | —                              | —                       | A snapshot per state                                                                            | Every page states what is held, not collected and withheld, with dates                                                             |
| LD-010 | Graph     | 7, 44      | M3: `tender_body` links, a rule plus a review queue                                                                 | LD-007              | P1  | M   | Resolver, review CLI                                                            | —                                          | Link + decision + history      | —                       | Rule tests; review history                                                                      | Every collected tender resolves to a body or sits in review                                                                        |
| LD-011 | Explorer  | 4          | Government-first entry: body → sub-bodies → places                                                                  | LD-008, LD-010      | P1  | M   | —                                                                               | Explorer mode                              | `graph_edge` view (M9)         | —                       | E2E                                                                                             | A reader reaches the same Unit page from either entry                                                                              |
| LD-012 | Money     | 13, 62     | M4–M5: `budget_line`, `money_fact`, history, BEAMS union view                                                       | —                   | P1  | L   | Generic loader                                                                  | —                                          | Migrations + trigger           | —                       | Paise round-trip; no variance across a gap                                                      | BEAMS reachable through the view with stage and unit; nothing withheld becomes visible                                             |
| LD-013 | Money     | 13         | First publishable money adapter (whichever LD-002 permits)                                                          | LD-002, LD-012      | P1  | L   | Adapter; PDF table rows to review                                               | Budget section on Body and Unit pages      | —                              | —                       | Fixture PDFs; reviewer flow                                                                     | One source's figures shown with page citations and both variances, or the page says why not                                        |
| LD-014 | History   | 28, 39     | Timeline component; tender and document events                                                                      | —                   | P1  | S   | Events endpoint                                                                 | Timeline                                   | —                              | —                       | Unit + E2E                                                                                      | A tender's page shows what changed and when, from `tender_version`                                                                 |
| LD-015 | API       | 51         | Cursor pagination, OpenAPI from contracts, CSV with provenance columns                                              | —                   | P1  | M   | Pagination, generator                                                           | Download links                             | —                              | —                       | Contract tests                                                                                  | Every list pages by cursor; CSV rows carry source URL, page and retrieved date                                                     |
| LD-016 | Ops       | 46, 49     | Internal source-health page                                                                                         | —                   | P1  | S   | Reads `ingestion_run` and windows                                               | Internal page                              | —                              | Access-restricted       | —                                                                                               | Each source shows last tried, last success, counts and failures, in words                                                          |

---

## 7. First implementation milestone (deliverable M)

**M1 · "Maharashtra as held" — LD-004 to LD-009.**

The smallest production change that is useful on its own and moves toward the brief's chain:

> A reader opens **Maharashtra → Public Works Department** and sees every figure the CAG has
> published about that department, each cited to its page, with what is not held stated plainly —
> tenders (not collected: the portal forbids crawling), budget (held, withheld pending permission),
> works (no source identified) — and can report an error without an account.

Why this one:

- **It is the brief's government-first path, in the only form the evidence permits.** The PWD page is
  the root of the chain the brief wants; M1 creates it with the one publishable layer (audit) and
  honest gaps for the rest.
- **It creates the entity everything else attaches to.** Tenders (LD-010), budget lines (LD-012),
  transfers and works all hang off `public_body`. Building it first means no later layer invents its
  own idea of "department".
- **It closes two obligations of the binding rules that are open today:** a corrections path that does
  not require a GitHub account, and methodology a reader can find.
- **It needs no permission and no new source.** Every figure on the page is already in production.

M1 deliberately excludes projects, contractors, maps of works, AI, alerts and any national ingestion.
Each is either data-gated (§1) or depends on the entities M1 creates.

**Done when** the page above is live in production; every figure on it renders through `<Figure>` with
provenance; the neutrality gate and the architecture checks pass; a correction can be filed and
reviewed end to end; and #184 Phase 2 is checked off for Maharashtra. Tracked in #187.
