# Maharashtra Tender Ingestion — Architecture and Backlog

**Date:** 2026-09-30 · **Status:** Proposed — a specification for implementation; no code yet.
**Evidence:** [`../06-government-sources/maharashtra-tenders/maharashtra-tender-data.md`](../06-government-sources/maharashtra-tenders/maharashtra-tender-data.md) (research) · [`../06-government-sources/maharashtra-tenders/maharashtra-sources.md`](../06-government-sources/maharashtra-tenders/maharashtra-sources.md) (inventory).

> MahaTenders and PWD's NIT system both serve `robots.txt: Disallow: /`. This design collects Maharashtra tender notices from the **agencies that issue them**, on hosts that permit it, and treats MahaTenders as an identifier namespace and a link target — so that no single site's CAPTCHA or crawl policy can remove LokDarpan's view of Maharashtra procurement.

---

## 1. Design principles

1. **Reuse, don't build in parallel.** LokDarpan already has an immutable raw store (R2 + `source_artifact`, ADR-069), page-level document facts with human review (`document`, `document_page`, `document_fact`, ADR-068), a versioned tender (`tender`, `tender_version`), collection windows, a freshness alert and a nightly scheduled job. Maharashtra ingestion is a set of **adapters** on that machinery, not a new pipeline.
2. **Discovery is not authority.** A listing row, a search result or an aggregator says a document exists; only the issuer's document is evidence. Both are recorded, separately.
3. **Every observation is kept.** The canonical tender is derived; observations are never overwritten or deleted.
4. **Stricter than the web's defaults.** `robots.txt` is read on every run; a disallowed path is never fetched; a policy that cannot be read is a refusal (as `permitsCrawling` already treats it).
5. **Proportionate.** PostgreSQL, R2, TypeScript workers in `services/ingestion`, the existing GitHub Actions schedule. No queue, cluster or orchestration layer until volume demands one: the whole Maharashtra backfill is a few thousand documents.

## 2. What exists and is reused

| Need                          | Existing piece                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bounded, retrying HTTP        | `services/ingestion/src/net/fetch-with-limits.ts` (`fetchWithLimits`, `RETRY_IDEMPOTENT`)                                                                      |
| Per-kind size and time limits | `net/limits.ts` (`ROBOTS_TXT`, `CAG_REPORT`, …)                                                                                                                |
| `robots.txt` evaluation       | `gepnic/fetch.ts` → `permitsCrawling` (whole-host `Disallow: /` only — extended by `MHA-TENDER-003`)                                                           |
| Immutable bytes               | `raw-store.ts` (`retain`, `putArtifact`, `ObjectRawStore` → R2, `sha256Of`, `storagePathFor`)                                                                  |
| Artifact record               | `source_artifact(sha256, source_id, source_url, retrieved_at, byte_size, storage_path, stored_in)`                                                             |
| PDF text and glyph check      | `cag/extract.ts` (`extractDocument`, `glyphSubstitution`, `scriptOf`)                                                                                          |
| OCR                           | `services/ocr` (Python) and `ingestion/src/ocr/client.ts`                                                                                                      |
| Document and page             | `document` (`doc_type`, `issuing_authority`, `published_on`, `admin_unit_id`, `extraction_method`), `document_page`                                            |
| Page-level facts and review   | `document_fact` (`page_number`, `raw_text`, `normalised_value`, `parser_version`, `extraction_confidence`, `verification_status`, `verified_by`) and `review/` |
| Canonical tender and history  | `tender`, `tender_version` (migration 0022), `detail_sha256` (0038)                                                                                            |
| Collection floor              | `tender_collection_window(portal_code, collecting_since, last_success_at, last_checked_at, state_lgd_code)`                                                    |
| District placement            | ADR-067 (`district_source`), ADR-068 (`tender_district_decision`)                                                                                              |
| Run log, freshness alert      | `ingestion-run.ts`, `freshness/assess.ts`                                                                                                                      |
| Schedule                      | The nightly tender job (20:00 UTC; [`../06-government-sources/tender-collection-cadence.md`](../06-government-sources/tender-collection-cadence.md))           |

## 3. Pipeline

```text
                         SOURCE LAYER (permitting hosts only)
  MHADA listing · MSIDC listing · MMRDA archive · MSRDC · MEDA · DGIPR · PWD documents
  [PWD NIT, MahaTenders: only after written permission — never before]
                                   │
                                   ▼
  1 DISCOVER   adapter.discover(since)
               · read robots.txt (every run) → path-aware permit check
               · fetch listing page(s), stop at the first row already seen
               · emit DiscoveredArtifact { url, discovered_from, listing_row_facts }
                                   │
                                   ▼
  2 FETCH      adapter.fetch(artifact)
               · conditional GET (If-None-Match / If-Modified-Since where the host sends validators)
               · SHA-256 of the bytes; unchanged → record a sighting and stop
               · new → retain() to R2 → source_artifact row
               · artifact_sighting { sha256, url, discovered_from, seen_at, etag, last_modified }
                                   │
                                   ▼
  3 EXTRACT    PDF: extractDocument (text, script, glyph check)
               image-only or glyph-substituted pages → OCR; pages_without_text counted
               HTML listing rows: parsed directly, kept as Tier-2 facts
               → document + document_page (doc_type per §6)
                                   │
                                   ▼
  4 PARSE      a notice parser per issuer template, versioned (mh-mhada-notice-v1 …)
               → document_fact rows: reference, notice number, GePNIC id, published_on,
                 deadline, opening, estimated value, EMD, fee, place, work title —
                 each with page_number, raw_text and confidence
                                   │
                                   ▼
  5 NORMALISE  dates → timestamptz (Asia/Kolkata); ₹ → paise as decimal strings (@lokdarpan/money);
               Devanagari digits → ASCII; references → a canonical form for matching
                                   │
                                   ▼
  6 RESOLVE    tender_observation (one per document × tender it describes)
               → identity rules (§5) → canonical tender (insert or attach)
               → tender_version on any field change
               → place: a district only when stated (ADR-067); otherwise review (ADR-068)
                                   │
                                   ▼
  7 PUBLISH    dataset_version bump → read-only API → site
               display: ADR-056 (linked, not reproduced) until each agency's terms are reviewed
```

## 4. Schema changes (proposed)

Additive only. Each becomes a numbered migration with tests when its backlog item is taken up.

```sql
-- 4.1  How an artifact was found, kept apart from what it is (discovery ≠ authority).
CREATE TABLE artifact_sighting (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sha256             TEXT NOT NULL REFERENCES source_artifact (sha256),
  source_url         TEXT NOT NULL,     -- where the bytes were fetched
  discovered_from    TEXT,              -- the listing or search page that pointed to it
  seen_at            TIMESTAMPTZ NOT NULL,
  http_status        SMALLINT NOT NULL,
  http_etag          TEXT,
  http_last_modified TEXT
);

-- 4.2  Document kinds seen in Maharashtra sources.
ALTER TYPE document_type ADD VALUE 'corrigendum';
ALTER TYPE document_type ADD VALUE 'expression_of_interest';
ALTER TYPE document_type ADD VALUE 'auction_notice';
ALTER TYPE document_type ADD VALUE 'works_list';
ALTER TYPE document_type ADD VALUE 'performance_budget';

-- 4.3  Fact kinds a notice carries (existing: monetary_amount, contractor_reference,
--      officer_role_reference, work_reference).
ALTER TYPE fact_kind ADD VALUE 'tender_identifier';  -- GePNIC id, issuer reference, notice number
ALTER TYPE fact_kind ADD VALUE 'tender_date';        -- published / deadline / opening; role in normalised_value
ALTER TYPE fact_kind ADD VALUE 'place_reference';    -- district, taluka, village, road + chainage, as stated

-- 4.4  Every identifier a tender is known by, each tied to the fact that states it.
CREATE TABLE tender_identifier (
  tender_id        BIGINT NOT NULL REFERENCES tender (id),
  scheme           TEXT NOT NULL CHECK (scheme IN ('gepnic', 'issuer_reference', 'issuer_notice_number')),
  issuer           TEXT NOT NULL DEFAULT '',  -- scope for non-global schemes; '' for gepnic
  value            TEXT NOT NULL,             -- as printed
  normalised_value TEXT NOT NULL,             -- ASCII digits, canonical separators
  document_fact_id BIGINT REFERENCES document_fact (id),
  PRIMARY KEY (scheme, issuer, normalised_value)
);

-- 4.5  One row per (document, tender): the evidence behind a canonical tender.
CREATE TABLE tender_observation (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tender_id        BIGINT NOT NULL REFERENCES tender (id),
  document_id      BIGINT NOT NULL REFERENCES document (id),
  source_tier      SMALLINT NOT NULL CHECK (source_tier BETWEEN 1 AND 4),
  matched_by       TEXT NOT NULL,             -- the identity rule that attached it (§5)
  match_confidence NUMERIC(4, 3) NOT NULL,
  observed_at      TIMESTAMPTZ NOT NULL,
  UNIQUE (tender_id, document_id)
);
```

**`tender` itself is unchanged.** For agency sources, `portal_code` is the registry source id (`mh-mhada-tenders`) and `portal_tender_id` the issuer-scoped identity (§5 rule 2 or 3), so the existing uniqueness, versioning and placement rules apply as they stand. `tender_collection_window` gets one row per agency source with `state_lgd_code = '27'`. That changes Maharashtra's "not collected" state on the site for exactly the agencies covered — so the copy must then name the issuers covered, and never imply MahaTenders is.

## 5. Canonical identity

Applied in order. The first rule that matches wins, and the rule is recorded in `tender_observation.matched_by`:

| #   | Rule                                                         | Automatic?                            |
| --- | ------------------------------------------------------------ | ------------------------------------- |
| 1   | Same GePNIC tender ID (normalised)                           | Yes                                   |
| 2   | Same issuer + issuer reference (normalised)                  | Yes                                   |
| 3   | Same issuer + notice number + financial year                 | Yes                                   |
| 4   | Same issuer + normalised title + publication date + deadline | Yes, only if all four match exactly   |
| 5   | Title similarity within one issuer and ±30 days              | **No** — a review candidate (ADR-068) |

A notice listing several works yields several tenders only when the notice gives each work its own tender number; otherwise it is one tender whose works are recorded as `work_reference` facts. The Work entity (road number + chainage + CRIF job number, from PWD works lists) is a separate, later model; tenders link to it through facts, never by title.

## 6. Document types by source

| Source        | Listing (Tier 2)        | Documents (Tier 1)                                    |
| ------------- | ----------------------- | ----------------------------------------------------- |
| MHADA         | Table row               | `tender_notice`, `corrigendum`, `auction_notice`      |
| MSIDC         | Table row               | `tender_notice`, `expression_of_interest`             |
| MMRDA archive | Table row (type column) | `tender_notice`, `corrigendum`                        |
| MSRDC         | Table row               | Unknown (detail pages not examined)                   |
| MEDA          | Row                     | `tender_notice` (quotations, EOIs)                    |
| DGIPR         | Row (type column)       | `tender_notice` via OCR; non-procurement rows skipped |
| PWD documents | Category page           | `works_list`, `performance_budget`                    |

## 7. Scheduling, change detection, retries

| Source        | Cadence (within the nightly job) | Incremental stop                   | Backfill                                   |
| ------------- | -------------------------------- | ---------------------------------- | ------------------------------------------ |
| MHADA         | Nightly                          | The first listing row already seen | 455 pages, ≥2 s apart, over several nights |
| MSIDC         | Nightly (one page)               | Row-set diff                       | None needed                                |
| MMRDA archive | Weekly                           | The first known row                | 21 pages                                   |
| MSRDC, MEDA   | Weekly                           | The first known row                | Full listing once                          |
| DGIPR         | Weekly                           | The first known row                | —                                          |
| PWD documents | Monthly                          | Listing diff                       | All files once                             |

- **Change detection.** Listing changes (closing date, title) are re-read as facts. A PDF change is detected by SHA-256: a new artifact and document, with the old kept. `ETag` and `Last-Modified` are stored, and used for conditional requests where hosts send them (measured per host in `MHA-TENDER-004`).
- **Retries.** `RETRY_IDEMPOTENT` (bounded, with backoff). A failing source records `last_checked_at` without `last_success_at`; the existing freshness assessment turns that into `failing` and alerts. One source failing never stops the others.
- **Rate.** Sequential per host, ≥1 s between requests (≥2 s for backfills), identifying user agent with a contact URL.

## 8. Observability

- One `ingestion_run` per source per night: pages read, artifacts new or unchanged, facts extracted, parse failures, robots status.
- Parser yield per run (facts per document). A source that yielded before and now yields nothing is a failed run, never "no tenders".
- Review-queue depth, for low-confidence facts and identity candidates.
- The site states, per issuer, when collection began (`tender_collection_window.collecting_since`), so absence before that date reads as "not collected", never "nothing advertised".

## 9. Failure handling

See §35 of the research document. In short: unreachable → retry and record; robots change → stop that source; layout change → failed run; replaced PDF → new version; scan → OCR; failed OCR or glyph substitution → review; conflicting values → both kept, Tier 1 wins, conflict flagged; missing district → unknown.

---

## 10. Backlog

Each item: **Goal · Dependencies · Expected output · Acceptance criteria · Risks.** Sized to one PR each.

### Phase A — Registry and permissions

**MHA-TENDER-001 — Register the Maharashtra sources with evidence**

- Goal: every source in the inventory has a registry row with its robots status, verification date and usage.
- Dependencies: none.
- Output: rows in `.docs/06-government-sources/source-registry.{csv,json}` for sources 1–14 of the inventory.
- Acceptance: the registry's existing checks pass; `mahapwd.gov.in` and `mahatenders.gov.in` are recorded as `Disallow: /` with their evidence files.
- Risks: the registry schema may lack fields for tier and usage — extend it, with its test, in the same PR.

**MHA-TENDER-002 — Request permission from PWD for the NIT system**

- Goal: a written request to PWD for automated collection of `mahapwd.gov.in/nit/`, at a stated rate, with attribution.
- Dependencies: none.
- Output: a draft beside the existing ones, and an entry in `permission-requests.json` (checked by its test).
- Acceptance: the draft is reviewed; the send is recorded with a date once the owner sends it. LokDarpan does not collect from the host before a reply.
- Risks: no reply. The agency route (Phases B–H) does not depend on it.

**MHA-TENDER-003 — Path-aware robots check**

- Goal: an adapter can ask "may I fetch this path on this host?" and get an answer at least as strict as `permitsCrawling`.
- Dependencies: none.
- Output: `net/robots.ts`, a pure evaluator (wildcard group, longest-match `Allow`/`Disallow`, an unreadable policy is a refusal); `permitsCrawling` becomes a call to it.
- Acceptance: unit tests built from the real files collected on 2026-09-30 (MMRDA, MHADA, MEDA, CIDCO, `mahapwd.gov.in`, `mahatenders.gov.in`); every existing GePNIC test still passes.
- Risks: a looser reading than today's slipping in — the tests assert that every file refused before is still refused.

### Phase B — First adapters and raw storage

**MHA-TENDER-004 — Adapter contract and `artifact_sighting`**

- Goal: the adapter interface (§3) and the sighting table that keeps discovery apart from authority.
- Dependencies: 003.
- Output: `services/ingestion/src/sources/states/maharashtra/adapter.ts`; the `artifact_sighting` migration; conditional-GET support, measured per host.
- Acceptance: an integration test fetches a fixture twice and records one artifact and two sightings.
- Risks: over-design — keep the interface to its five methods.

**MHA-TENDER-005 — MHADA listing adapter**

- Goal: discover MHADA notices and retain their PDFs.
- Dependencies: 004.
- Output: `MhadaTenderAdapter` (listing → rows → PDFs to R2 → `document`).
- Acceptance: against saved fixtures of `?page=0` and `?page=454`, every row yields a discovered artifact with its listing facts; a live run of page 0 stores the day's PDFs with `stored_in = s3://…`.
- Risks: Drupal markup changes; the parser fails loudly (zero rows is a failed run).

**MHA-TENDER-006 — MSIDC listing adapter**

- Goal: the same for MSIDC.
- Dependencies: 004.
- Output: `MsidcTenderAdapter`.
- Acceptance: all 290 rows of a saved fixture parse; rows whose deadline precedes publication are kept and flagged, not corrected.
- Risks: the listing's own date errors — never "fix" them from the listing; the PDF decides (008).

### Phase C — Extraction and normalisation

**MHA-TENDER-007 — Notice text extraction with glyph and scan detection**

- Goal: every notice PDF becomes `document` + `document_page`, with script, glyph substitution and image-only pages detected.
- Dependencies: 005, 006.
- Output: reuse of `extractDocument`; an OCR hand-off for image-only pages.
- Acceptance: MSIDC fixtures extract as `latin`; a DGIPR scan is routed to OCR; the PWD works list is flagged for glyph substitution.
- Risks: OCR quality on Marathi scans; low-confidence facts stay unpublished.

**MHA-TENDER-008 — Notice parsers (MHADA, MSIDC)**

- Goal: page-level facts from each notice: identifiers, dates, value, EMD, fee, place, work.
- Dependencies: 007; the enum additions of §4.2–4.3.
- Output: `mh-mhada-notice-v1` and `mh-msidc-notice-v1`, writing `document_fact` rows.
- Acceptance: on at least 20 fixture notices per issuer, every extracted value carries its page and raw text; a hand-checked sample shows no wrong value published (unverified facts stay in review).
- Risks: templates drift between years; parser versions are recorded, so re-parsing from R2 is always possible.

**MHA-TENDER-009 — Normalisation**

- Goal: IST timestamps, paise as decimal strings, ASCII digits, canonical references.
- Dependencies: 008.
- Output: pure functions with tests; `@lokdarpan/money` for amounts.
- Acceptance: property tests for the digit and date forms seen in fixtures (`30 September 2026`, `6 July-2026 at 12:00 PM`, `15-Mar-2024 at 3.00 PM`, `२६-२७/५८`).
- Risks: ambiguous dates — a date that cannot be read unambiguously is left null, never guessed.

### Phase D — Provenance and identity

**MHA-TENDER-010 — `tender_identifier` and `tender_observation`**

- Goal: canonical tenders built from observations, with identifiers tied to their evidence.
- Dependencies: 008, 009.
- Output: the migrations of §4.4–4.5; a resolver implementing rules 1–4.
- Acceptance: integration tests — a listing row and its PDF resolve to one tender with two observations; two notices with the same issuer reference in different years stay two tenders.
- Risks: reference collisions across years — rule 2 folds the financial year into the key.

**MHA-TENDER-011 — Place from stated evidence**

- Goal: a district set only when a notice states it, with `district_source`.
- Dependencies: 010; ADR-067.
- Output: `place_reference` facts → LGD match → `admin_unit_id` with `district_source = 'stated_district'` (a new value, with an ADR-067 addendum).
- Acceptance: MSIDC's "Dist. Chandrapur" places in Chandrapur; a MHADA board name never produces a district.
- Risks: the new `district_source` value needs its ADR addendum in the same PR.

### Phase E — Deduplication and review

**MHA-TENDER-012 — Candidate matching and the review queue**

- Goal: rule-5 candidates go to the existing review CLI and are never merged automatically.
- Dependencies: 010.
- Output: candidate generation and a `review/` extension.
- Acceptance: a merge made in review records who decided and when; a rejected candidate is not proposed again.
- Risks: review load — candidates are capped and prioritised by value.

### Phase F — Backfill

**MHA-TENDER-013 — MHADA backfill 2016→**

- Goal: all 455 listing pages and their PDFs.
- Dependencies: 005–010.
- Output: a resumable backfill command, ≥2 s between requests, spread over several nights.
- Acceptance: a checkpointed run can stop and resume without refetching; the listing count matches the rows stored.
- Risks: server load — throttled, off-peak, and stopped on any burst of 429 or 5xx responses.

**MHA-TENDER-014 — MMRDA archive**

- Goal: the 21 archive pages and their PDFs (MSIDC's history is already on one page).
- Dependencies: 004.
- Output: `MmrdaArchiveAdapter`.
- Acceptance: every archive row stored with its PDF; corrigenda typed as `corrigendum`.
- Risks: the current MMRDA list is script-rendered — only the archive is used until a server-rendered current list is confirmed.

### Phase G — Freshness

**MHA-TENDER-015 — Nightly incremental runs and alerting**

- Goal: Maharashtra sources in the nightly job, with collection windows and freshness alerts.
- Dependencies: 005, 006.
- Output: schedule entries; `tender_collection_window` rows (`state_lgd_code = '27'`, one per source).
- Acceptance: a source failing two nights running raises the existing alert; the site's Maharashtra tender copy names the issuers covered.
- Risks: copy implying MahaTenders coverage — the change passes through `copy/` and the neutrality gate.

### Phase H — More agencies and the Work layer

**MHA-TENDER-016 — MSRDC and MEDA adapters**

- Goal, output and acceptance as 005, per source. Risks: MSRDC detail pages are unexamined.

**MHA-TENDER-017 — DGIPR adapter with OCR**

- Procurement rows only (type column containing "निविदा"); OCR confidence gates publication.

**MHA-TENDER-018 — PWD works lists and performance budgets**

- Goal: PWD `works_list` and `performance_budget` documents with page-level facts.
- Dependencies: 007 (glyph handling).
- Output: `PwdDocumentsAdapter`; a works-list parser once the numeric columns are identified.
- Acceptance: column meanings confirmed from a page image or from PWD before any numeric fact is published; road number + chainage extracted as `place_reference`.
- Risks: unlabelled columns — **no amount is shown until its meaning is established**.

**MHA-TENDER-019 — MSEDCL, MIDC, CIDCO, Maha Metro**

- Examine each surface (robots, a server-rendered list, documents) and write an adapter only where a public listing exists. For MSEDCL, ask for a feed rather than reading its list's data endpoint.

### Phase I — Permission-dependent enrichment

**MHA-TENDER-020 — PWD NIT adapter (only if permitted)** — blocked on 002; built to the terms of the permission, rate included.

**MHA-TENDER-021 — MahaTenders enrichment (only if permitted)** — blocked on the MahaTenders request. Until then, GePNIC IDs found in notices are stored (010) and linked.

### Cross-cutting

**MHA-TENDER-022 — Terms-of-use review per agency (⚖)**

- Goal: what each agency's site terms allow LokDarpan to display.
- Output: an entry per source in `source-licences.md`.
- Acceptance: display rules recorded per source before any agency tender detail is shown on the site.
- Risks: silent or unclear terms — then link and cite only (the ADR-056 posture).

**MHA-TENDER-023 — Coverage measurement**

- Goal: an honest statement of what the agency sources cover.
- Output: per-issuer counts over time. No percentage of "all Maharashtra tenders" until a permitted denominator exists.
