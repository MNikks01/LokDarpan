# Public Finance Graph — Architecture and Gap Analysis

**Date:** 7 October 2026 · **Status:** Proposed — tracked in #184. Nothing here is built yet, and no migration has been written.
Each phase in §18 becomes numbered migrations and an ADR once it is accepted.
**Binding on this document:** [`17-legal/legal-ethical-rules.md`](../17-legal/legal-ethical-rules.md). Where this plan and those rules disagree, the rules win and the feature is withheld. §3 lists every place they disagree.

> LokDarpan's long-term shape is a source-backed record of how public money moves through Indian
> government: receipts → budgets → allocations → releases → expenditure → works → procurement →
> audit, with transfers between governments. Tenders are one observable part of that flow.
> This document compares what the ledger holds today with that shape, and sets out how to close the
> gap without rewriting the parts that already work.

---

## 0. How to read this

- §1–§3 describe **what exists**, correct the brief's assumptions about it, and list where the brief conflicts with the legal rules.
- §4 is the **gap analysis**: the twelve questions the brief asked, each answered from the code.
- §5–§15 are the **target model**: canonical entities, the graph, money, revenue, expenditure, transfers, provenance, geography, acquisition, adapters and analytics.
- §16–§18 are **expansion, migration and phases**.

Every claim about the current system cites a migration, module or ADR. Every claim about a source
follows the registry's rule: _"X was not identified in the sources reviewed as of [date]"_, never
_"the government does not publish X"_.

---

## 1. Current architecture

### 1.1 What is deployed

| Layer              | What it is                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store              | PostgreSQL + PostGIS on Neon (production), Docker locally. 44 migrations, all additive.                                                           |
| Raw bytes          | Content-addressed `source_artifact` (SHA-256), bytes in R2 (`stored_in`, 0037; ADR-069). How each artefact was found: `artifact_sighting` (0040). |
| Write path         | Collectors and loaders in `services/ingestion`, one module per source. The only writer to the ledger. A dedicated ETL role (0031).                |
| Versioning         | `dataset_version` (monotonic, stamped on every row); `ingestion_run` records what each execution did (0024).                                      |
| Read path          | Next.js `apps/web`, `/api/v1/{units,geo,tenders,documents,search}`, read-only role; every payload states its dataset version (ADR-053).           |
| Publication gating | `apps/web/src/server/publishable.ts`; `PUBLISH_BEAMS_FIGURES`, `PUBLISH_TENDER_DETAILS` off in production (ADR-055, ADR-056).                     |

### 1.2 The ledger, by domain

**Place** — the strongest part of the model.

| Table                                    | Holds                                                                                                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin_unit` (0001, 0011)                | One hierarchy, nine levels (`country` … `gram_panchayat`, `urban_local_body`, `ward`). LGD code or OSM relation as identity — never an invented code. `valid_from`/`valid_to`. Provenance and extraction confidence required. |
| `admin_unit_closure` (0001)              | Ancestor/descendant at every depth: "everything under X" is one indexed read.                                                                                                                                                 |
| `admin_unit_boundary` (0010, 0032, 0033) | Geometry with `boundary_source_kind` (official vs open dataset), label point, area, simplification.                                                                                                                           |
| `geography_coverage` (0025, 0028)        | Whether a level was collected for a state and whether it is known to be short — so absence is not read as non-existence.                                                                                                      |
| `pincode_office` (0034)                  | Department of Posts directory, used only as evidence for tender placement.                                                                                                                                                    |

**Money** — Maharashtra BEAMS only, local only, collected but not displayed.

| Table                          | Grain                                    | Notes                                                                                                                                                    |
| ------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `department` (0003)            | (state `admin_unit`, BEAMS letter code)  | `name_en` nullable: "never inferred from the code".                                                                                                      |
| `budget_scheme` (0003)         | (department, demand number, scheme code) | Keeps `charged_voted`, `source_of_fund`, `plan_type` as published.                                                                                       |
| `scheme_finance` (0003, 0004)  | (scheme, fiscal year, object code)       | `allocated`, `released_fd`, `released`, `utilized`, `reappropriated`. Every amount nullable: NULL is "not published". Extraction and linkage confidence. |
| `department_finance` (0005)    | (department, fiscal year, month range)   | Budgeted, released, received, BEAMS expenditure, treasury expenditure. Kept apart from `scheme_finance` because the two reports disagree for some years. |
| `scheme_finance_variance` view | —                                        | Release variance and allocation variance, each against its denominator; `insufficient_data` where a stage is unpublished. No column named `variance`.    |

**Documents and facts** — CAG audit reports, in production since 6 October 2026 (ADR-070).

| Table                                                       | Holds                                                                                                                                                                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document`, `document_page` (0006)                          | Page text as the file states it; NULL where a page has no text layer.                                                                                                                                            |
| `document_fact` (0007, 0014, 0020, 0041, 0043, 0044)        | **Candidates**, cited to a page, with raw text, parser version, confidence. `field` names what a fact fills; `per_unit` its denominator; `same_figure_as` links bilingual duplicates; `page_reading_id` for OCR. |
| `document_fact_review_history` (0009), reviewer role (0008) | Append-only record of every review decision that was replaced.                                                                                                                                                   |
| `published_fact` view                                       | The only display surface: verified or corrected rows, never scan-read ones yet (ADR-072).                                                                                                                        |
| `page_reading`, `page_reading_item` (0042)                  | OCR readings beside the page, never in place of it (ADR-071).                                                                                                                                                    |

**Procurement** — open tenders from 21 state GePNIC portals, nightly; 1,318 in production on 29 September.

| Table                                         | Holds                                                                                                                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tender` (0012, 0013, 0034–0038)              | An **advertisement of intent to buy**, keyed by (portal, portal's opaque id). Department and organisation chain as text. Issuing-office district with `district_source` and evidence. Value and EMD in paise, nullable. |
| `tender_version` (0022)                       | What a tender said before it changed, written by trigger.                                                                                                                                                               |
| `tender_collection_window` (0012, 0023, 0029) | When collection began per portal, and the state it covers — so "not collected" is not read as "nothing advertised".                                                                                                     |
| `tender_district_decision` (0035)             | A reviewer's placement, kept with its history.                                                                                                                                                                          |

There is deliberately **no award, winner, contractor or awarded-value column** (0012): award data is
CAPTCHA-gated on every GePNIC deployment tested and on CPPP.

### 1.3 Ingestion

Each source is a bespoke module under `services/ingestion/src/`: `lgd`, `osm`, `beams`, `cag`,
`gepnic`, `maharashtra` (MHADA, MSIDC agency notices), `pincode`, `ocr`. They share real
infrastructure: `net/fetch-with-limits.ts` (byte caps, timeouts, retries; ADR-052), `net/robots.ts`,
`raw-store.ts`, `ingestion-run.ts`, `advisory-lock.ts`, `review/`. The closest thing to a generic
adapter contract is `AgencyListing<Row>` in `maharashtra/collect.ts`.

The scaffold directories `connectors/{api,csv,excel,gis,html,ocr,pdf}`, `sources/{central,states,uts}`,
`pipelines/`, `provenance/`, `schedulers/` and `validation/` contain only `.gitkeep`.

---

## 2. Premises in the brief that the repository corrects

The brief was written against a picture of LokDarpan that differs from the code in five ways. Each
changes the plan.

| #   | The brief assumes                                                                           | The repository shows                                                                                                                                                                                                                                                                                                                                                                                                   | Consequence                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | An existing "Maharashtra PWD tender" implementation to generalise                           | **No Maharashtra PWD tenders are collected.** PWD's NIT system and MahaTenders both serve `robots.txt: Disallow: /` (verified 25 August, re-verified 30 September; evidence files in `06-government-sources/`). Maharashtra notices come only from agencies that permit it (MHADA, MSIDC; local only). Permission drafts exist (`permission-requests.json`: `maharashtra-pwd`, `mahatenders`); **none has been sent**. | Stage 1 as written ("make Maharashtra PWD complete and reliable") cannot start. §16 replaces it.                                                                      |
| P2  | Tender → Award → Contractor is the first layer to build                                     | Award-of-contract data is CAPTCHA-gated platform-wide (0012, `gepnic-access-findings.md`). Contractor names exist only as `contractor_reference` candidates in CAG prose.                                                                                                                                                                                                                                              | Layer 1 of the brief's §27 has no source for its second and third nodes. The procurement layer is "advertised tenders" until a source is found or permission granted. |
| P3  | The model is `Department → Tender` and needs generalising                                   | The model is already generic where it has evidence: one `admin_unit` hierarchy for all of India, a provenance-first document/fact store, a parameterised GePNIC collector covering 21 states. What is Maharashtra-shaped is the **money** layer (BEAMS) — §4 Q2.                                                                                                                                                       | The work is not "de-PWD the schema". It is adding the entities that do not exist yet: a public body, a programme, receipts, transfers, and a generic money fact.      |
| P4  | Numbers can be published once collected                                                     | Collection and publication are separate questions (`source-licences.md`). BEAMS (all money held) and GePNIC tender details are collected and **withheld**. India Budget and CGA have **no recorded licence**, and "a source with no recorded licence is not publishable".                                                                                                                                              | The revenue and transfer layers are blocked at the licence step, not the engineering step. Recording those terms is the first task, and it costs no code (#182).      |
| P5  | The target schema in `05-data-model/database-design.md` describes where the ledger is going | That file predates the migrations and contradicts invariants the ledger enforces: `confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000` (the ledger refuses a defaulted confidence — 0007), `amount_inr NOT NULL` on every fact (missing is never zero), `source_document` (the ledger uses `source_artifact`), `tender.contractor_id` (0012 forbids it).                                                                   | It must not be used as the target. This document supersedes its national-scale sections for planning; the file itself needs a correction notice (#183).               |

---

## 3. Where the brief conflicts with the legal rules

These are withheld or reshaped, not deferred. They do not return at a later stage.

| Brief asks for                                                                                 | Rule                                                                                                                        | What the platform does instead                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Which contractors repeatedly win contracts?" "Which companies receive the most public money?" | No rankings; no score, rank, badge or flag on a contractor (`web-first-pivot.md` §What reverses; `risk-scoring-engine.md`). | Concentration is a statistic about a **scope** (HHI and top-k share for a taluka × department × FY; `analytics-engine.md` §8), never a list of firms ordered by value.                                         |
| "Which departments have large unspent balances?" "Which districts received the most?"          | No global feeds or leaderboards; observations are scoped to an entity the reader navigated to.                              | Each unit or body page shows its own figures with both variances and their denominators. A reader may sort a table they opened; the platform publishes no ordered "top" list.                                  |
| "Which projects are delayed?" as a feed                                                        | Same.                                                                                                                       | Delay is shown on the work's own page, with the dates it is computed from, once a work source exists.                                                                                                          |
| Analytical classes `CORRELATION` and `INTERPRETATION`                                          | "Show only facts": a figure from an official source or a transparent calculation over such figures.                         | The platform produces three classes: **fact**, **derived** (a stated formula over facts) and **attributed** (an auditor's finding, shown as a citation). Correlation is not produced; interpretation never is. |
| Spending efficiency, cost overrun, outcomes "associated with" spending                         | Never infer causation or wrongdoing; deviations can be legitimate.                                                          | Ratios only where the denominator is sourced (ADR-044/045), labelled as ratios. Outcome datasets are shown beside spending, never joined into a claim about effect.                                            |
| "Show the distribution of Company X's contracts by state and department"                       | Names appear only inside neutral, descriptive statistics; no re-identification by combining datasets.                       | A firm's page may list the published records that name it, each cited. Cross-state identity is a reviewed link with stated confidence, never a fuzzy match presented as fact.                                  |

---

## 4. Gap analysis — the twelve questions

**Q1. What data model already exists?** §1.2. In short: a strong place model, a strong
provenance/document/review model, an advertisement-only tender model, and a single-state,
single-source budget-line money model.

**Q2. Which parts are PWD- or Maharashtra-specific?**

| Part                                                     | Specific to                     | Why it matters                                                                                                                           |
| -------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `department.code` as a BEAMS letter (`H` = Public Works) | Maharashtra Finance Department  | No other government uses this code. A Union ministry or a Karnataka department has no place to go.                                       |
| `department.admin_unit_id`                               | —                               | Conflates a **government** with its **territory**. A Union ministry's territory is India; a corporation or board has no clean territory. |
| `budget_scheme` (`demand_no`, `scheme_code`)             | Maharashtra's chart of accounts | It is a budget **line**, not a programme. Named "scheme", it invites linking PMGSY to it by name.                                        |
| `scheme_finance` column set                              | The BEAMS export                | Columns are BEAMS stages. Another state's budget publishes BE/RE/actuals and supplementaries — none fit without new columns per source.  |
| `fiscal_year SMALLINT` "as BEAMS labels it"              | BEAMS convention                | Sensible convention (start year), but documented as BEAMS's, not the ledger's.                                                           |
| `maharashtra/` agency collectors, `beams/` loaders       | Maharashtra                     | Correctly source-specific. Nothing to change.                                                                                            |
| `tender.department` free text, `organisation_chain`      | GePNIC                          | Generic across 21 states, but not joined to `department`.                                                                                |

Nothing in the schema is PWD-specific. The tender model is already multi-state.

**Q3. What is reusable as it stands?** Everything in §1.2 except the BEAMS-shaped money tables,
and all of the shared ingestion infrastructure in §1.3. In particular these patterns are the template
for every new table, not things to redesign:

- content-addressed raw artefact + sighting (discovery ≠ authority);
- candidate → reviewed fact, with history, and a view as the only display surface;
- placement with method, confidence, evidence and a reviewer decision table (0034, 0035);
- trigger-written history for anything a source can change (0022);
- coverage and collection windows, so absence is never read as zero.

**Q4. What needs to become generic?** Three things: the **body** that holds money (department →
public body), the **money fact** (BEAMS columns → one row per measure), and the **source adapter**
(bespoke collectors → a shared contract, extracted when the third money source arrives).

**Q5. Missing entities.** Public body (government, ministry, department, directorate, board,
corporation, authority, local body); programme (the cross-government scheme — PMGSY, a CSS);
programme funding pattern; budget line as a generic accounting coordinate; receipt head; fund
transfer; denominator (population and other sourced bases); work/project; award; contract;
contractor (party); payment; asset; outcome indicator.

**Q6. Missing relationships.** Body ↔ body (parent, administers); body ↔ territory (jurisdiction);
budget line ↔ programme; tender ↔ body (from the organisation chain); tender ↔ work; work ↔ budget
line; transfer from body to body for a programme; award ↔ tender ↔ party; document ↔ any entity it
evidences (today only `document.admin_unit_id`).

**Q7. Missing provenance fields.** Against the brief's list:

| Field             | Today                                                            | Gap                                                                                                      |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| source, document  | `source_sha256` on every row; `detail_sha256` on tenders         | None                                                                                                     |
| page / table      | `document_fact.page_number`, text-item geometry (0016, ADR-036)  | Money rows from PDFs will need a page anchor; BEAMS rows (CSV) do not                                    |
| publication date  | `document.published_on` (never the retrieval date)               | Not on money rows: a budget figure cannot say which edition of the budget stated it                      |
| effective date    | `fiscal_year` (+ month range on `department_finance`)            | No **estimate stage** (BE / RE / final grant / actual). The legal rules require revisions to be retained |
| amount, currency  | `NUMERIC(20,2)` rupees, nullable                                 | The source unit multiplier (BEAMS reports thousands) lives in loader code only                           |
| confidence        | Extraction + linkage, never defaulted                            | None                                                                                                     |
| extraction method | On `document`, `document_fact`, `page_reading`                   | Not on `scheme_finance` / `department_finance`                                                           |
| last verified     | `artifact_sighting` records each re-observation; `ingestion_run` | Not surfaced per figure; derivable                                                                       |

**Q8. Financial-year modelling.** The start-year convention is fine and should be kept, but declared
as the ledger's (not BEAMS's) and enforced by one domain type. Missing: estimate stage (Q7); periods
within a year beyond `department_finance`'s month range. Tenders carry dates and no FY, which is
correct: an FY is derived from a date, not stored beside it.

**Q9. Geographic modelling.** Strong. Missing: a revenue **division** level; constituencies (LGD
publishes them); a denominator table (per-capita figures are withheld until the ledger can say what
they are per — ADR-044, ADR-045); work-site locations (the records layer waits on a licensed
coordinate source — ADR-063). The ledger already separates **filed under** (0027) and **issued by an
office in** (0013) from **located in**; the new model must keep a third, **jurisdiction of**, apart
from both.

**Q10. Source-adapter architecture.** Missing as a contract. §14.

**Q11. What must change before expanding beyond the current sources?**

1. Record the republication terms of every source the next layer needs (P4). Without this, new
   data joins BEAMS as collected-but-withheld.
2. Introduce `public_body`, and link `department`, `tender.organisation_chain` and
   `document.issuing_authority` to it. Three unlinked spellings of "who" is the largest structural
   gap today.
3. Introduce the generic money fact, with estimate stage and source unit, before loading a second
   budget source — otherwise each source adds a table shaped like its export.
4. Correct `database-design.md` (P5) so the next contributor does not implement it.

**Q12. What can remain unchanged?** `admin_unit` and its closure, boundaries and coverage; the raw
store; the document/fact/review machinery; `tender` and its history, placement and windows;
`dataset_version` and `ingestion_run`; the read-path rules (one version per payload, server-side
arithmetic, provenance-required `<Figure>`); the existing BEAMS tables, which become one source
behind a view rather than being migrated.

---

## 5. Target architecture

```text
 SOURCES (official only; robots.txt honoured; licence recorded before anything is shown)
   Union budget & accounts · state budgets & accounts · treasury exports · CAG reports
   · e-procurement portals · agency notices · LGD · denominators · OSM (geometry only)
        │
        ▼
 ADAPTERS ── discover → fetch → extract → parse → normalise ──► typed observations
        │        (raw bytes to R2 first; source_artifact + artifact_sighting)
        ▼
 CANDIDATES ── document_fact, money candidates from PDFs, link candidates
        │        (nothing here is displayed; low-confidence and inferred rows go to review)
        ▼
 CANONICAL LEDGER (PostgreSQL + PostGIS; the only write path is ETL)
   place ─ public_body ─ programme ─ budget_line ─ money_fact ─ fund_transfer
   ─ tender ─ work* ─ award* ─ party* ─ document ─ published_fact
        │        * only when a permitted source exists
        ▼
 LINKS ── one table per link kind, each with method · confidence · evidence · decision
        │        graph_edge VIEW unions them for traversal
        ▼
 DERIVED ── variances, roll-up gaps, ratios with denominators, concentration per scope
        │        computed in SQL, stamped with dataset_version and formula id
        ▼
 READ API (/api/v1, read-only role) ──► web (RSC + ISR by dataset version)
```

The graph is the relational ledger plus its link tables. There is no separate graph store (§6.3).

---

## 6. Canonical data model and graph model

### 6.1 Nodes

| Node                    | Table (✓ exists · + new · ○ gated on a source)       | Identity                                                                                                   |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Place                   | ✓ `admin_unit`                                       | LGD code, else OSM relation                                                                                |
| Public body             | + `public_body`                                      | Source-scoped identifiers in `public_body_identifier`; never a name                                        |
| Programme               | + `programme`                                        | Official code where published; else the issuing ministry's own reference                                   |
| Budget line             | + `budget_line` (BEAMS `budget_scheme` maps onto it) | (body, classification coordinates as published)                                                            |
| Money fact              | + `money_fact`                                       | (line, measure, stage, period, source artefact)                                                            |
| Fund transfer           | + `fund_transfer`                                    | (from body, to body, mechanism as published, programme, period, asserting body, source)                    |
| Tender                  | ✓ `tender`                                           | (portal or registry source, issuer-scoped id) — 0012; agency rules in `maharashtra-tender-ingestion.md` §5 |
| Document, fact          | ✓ `document`, `document_fact`, `published_fact`      | Artefact hash; page                                                                                        |
| Denominator             | + `denominator` (when a source is recorded)          | (place or body, measure, period, source)                                                                   |
| Work                    | ○ `work`                                             | The executing system's work id (e.g. road number + chainage, a works-MIS id)                               |
| Award, party            | ○ `award`, `party`, `party_name`                     | Award: the award document. Party: a registration number where published; otherwise see §6.4                |
| Payment, asset, outcome | ○                                                    | Not identified in the sources reviewed as of 7 October 2026                                                |

### 6.2 Edges

Each edge kind is **its own table**, not one polymorphic table, so every end keeps a foreign key.
All share one column shape, copied from the placement design that already works (0034, 0035):

```sql
-- Proposed, illustrative. The shape every link table shares.
--   <from>_id, <to>_id          real foreign keys
--   relation                    when one pair can be related more than one way
--   method                      how it was established: 'stated' | 'identifier' | 'rule:<name>' | 'manual'
--   confidence NUMERIC(4,3)     NOT NULL, no default
--   evidence_sha256             the artefact it was read from (NULL only for 'manual')
--   evidence_key                the page, fact id, matched text or 'decision:<id>'
--   valid_from, valid_to        when the relationship held, where the source says
--   dataset_version_id
-- plus a <link>_decision table and a history trigger, as 0035 and 0022 do.
```

| Edge (brief's name)                      | Link table                                                                               | Established from                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GOVERNMENT_HAS_DEPARTMENT                | `public_body.parent_body_id`                                                             | The body's own source (budget document, an official directory, an act)                    |
| (jurisdiction)                           | `public_body_jurisdiction`                                                               | Stated territory; LGD local-body codes for ULBs and PRIs                                  |
| DEPARTMENT_ADMINISTERS_SCHEME            | `programme_body`                                                                         | Programme guidelines, budget documents                                                    |
| (line belongs to programme)              | `budget_line_programme`                                                                  | A code or name the budget prints; name-only matches go to review                          |
| GOVERNMENT_TRANSFERS_FUNDS               | `fund_transfer` (a fact with two ends)                                                   | Transfer statements in budget and accounts documents                                      |
| DEPARTMENT_ISSUES_TENDER                 | `tender_body`                                                                            | The organisation chain verbatim (`tender.organisation_chain`)                             |
| SCHEME_FUNDS_PROJECT, PROJECT_LOCATED_IN | `work_budget_line`, `work.admin_unit_id` ○                                               | A works source                                                                            |
| TENDER_AWARDED_TO_CONTRACTOR             | `award` ○                                                                                | An award document                                                                         |
| DOCUMENT_SUPPORTS_ENTITY / _TRANSACTION  | Already: every row's `source_sha256`, `document_fact` page anchors; + `document_subject` | —                                                                                         |
| AUDIT_REVIEWS_EXPENDITURE                | `document_subject` with `relation = 'audits'`                                            | The report's own statement of scope (ADR-051: the issuing office is not the area audited) |

A `graph_edge` view unions the link tables into `(from_kind, from_id, relation, to_kind, to_id,
method, confidence, evidence_sha256, dataset_version_id)` for traversal and for the Money Trace.

### 6.3 Why not a graph database

The brief asks for this to be evaluated. Decision for now: **PostgreSQL only.**

- The Money Trace is a bounded walk of known depth (receipt → … → audit, at most ~12 hops along a
  fixed schema). Recursive CTEs over indexed link tables answer it; the closure-table pattern
  already answers the unbounded part (place).
- Every edge must carry evidence, confidence and a reviewer decision with history. That is a
  relational-integrity requirement, and the existing guarantees (CHECKs, FKs, column-scoped grants,
  triggers) would have to be rebuilt in a second store.
- One `datasetVersion` per payload (ADR-012, ADR-053) is trivial with one store and a cross-store
  consistency problem with two.

**Revisit when** a measured query the product needs (not a demo) exceeds its budget in
`15-scalability/` after indexing — most plausibly multi-hop party ↔ body traversal across states,
which is itself gated (§6.4). Record that measurement in an ADR before adding anything.

### 6.4 Parties (contractors) — evidence rules

A `party` row is created only when a published source names a firm. Identity rules, strongest first:

1. A registration number the source prints (e.g. a contractor registration in a state's
   enlistment list) — automatic.
2. The same name, issuer and registration class in one state's records — automatic within that
   state only.
3. Anything across states, or by name similarity — **review only**, recorded as a decision with the
   evidence a person relied on. No CIN or MCA join: none is published alongside procurement
   (`entity-linking.md`).

A party page carries no score, rank, badge, flag, concentration figure or Verification Priority
(`screen-data-matrix.md` §3).

---

## 7. Financial model

### 7.1 Budget line — the accounting coordinate

```sql
-- Proposed, illustrative.
CREATE TABLE budget_line (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_body_id     BIGINT NOT NULL REFERENCES public_body (id),  -- whose books
  direction          TEXT   NOT NULL CHECK (direction IN ('receipt', 'expenditure')),
  account_section    TEXT   CHECK (account_section IN ('revenue', 'capital', 'loans', 'public_account')),
  -- The source's own coordinates, verbatim and in order: demand, major head,
  -- sub-major, minor, sub-head, detailed head, object — whichever it prints.
  -- Never reconstructed from a name.
  coordinates        JSONB  NOT NULL,
  coordinates_scheme TEXT   NOT NULL,   -- e.g. 'mh-beams', 'union-dfg', 'lmmh'
  -- Normalised List of Major and Minor Heads codes where the source states them;
  -- NULL, not guessed, where it does not.
  major_head         TEXT,
  minor_head         TEXT,
  charged_voted      TEXT,              -- as published (0003's reasoning holds)
  admin_unit_id      BIGINT REFERENCES admin_unit (id),  -- only for geographically cut lines
  source_sha256      TEXT   NOT NULL REFERENCES source_artifact (sha256),
  dataset_version_id BIGINT NOT NULL REFERENCES dataset_version (id),
  UNIQUE (public_body_id, coordinates_scheme, coordinates)
);
```

Original classification is preserved by construction (`coordinates`), and normalised heads sit beside
it rather than replacing it. A line that is renamed keeps its identity; names live on the money facts
that state them. (BEAMS's scheme-wise export carries demand, scheme and object code; the major head is
reachable only through its drill-down pages — `beams-discovery.md` — so for BEAMS lines it is NULL
until collected.)

### 7.2 Money fact — one row per published figure

```sql
-- Proposed, illustrative.
CREATE TABLE money_fact (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  budget_line_id        BIGINT NOT NULL REFERENCES budget_line (id),
  measure               TEXT   NOT NULL,  -- 'budget', 'release_finance_dept', 'release_department',
                                          -- 'received', 'expenditure_recorded', 'expenditure_treasury',
                                          -- 'receipt', 'reappropriation', ...
  stage                 TEXT   NOT NULL CHECK (stage IN
                          ('budget_estimate', 'revised_estimate', 'supplementary',
                           'final_grant', 'provisional_actual', 'actual', 'as_reported')),
  fiscal_year           SMALLINT NOT NULL,             -- start year: 2024 = FY 2024-25
  from_month            SMALLINT, to_month SMALLINT,   -- NULL = the whole year
  amount_inr            NUMERIC(20,2),                 -- NULL = the source has the line, not the figure
  as_published_label    TEXT   NOT NULL,               -- the column or row heading, verbatim
  source_unit           TEXT   NOT NULL,               -- 'thousand', 'lakh', 'crore', 'rupee'
  published_on          DATE,                          -- the edition that stated it; NULL if unstated
  source_sha256         TEXT   NOT NULL REFERENCES source_artifact (sha256),
  page_number           INTEGER,                       -- required for PDF sources
  document_fact_id      BIGINT REFERENCES document_fact (id),
  extraction_method     TEXT   NOT NULL,
  parser_version        TEXT   NOT NULL,
  extraction_confidence NUMERIC(4,3) NOT NULL,         -- no default, as 0007
  linkage_confidence    NUMERIC(4,3) NOT NULL,
  dataset_version_id    BIGINT NOT NULL REFERENCES dataset_version (id),
  UNIQUE (budget_line_id, measure, stage, fiscal_year, from_month, to_month, source_sha256)
);
-- + money_fact_version written by trigger, as 0022 does for tenders.
```

Rules carried over unchanged from 0003–0005:

- **No CHECK that expenditure ≤ release ≤ allocation.** Published data breaks both; an inconsistency
  is an observation, not a rejected row.
- **Two assertions are never merged.** BEAMS's scheme-wise and department-wise reports disagree for
  some years; so will a budget document and the Finance Accounts. Each is its own row with its own
  source.
- **A variance is computed within one assertion.** Release and allocation variance pair facts that
  share a source artefact (or an explicitly reviewed pairing). Comparing two assertions is a
  _reconciliation_ — a different derived quantity with its own name, never a "variance".

### 7.3 Programme and funding pattern

```sql
-- Proposed, illustrative.
CREATE TABLE programme (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  official_code      TEXT,
  name_en            TEXT NOT NULL, name_local TEXT,
  programme_type     TEXT CHECK (programme_type IN
                       ('central_sector', 'centrally_sponsored', 'state', 'local', 'as_published')),
  type_as_published  TEXT,
  owner_body_id      BIGINT REFERENCES public_body (id),
  source_sha256      TEXT NOT NULL REFERENCES source_artifact (sha256),
  dataset_version_id BIGINT NOT NULL REFERENCES dataset_version (id)
);

CREATE TABLE programme_funding_pattern (       -- time-bound, source-backed, never hardcoded
  programme_id       BIGINT NOT NULL REFERENCES programme (id),
  applies_to         TEXT NOT NULL,            -- 'general', or a stated category of states
  admin_unit_id      BIGINT REFERENCES admin_unit (id),  -- when the source names a state
  funder_body_id     BIGINT NOT NULL REFERENCES public_body (id),
  share_pct          NUMERIC(5,2) NOT NULL CHECK (share_pct BETWEEN 0 AND 100),
  valid_from         DATE NOT NULL, valid_to DATE,
  source_sha256      TEXT NOT NULL REFERENCES source_artifact (sha256),
  page_number        INTEGER
);
```

A funding share is a figure, so it carries its document and page like any other. Shares that do not
sum to 100 across funders for a period are an observation, not a constraint violation.

`budget_scheme` is **not** renamed to `programme`. It is a budget line (BEAMS `scheme_code` within a
demand), and maps onto `budget_line`.

---

## 8. Revenue model

Receipts are budget lines with `direction = 'receipt'` and money facts with `measure = 'receipt'`.
No separate `tax_revenue` / `gst_revenue` / `excise_revenue` tables (as `database-design.md`
proposed): a receipt head is a coordinate in the same accounting classification, and one table per
tax would fix today's categories into the schema.

- **Categories as the source prints them.** A small normalised vocabulary sits beside the original
  (`tax`, `non_tax`, `grants_in_aid`, `share_of_central_taxes`, `borrowing_and_other_liabilities`,
  `recovery_of_loans`, `disinvestment`) and is set only where the source's own heading states it.
- **Borrowing is not revenue.** It is a capital receipt; it is classified as the accounts classify
  it, and no derived figure adds it to revenue.
- **Fiscal indicators** (revenue deficit, fiscal deficit, primary deficit) are taken **as the source
  states them**, as facts. The ledger may also derive them, but a derived deficit is shown beside the
  stated one, labelled as derived, with its formula — never in place of it. Definitions follow the
  publishing government's own, preserved per row.
- "Available resources = own revenue + transfers + borrowing + other receipts" is not computed until
  every term comes from one consistent assertion for the same government and period.

**Source status (7 October 2026).** India Budget (Union receipts, transfers to states) and CGA
(monthly accounts, Finance and Appropriation Accounts) are verified reachable, PDF-heavy, and have
**no recorded licence**. Maharashtra GRAS is reachable; terms not recorded. Whether state Finance
Accounts are published under the same CAG terms already recorded for audit reports was not
established in the sources reviewed. Each of these is the first task of its phase (§18).

---

## 9. Expenditure model

The chain BEAMS already holds, expressed generically:

```text
budget (BE) ─► revised (RE) ─► final grant ─► release (Finance Dept) ─► release (department)
            ─► expenditure recorded ─► expenditure in treasury ─► actual (accounts)
```

Each arrow is a pair of money facts on one budget line. The two required variances keep their
definitions (`analytics-engine.md` §1): release variance = release (department) − expenditure;
allocation variance = budget − expenditure; each with its denominator; `insufficient_data` where a
stage is unpublished.

Below the budget line, expenditure reaches a **work** only through a works source. None that may be
used was identified in the sources reviewed as of 7 October 2026: OMMAS holds it for rural roads and
is licence-blocked (`pmgsy-ommas-findings.md`); treasury and CGA data is by head and DDO, not by work.
Until then the Money Trace ends at the budget line, and says so.

---

## 10. Centre–state transfer model

```sql
-- Proposed, illustrative. A transfer is a money fact with two ends.
CREATE TABLE fund_transfer (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_body_id           BIGINT NOT NULL REFERENCES public_body (id),
  to_body_id             BIGINT NOT NULL REFERENCES public_body (id),
  mechanism_as_published TEXT   NOT NULL,  -- verbatim heading
  mechanism              TEXT,             -- 'tax_devolution', 'finance_commission_grant',
                                           -- 'css_central_share', 'central_sector', 'other_grant',
                                           -- 'loan' — set only where the heading states it
  programme_id           BIGINT REFERENCES programme (id),
  stage                  TEXT   NOT NULL,  -- as money_fact.stage
  fiscal_year            SMALLINT NOT NULL,
  amount_inr             NUMERIC(20,2),
  -- Whose books: the sender's statement and the receiver's are two assertions.
  asserted_by_body_id    BIGINT NOT NULL REFERENCES public_body (id),
  source_sha256          TEXT   NOT NULL REFERENCES source_artifact (sha256),
  page_number            INTEGER,
  extraction_method      TEXT   NOT NULL,
  parser_version         TEXT   NOT NULL,
  extraction_confidence  NUMERIC(4,3) NOT NULL,
  dataset_version_id     BIGINT NOT NULL REFERENCES dataset_version (id)
);
```

The decisive field is `asserted_by_body_id`. The Union's statement of what it transferred to a state
and the state's statement of what it received are separate records, often for different periods and
classifications. Showing both, and the reconciliation between them, is the feature; merging them
would hide exactly the difference a reader came to see.

Transfers onward (state → local body, state → implementing agency) use the same table. A transfer
to a local body attaches through `public_body_jurisdiction` to its LGD local-body code.

---

## 11. Provenance model

Unchanged in principle; extended to new tables. Every important number answers "where did this
come from" through this chain, all of which exists today except where marked:

```text
figure (money_fact / fund_transfer / published_fact)
  → source_artifact (sha256, source_url, retrieved_at, stored_in)        exists
  → artifact_sighting (discovered_from, listing facts, seen again when)  exists
  → document → document_page → page number → text-item rectangle         exists (PDF sources)
  → extraction_method + parser_version + extraction_confidence           + on money tables
  → published_on (edition) + stage (BE/RE/actual) + source_unit          + on money tables
  → link row → method, confidence, evidence, decision                    + generic, from 0034/0035
  → dataset_version (vintage) + ingestion_run (what the run did)         exists
  → source licence (SourceDescriptor, ADR-055)                           exists
```

Two additions:

- **A source-unit record.** Every money row states the unit the source printed. A thousands-vs-rupees
  slip understates by three orders of magnitude while looking plausible (`beams-discovery.md`).
- **A per-figure "last observed"**, derived from `artifact_sighting`, exposed in the API next to
  `retrieved_at`. No new column.

---

## 12. Geographic model

Kept: `admin_unit`, closure, boundaries, coverage. Added:

| Addition                                     | Why                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `admin_unit_level` value `division`          | Revenue divisions are how several states group districts                                             |
| Constituency levels, when collected from LGD | LGD publishes them; a separate tree (they do not nest in districts), linked by stated overlap only   |
| `public_body_jurisdiction`                   | A body's territory, distinct from where its office is and where its works are                        |
| `denominator` (population and other bases)   | Per-capita and per-unit figures stay withheld until a sourced denominator exists (ADR-044, ADR-045)  |
| `work.admin_unit_id` and a work-site point ○ | Only from a works source; never from the issuing office (0013) or the report's title (0027, ADR-051) |

Three location claims stay distinct everywhere: **issued by an office in** (tenders today), **filed
under** (documents today), **located in** (works, when they exist). A roll-up sums only figures whose
location claim is _located in_ or an explicit geographic budget cut; it never sums an office's
location as if it were a work's.

Data-quality statements of the kind the brief asks for ("92% confirmed, 6% inferred, 2% unresolved")
are already derivable for tenders from `district_source`, and should be published that way: by method,
each method named, rather than as one blended confidence.

---

## 13. Data acquisition architecture

Unchanged in structure: the pipeline in `maharashtra-tender-ingestion.md` §3 (discover → fetch →
extract → parse → normalise → resolve → publish) is the pipeline for every source. Additions:

- **Licence recorded at registration, not discovered at display.** A source enters
  `source-registry.json` with its terms recorded (or `unknown`, with the date checked) before its
  adapter is written. Loaders may collect an `unknown` source; the read path already withholds it.
- **PDF tables are the main path for money-in.** Budget and accounts documents are almost all PDF
  (`finance-portals.md` §Note on format). Money from a PDF enters as a candidate with a page anchor
  and goes through the existing review queue, as CAG figures do; a reviewed table row becomes
  `money_fact` rows. Scan-read figures stay candidates (ADR-072).
- **Proportionate infrastructure.** Postgres, R2, TypeScript workers, the GitHub Actions schedule.
  No queue or orchestrator until a measured volume needs one (`maharashtra-tender-ingestion.md` §1).

---

## 14. Source adapter architecture

Today each collector is bespoke. That was right for one source per domain; it stops being right at the
third money source. Extract the contract then — not earlier, so it is shaped by three real sources
rather than one guess.

```ts
// Proposed, illustrative. services/ingestion/src/sources/adapter.ts
export interface SourceAdapter<Discovered, Parsed> {
  /** Registry id; also the raw-store prefix and ingestion_run.source_id. */
  readonly sourceId: string;
  /** Recorded terms. 'unknown' collects but is never displayed. */
  readonly licence: SourceLicence;
  discover(since: Date | null): AsyncIterable<Discovered>; // robots.txt checked per run
  fetch(item: Discovered): Promise<RetainedArtifact | NotRetained>; // raw store before any row
  parse(artifact: RetainedArtifact): Promise<readonly Parsed[]>; // throws on an unexpected shape,
  //                                                                never "zero rows"
  toObservations(parsed: Parsed): readonly Observation[]; // typed, provenance attached
}

/** What adapters emit. Loaders are written per observation kind, once. */
export type Observation =
  | {
      readonly kind: "money_fact"; /* line coordinates, measure, stage, period, amount, unit, anchor */
    }
  | { readonly kind: "fund_transfer" /* ... */ }
  | { readonly kind: "public_body" /* ... */ }
  | { readonly kind: "tender" /* the existing tender loader */ }
  | { readonly kind: "document" /* the existing CAG path */ };
```

Rules:

- Adapters never import UI modules (ADR-059 rule D, already enforced).
- Source-specific facts (BEAMS's thousands, a portal's `sp` id, a demand-number format) stay inside
  the adapter. The observation carries the source's own coordinates and labels, never a
  source-specific type.
- One generic loader per observation kind owns idempotency, history and dataset-version stamping.
- Existing collectors are wrapped, not rewritten, when they next need changing.
- The empty scaffold directories in `services/ingestion/src/` should either receive this contract or
  be removed; they currently suggest a structure nothing follows.

---

## 15. Analytics architecture

- **Where:** SQL views and materialised views over the ledger, refreshed per dataset version. The
  client computes nothing (ADR-059 rule A).
- **Output contract:** every derived value carries a `class` (`fact` | `derived` | `attributed`), a
  formula id and version, the ids of its input facts, its denominator, and its dataset version.
  `analytics-engine.md` §Output contract is extended with `class`.
- **What may be derived:** both variances; roll-up gaps between levels (`analytics-engine.md` §10);
  reconciliations between two assertions; shares of a total within one assertion; ratios with a
  sourced denominator; concentration per scope. Growth rates across years only between figures at the
  same stage and classification.
- **What is never derived:** anything across a missing stage; a ratio without a sourced denominator;
  a correlation between spending and an outcome; any ordering of firms or people.
- **Profiles (state, body, programme, place, party)** are views over the same derived set, scoped to
  the entity a reader navigated to. Each shows its coverage first — what is held, what is not
  collected, what is withheld — before any figure.

---

## 16. Expansion strategy

The brief's five stages, revised for P1, P2 and P4. Ordered by what can be **published** soonest,
not by what is most interesting.

| Stage | Brief                               | Revised                                                                                                                                                                                                                                                                                                                   | Why                                                                                                                                                     |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Maharashtra PWD tenders, complete   | **The fiscal spine for Maharashtra from publishable sources.** `public_body` and links over what is held; record terms for India Budget, CGA and state Finance Accounts; if Finance Accounts are publishable under CAG's terms, load Maharashtra's. Agency tender notices continue per `maharashtra-tender-ingestion.md`. | PWD tenders are robots-blocked; BEAMS is withheld. Finance Accounts, if their terms match CAG's, would be the first publishable money source.           |
| 2     | Maharashtra infrastructure agencies | **More Maharashtra agencies** (MMRDA, MSRDC, MEDA … per `maharashtra-tender-ingestion.md` Phase H), and the Work layer if a works list is publishable.                                                                                                                                                                    | Unchanged in substance; it was already planned.                                                                                                         |
| 3     | Maharashtra government-wide graph   | **Union receipts and transfers to states**, once terms are recorded. Connects the Union to Maharashtra's receiving side.                                                                                                                                                                                                  | Moved earlier: the transfer edge is the brief's central feature and needs only budget documents.                                                        |
| 4     | Union government                    | **Other states' Finance Accounts.** One document template, every state.                                                                                                                                                                                                                                                   | Scales by template, not by portal: the state-level spine for every state before any one state's procurement.                                            |
| 5     | Other states, selectively           | **Permission-dependent layers**, in whichever order answers arrive: BEAMS figures, tender details, OMMAS works. Each is one flag or one collector once permitted.                                                                                                                                                         | Whether and when to send the drafted requests is the project's decision (`2026-09-25-seven-decisions.md`); the architecture is ready for either answer. |

Not built at any stage: nationwide scraping, a global feed, any ranking, any score on a firm or
person, AI-written conclusions, a graph database without a measured need (§6.3).

---

## 17. Migration plan

All additive. Numbers are indicative; each lands with tests and, where it changes a decision, an ADR.

| #     | Migration (proposed)                                                                                   | Backfill                                                                                                                         | Reversible by                                        |
| ----- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| M1    | `public_body`, `public_body_identifier`, `public_body_name` (dated), `public_body_jurisdiction`        | One body per `department` row (BEAMS code as an identifier, scheme `mh-beams`); Government of Maharashtra and the Union as roots | Dropping new tables                                  |
| M2    | `department.public_body_id` (nullable FK)                                                              | From M1                                                                                                                          | Dropping the column                                  |
| M3    | `tender_body` link (+ decision, history)                                                               | Rule: exact match of the chain's first segment to a body name of that state; the rest to review                                  | Dropping the table                                   |
| M4    | `budget_line`, `money_fact`, `money_fact_version`                                                      | None. BEAMS stays in its tables                                                                                                  | Dropping new tables                                  |
| M5    | `money_fact_all` **view**: `money_fact` ∪ BEAMS tables reshaped (stage `as_reported`, unit `thousand`) | —                                                                                                                                | Dropping the view                                    |
| M6    | `programme`, `programme_funding_pattern`, `programme_body`, `budget_line_programme`                    | None until a programme source is loaded                                                                                          | Dropping new tables                                  |
| M7    | `fund_transfer`                                                                                        | None                                                                                                                             | Dropping the table                                   |
| M8    | `document_subject` (document ↔ body / programme / place, with relation and method)                     | `document.admin_unit_id` rows copied with their `geography_source` as method                                                     | Dropping the table                                   |
| M9    | `graph_edge` view                                                                                      | —                                                                                                                                | Dropping the view                                    |
| M10   | `denominator`; `admin_unit_level` += `division`                                                        | Only from a recorded source                                                                                                      | Enum values cannot be dropped; add only when loading |
| later | `work`, `award`, `party`, `party_name`                                                                 | Only when a permitted source exists                                                                                              | —                                                    |

The existing BEAMS tables are **not migrated into `money_fact`** until there is a reason (for
example, retiring the `scheme_finance_variance` view in favour of a generic one). The view in M5 gives
analytics one surface without touching working data.

Production follows the existing runbook: migrations applied by hand with the owner credential
before a release that needs them; nothing in CI touches production.

---

## 18. Implementation phases

Each phase ends with something a reader can see, or with a recorded reason it cannot be shown.

| Phase | Work                                                                                                                                           | Exit criterion                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 0     | Accept this document (ADR); correction notice on `database-design.md`; declare the fiscal-year convention as the ledger's in `packages/domain` | No document describes a schema the ledger forbids                                                              |
| 1     | Record terms for India Budget, CGA, state Finance Accounts, GRAS (`source-licences.md`; fetched, not recalled; two network channels)           | Each has a licence entry, or `unknown` with the date checked                                                   |
| 2     | M1–M3, M8: public bodies; link BEAMS departments, tender organisation chains and document issuers                                              | Every tender's department resolves to a body or sits in review; body pages list what is held about them        |
| 3     | M4–M5, M9: money facts and the union view; first PDF money adapter (whichever Phase 1 source is publishable)                                   | One publishable money source on a unit or body page, both variances where stages exist, provenance to the page |
| 4     | M6–M7: programmes and transfers, from Union budget documents                                                                                   | The Union → Maharashtra transfer edge shown with both assertions where both are held                           |
| 5     | Extract `SourceAdapter` from the three money adapters; wrap BEAMS                                                                              | A fourth source added without a new loader                                                                     |
| 6     | Money Trace page over `graph_edge`: every hop shown, missing hops named with the source that would fill them                                   | A trace from a budget line back to receipts and forward to tenders, with no hop implied that is not held       |
| 7     | Other states' Finance Accounts                                                                                                                 | The state spine for N states, with coverage stated per state                                                   |
| —     | Permission-dependent: BEAMS figures, tender details, OMMAS (works), award data                                                                 | Each enabled by its flag or collector when, and only when, permission is recorded                              |

### Money Trace — what each hop can show today

| Hop                                          | Status, 7 October 2026                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Union receipts                               | Source reachable (India Budget, CGA); terms not recorded; not collected                   |
| Union → state transfers                      | Same                                                                                      |
| State receipts                               | Maharashtra GRAS reachable, terms not recorded; state Finance Accounts not yet examined   |
| State budget → department → line             | Held for Maharashtra (BEAMS), withheld pending permission                                 |
| Allocation → release → expenditure, per line | Held for Maharashtra (BEAMS), withheld                                                    |
| Line ↔ programme (e.g. a CSS)                | No published mapping identified in the sources reviewed                                   |
| Expenditure → work                           | No usable source; OMMAS (rural roads) licence-blocked                                     |
| Work ↔ tender                                | Join not identified (`entity-linking.md`, Join 1)                                         |
| Tender (advertised)                          | Held: 21 portals, details withheld (ADR-056); Maharashtra via MHADA and MSIDC, local only |
| Tender → award → party                       | CAPTCHA-gated; not held                                                                   |
| Contract → payment                           | Not identified in the sources reviewed                                                    |
| Work → asset → outcome                       | Not identified in the sources reviewed                                                    |
| Audit                                        | Held and published: 30 CAG reports, 5,088 reviewed figures (ADR-070)                      |

That table is the honest shape of the product today, and the Money Trace page should render it as it
stands. A trace that names its gaps serves a reader better than one that draws edges the ledger
cannot support.
