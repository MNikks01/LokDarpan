# Source → LokDarpan Data Model Mapping

> How a government record becomes a row in `.docs/05-data-model/database-design.md` (§23).

Verified 21 August 2026.

## The pipeline

```text
Government Source          →  the portals in this registry
      ↓
Raw Document               →  immutable, sha256-addressed artifact (.docs/04-data-engineering/data-collection-architecture.md)
      ↓
Source Record              →  source_document(url, artifact_sha256, page_locator,
                                              extraction_method, retrieved_at)
      ↓
Normalized Record          →  amount_inr, FY, LGD code, canonical entity name
      ↓
Entity Resolution          →  admin_unit / project / contractor / scheme match
      ↓
Canonical Entity           →  .docs/05-data-model/database-design.md tables, with provenance + confidence + version
      ↓
Financial Ledger           →  allocation / release / expenditure
      ↓
Analytics                  →  .docs/07-analytics/analytics-engine.md variance, cost/unit, peer median
      ↓
Mobile API                 →  .docs/11-api/client-api-contract.md
```

## Field mapping — confirmed

Only mappings supported by something actually observed in this pass.

| Government source     | Government field                  | LokDarpan entity               | LokDarpan field                                   | Confidence                              |
| --------------------- | --------------------------------- | ------------------------------ | ------------------------------------------------- | --------------------------------------- |
| **LGD** ✅            | State/UT                          | `admin_unit`                   | `level='state'`, `name`, `lgd_code`               | **High**                                |
| LGD ✅                | District (784)                    | `admin_unit`                   | `level='district'`, `lgd_code`                    | **High**                                |
| LGD ✅                | Sub-district (7,092)              | `admin_unit`                   | `level='taluka'`, `lgd_code`                      | **High**                                |
| LGD ✅                | Block (7,323)                     | `admin_unit`                   | `level='block'`, `lgd_code`                       | **High**                                |
| LGD ✅                | Village (677,367)                 | `admin_unit`                   | `level='village'`, `lgd_code`, `census_code`      | **High**                                |
| LGD ✅                | Local body (rural/urban)          | `admin_unit`                   | `level`, `pri_code` / `ulb_code`                  | **High**                                |
| LGD ✅                | Ward mapping                      | `admin_unit`                   | `level='ward'`, `parent_id`                       | **High**                                |
| LGD ✅                | Modification history + govt order | `admin_unit`                   | `valid_from`, `valid_to` + `source_document`      | **High**                                |
| **IGOD** ✅           | Organization name + URL           | `department` / `ministry`      | `name`, reference URL                             | Medium                                  |
| **CPPP** ✅           | Tender listing                    | `tender`                       | `external_tender_id`, `title`, `status`           | Medium — fields unverified              |
| CPPP ✅               | Award record                      | `tender`                       | `contractor_id`, `awarded_amount`, `awarded_date` | **Low — unverified**                    |
| CPPP ✅               | Debarred bidder list              | _(new)_ `contractor_debarment` | official finding, attributed                      | Medium                                  |
| **State GePNIC** ✅   | Tender pages                      | `tender`                       | as CPPP                                           | Medium — unverified                     |
| **India Budget** ✅   | Demand for Grants                 | `allocation`                   | `amount_inr`, `estimate_type`, `fiscal_year_id`   | Medium — PDF extraction                 |
| **CGA** ✅            | Monthly accounts                  | `expenditure`                  | `amount_inr` (aggregate)                          | Medium — **not per-project**            |
| **CAG** ✅            | Audit report                      | `source_document` + citation   | narrative, attributed                             | Medium                                  |
| **MRSAC / Bhuvan** ✅ | Geometry                          | `admin_unit.geom`, `road.geom` | `GEOMETRY(...,4326)`                              | **Unverified** — endpoints unenumerated |

## Provenance — every row

`.docs/05-data-model/database-design.md` requires provenance on every fact. This registry supplies its inputs:

```text
data_source        ← registry entry (source_key, name, authority, tier, base_url, license)
source_document    ← the fetched artifact (url, sha256, retrieved_at, page_locator,
                       extraction_method, published_at)
<fact table>       ← + confidence, record_version, superseded_by_id, valid_from/valid_to
```

The `verification_status`, `http_status`, `final_url`, `page_title`, `verified_at` and `verification_channel` fields in [`.docs/06-government-sources/source-registry.json`](../06-government-sources/source-registry.json) map onto `data_source` and support the weekly link-health check `.docs/02-architecture/system-architecture.md` already specifies.

**Note:** several registry entries carry a `license` of `unknown`. `.docs/17-legal/legal-ethical-rules.md` requires displaying the issuing authority and applicable licence for each dataset. **Licence terms were not captured for any source in this pass** — that is a required field before ingestion, not an optional one.

## Unmapped — the gaps

| `.docs/05-data-model/database-design.md` element  | Source status                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `project.external_work_id`                        | **No works register located**                                                           |
| `project_progress.physical_pct` / `financial_pct` | **Published by OMMAS, licence-blocked** — reachable 28 Aug; NRIDA forbids republication |
| `release` (per project)                           | PFMS, largely authenticated                                                             |
| `expenditure.project_id`                          | **The critical gap** — expenditure is published by budget head, not by work             |
| `road.length_km` / `width_m` / `surface_type`     | No source verified — required by `.docs/03-domain/road-infrastructure-intelligence.md`  |
| `contractor.registration_no`                      | No public register located                                                              |
| `facility` / `utility_asset` / `transport_asset`  | Out of Phase-1 scope; unassessed                                                        |

**Five of `.docs/05-data-model/database-design.md`'s core project-and-execution fields have no verified source.** That is the honest state after discovery, and it is the agenda for the next phase.
