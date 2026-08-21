# 03 — Data Collection Architecture

The collection layer turns heterogeneous official artifacts (APIs, CSV/XLS, digital PDFs, scanned PDFs) into a clean, versioned, provenance-stamped ledger. Its contract: **never fabricate, never infer a missing value, always record where a value came from and how confident we are in it.**

## Source registry

Every source is declared in a versioned registry (config, not code) so connectors are data-driven.

```yaml
# sources/mh-pwd-works.yaml
id: mh_pwd_works
name: Maharashtra PWD — Works / Physical Progress
authority: Government of Maharashtra, PWD
tier: state
domain: roads
access:
  type: scrape            # api | csv | xls | pdf | scrape
  base_url: "https://mahapwd.gov.in/..."   # confirm at implementation
  robots_respected: true
  cadence: "0 2 * * *"    # cron
license: "Government Open Data (verify per portal)"
keys: [work_id, district_code, financial_year]
fields_map:                # source field -> canonical field
  Work Name: project_name
  Sanctioned Amount: allocation_amount
  Expenditure: expenditure_amount
confidence_default: 1.0    # digital source
```

Registry entries exist for each approved source (data.gov.in, India Budget Portal, CAG, NDAP, MH Open Data, MH PWD, MH Finance, Mahatenders, ministry portals). Exact URLs/dataset IDs are filled in during implementation and version-controlled.

## Ingestion methods

### 1. API collection (preferred)
For portals exposing APIs (e.g. data.gov.in datasets, NDAP): typed client, API-key handling via secrets, pagination, ETag/If-Modified-Since where supported. Response stored raw before parsing.

### 2. Structured file collection (CSV/XLS)
Budget and open-data files: downloaded to the object store by content hash, then parsed with pandas/DuckDB. Sheet/column maps live in the source registry.

### 3. Web scraping (only where no API/file exists)
- **Playwright** (headless) for JS-rendered portals; **requests + selectors** for static HTML.
- **Politeness:** respect `robots.txt`, throttle per-domain, randomized delays, off-peak scheduling, identifiable user agent. Scraping is scheduled and cached — **never** triggered by a public request.
- Only public, non-authenticated government pages are scraped.

### 4. PDF extraction
- **Digital PDFs** (most budget/demand-for-grants documents): text and tables extracted with `pdfplumber` / `Camelot` (lattice & stream) / `tabula`.
- Table structure validated against expected columns from the registry; extraction that fails structure checks is quarantined for review, not silently loaded.

### 5. OCR (scanned PDFs / images)
- **Tesseract** (with Indic language packs where documents are in Marathi/Devanagari) and, where needed, layout-aware OCR.
- Each OCR'd number carries an **extraction confidence** (0–1). Values below a threshold are flagged `low_confidence` and surfaced to the user as such — never presented as certain.
- Amounts are re-checked with sanity rules (digit grouping, lakh/crore consistency) before acceptance.

## Processing pipeline

```text
raw artifact (immutable, sha256) 
   → PARSE (method-specific) 
   → VALIDATE (schema/type/range/cross-field) 
   → NORMALIZE (units/names/geo/FY) 
   → DEDUPE (natural key + fuzzy) 
   → LOAD (upsert + provenance + confidence + version) 
   → DERIVE (analytics/anomaly/risk)
```

### Validation
- **Schema:** required fields present; types correct.
- **Range/sanity:** amounts ≥ 0; percentages 0–100; dates plausible; FY well-formed.
- **Cross-field consistency:** e.g. `utilized ≤ released` and `released ≤ allocation` **expected**. Violations are **recorded as anomalies** (see [06](./06-Analytics-Engine.md)) — the load still proceeds so the public sees the real, inconsistent figures with a flag. We report the inconsistency; we do not "fix" the government's numbers.
- **Checksums:** artifact hash stored; row counts reconciled against source where the source states a total.

### Normalization
- **Currency/units:** everything converted to a canonical `amount_inr` (numeric, in ₹) plus a display helper for crore/lakh. Mixed-unit source cells are parsed explicitly (e.g. "12.50 Cr" → 125000000).
- **Entity canonicalization:** contractor and department names are messy across sources. A canonicalization step maps raw strings to canonical entity IDs using deterministic rules + fuzzy matching (see dedup). Unmatched names create a new candidate entity flagged for review.
- **Geo:** districts/talukas mapped to official LGD (Local Government Directory) codes; geometries via PostGIS.
- **Financial year:** normalized to `FY_YYYY_YYYY`.

### Deduplication
- **Natural keys** per entity (e.g. `tender_id`, `work_id`, `scheme_code + FY + district`).
- **Fuzzy matching** (token-set ratio / trigram) for entity names and near-duplicate rows; matches above a high threshold auto-merge, mid-range go to a review queue, low stay separate.
- Dedup **never deletes** — it links duplicates and marks a canonical record, preserving all sources.

## Retry, versioning, error handling

### Retry mechanisms
- Queue-level (BullMQ) exponential backoff with jitter; max attempts per stage; **dead-letter queue** for exhausted jobs.
- Network/portal transient errors retried; structural failures (schema mismatch) routed to quarantine, not retried blindly.
- Per-source circuit breaker: repeated failures pause that source and raise an alert instead of hammering it.

### Versioning (first-class)
- **Raw artifacts** are immutable and content-addressed (sha256); nothing is overwritten.
- **Canonical rows** are versioned: a new value for the same natural key creates a new `record_version`, the prior version is retained and marked `superseded_by`. This directly powers "budget revision history" and the mandatory *preserve historical versions* rule ([15](./15-Legal-Ethical-Rules.md)).
- **Dataset version** (a monotonically increasing tag) is bumped on each publish and used for cache invalidation and reproducibility ("data as of version N / date D").

### Error handling & quarantine
- Three outcomes per record: **accepted**, **accepted-with-flag** (e.g. low OCR confidence, cross-field anomaly), **quarantined** (unparseable/failed structure).
- Quarantined items are logged with artifact reference, stage, and reason, and reviewed; they are never silently dropped and never guessed.
- **Missing data is represented explicitly** (null + `missing_reason`) and rendered as a *missing-data warning* — never imputed.

## Provenance model

Every canonical figure links to a `data_source` + `source_document` (URL, retrieval timestamp, artifact hash, page/table locator) + `extraction_method` + `confidence`. Schema in [04 — Database Design](./04-Database-Design.md). This is what makes the *"every number must be traceable / show original source links / show confidence scores"* rules enforceable rather than aspirational.

## Ingestion sequence (per run)

```text
scheduler (cron) 
  → enqueue ingest job (source_id) 
  → ingestion-worker: fetch → hash → store raw → enqueue parse 
  → etl-worker: parse → validate → normalize → dedupe → load(v+1, provenance) 
  → on success: enqueue analytics recompute for affected scope 
  → on failure: retry / DLQ / quarantine + alert 
  → publish: bump dataset_version → warm cache
```
