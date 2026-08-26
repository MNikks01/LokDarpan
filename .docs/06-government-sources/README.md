# Government Data Source Registry

**Where India's public-finance data actually lives, what each system exposes, and whether those records can be connected into the LokDarpan ledger.**

Discovery pass completed **21 August 2026**. Start with **[`.docs/06-government-sources/SOURCE-DISCOVERY-REPORT.md`](./SOURCE-DISCOVERY-REPORT.md)**.

---

## The short version

**36 of 36 States and UTs have a verified, live, official e-procurement portal**, and ~28 share one NIC platform with an identical page structure. **LGD** gives every administrative unit in India — down to 677,367 villages — a unique code with change history. Procurement and place are in good shape.

**Execution is not.** No works register was located. No verified source for physical progress, financial progress, work orders, completion, or per-project expenditure. `.docs/07-analytics/analytics-engine.md`'s central variance calculation has **no verified source today**.

Also worth knowing: **7 of the 36 URLs in the government's own published procurement list are dead**, Ladakh is missing from it, and two merged UTs are still listed separately. No single official list can be trusted as a seed.

---

## Sourcing rule

Only official Government of India, State, UT, and government-body sources. News sites, private tender aggregators (TenderTiger, TenderDetail, IndiaMART), blogs, social media and commercial databases are **never** sources of fact (`.docs/17-legal/legal-ethical-rules.md`). None appears in this registry.

**No URL here was written from memory.** Every one was discovered from an official government directory or a `gov.in`/`nic.in`-restricted search, then fetched — with HTTP status, final URL and page title recorded.

---

## Machine-readable registry

| File                                                                                                   | Contents                                                                                    |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **[`.docs/06-government-sources/source-registry.json`](./source-registry.json)**                       | 99 curated sources, full schema per §28                                                     |
| **[`.docs/06-government-sources/source-registry.csv`](./source-registry.csv)**                         | The same, flattened                                                                         |
| **[`.docs/06-government-sources/igod-organization-catalogue.csv`](./igod-organization-catalogue.csv)** | **6,466 government organisations** crawled from IGOD — all 36 States/UTs + Union Government |
| [`.docs/06-government-sources/data/union-ministries.json`](./data/union-ministries.json)               | 106 Union ministries/departments with URLs, addresses, sub-organisation counts              |
| [`.docs/06-government-sources/data/igod_all.json`](./data/igod_all.json)                               | Raw IGOD State/UT crawl                                                                     |
| [`.docs/06-government-sources/data/verif_lookup.json`](./data/verif_lookup.json)                       | Raw verification results (168 URLs)                                                         |

Fields with no evidence are `null` or `"unknown"` — never guessed.

---

## ⚠ Before writing any connector

Read these two Sprint 0 findings first.

- [`access-and-permissions.md`](./access-and-permissions.md) — what each source actually permits. Two of the thirty-six State/UT procurement portals disallow crawling outright: **Maharashtra** (the Phase-1 target) and **Karnataka**.
- [`beams-discovery.md`](./beams-discovery.md) — **the Maharashtra expenditure chain**: `BUDGET → RELEASED → EXPENDITURE` per scheme and object, ten years, one request per department-year. **Amounts are in thousands** — × 100,000 for paise.
- [`lgd-access-findings.md`](./lgd-access-findings.md) — **the hierarchy is collectable** via the citizen views (no CAPTCHA); the bulk download is CAPTCHA-gated. Two data traps: the local-name column is mostly uppercase English, and Indic text arrives decomposed.
- [`datagovin-api-findings.md`](./datagovin-api-findings.md) — the **catalogue API needs no key** (285,974 resources). Maharashtra publishes **no** procurement data; six other states do. Note the ignored-parameter trap.
- [`gepnic-access-findings.md`](./gepnic-access-findings.md) — **award data is CAPTCHA-gated on every GePNIC portal tested**, and on CPPP. Changing state does not obtain it; Phase 1 stays Maharashtra.
- [`sprint0-findings-q1-q3.md`](./sprint0-findings-q1-q3.md) — **Q1 no** (no Maharashtra PWD works register), **Q3 yes** (BEAMS public MIS: departmental/scheme/DDO expenditure, ten years, no login).

## Documents

### Start here

| File                                                                                             |                                                                      |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **[`.docs/06-government-sources/SOURCE-DISCOVERY-REPORT.md`](./SOURCE-DISCOVERY-REPORT.md)**     | Executive summary, numbers, both chain assessments, gaps, next steps |
| **[`.docs/06-government-sources/phase-1-maharashtra-roads.md`](./phase-1-maharashtra-roads.md)** | The 22-source Phase-1 map and the two blocking unknowns              |

### The analysis that matters

| File                                                                                                                         |                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`.docs/06-government-sources/infrastructure/project-monitoring-portals.md`](./infrastructure/project-monitoring-portals.md) | **§33 chain assessment** — the critical gap                                     |
| [`.docs/04-data-engineering/entity-linking.md`](../04-data-engineering/entity-linking.md)                                    | **§22** — can records be joined? LGD, and the two joins that decide the product |
| [`.docs/04-data-engineering/source-to-data-model.md`](../04-data-engineering/source-to-data-model.md)                        | **§23** — source field → `.docs/05-data-model/database-design.md` field         |
| [`.docs/06-government-sources/infrastructure/resource-boq-sources.md`](./infrastructure/resource-boq-sources.md)             | **§34 resource chain** + the IRC licensing problem                              |
| [`.docs/06-government-sources/source-quality.md`](./source-quality.md)                                                       | Status model, A–F grades, verification method                                   |
| [`.docs/04-data-engineering/ingestion-methods.md`](../04-data-engineering/ingestion-methods.md)                              | **§24** — the GePNIC single-connector finding                                   |

### Inventories

| File                                                                                                                                                                                                                                                                                                                                                           |                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [`.docs/06-government-sources/central/central-government.md`](./central/central-government.md)                                                                                                                                                                                                                                                                 | Union ministries, agencies, national systems   |
| [`.docs/06-government-sources/states/state-governments.md`](./states/state-governments.md)                                                                                                                                                                                                                                                                     | All 28 States                                  |
| [`.docs/06-government-sources/uts/union-territories.md`](./uts/union-territories.md)                                                                                                                                                                                                                                                                           | All 8 UTs                                      |
| [`.docs/06-government-sources/procurement/procurement-portals.md`](./procurement/procurement-portals.md) · [`.docs/06-government-sources/procurement/tender-portals.md`](./procurement/tender-portals.md)                                                                                                                                                      | **All 36 State/UT portals + CPPP endpoints**   |
| [`.docs/06-government-sources/finance/finance-portals.md`](./finance/finance-portals.md) · [`.docs/06-government-sources/finance/budget-portals.md`](./finance/budget-portals.md)                                                                                                                                                                              | Treasury, expenditure, budget                  |
| [`.docs/06-government-sources/finance/scheme-portals.md`](./finance/scheme-portals.md)                                                                                                                                                                                                                                                                         | PMGSY, MGNREGA, urban missions                 |
| [`.docs/06-government-sources/infrastructure/infrastructure-portals.md`](./infrastructure/infrastructure-portals.md) · [`.docs/06-government-sources/infrastructure/roads-portals.md`](./infrastructure/roads-portals.md)                                                                                                                                      | Works departments; road authorities by class   |
| [`.docs/06-government-sources/procurement/contractor-portals.md`](./procurement/contractor-portals.md)                                                                                                                                                                                                                                                         | Award records, debarment, the identity problem |
| [`.docs/06-government-sources/gis/gis-portals.md`](./gis/gis-portals.md)                                                                                                                                                                                                                                                                                       | Bhuvan, Bharat Maps, MRSAC                     |
| [`.docs/06-government-sources/audit/audit-portals.md`](./audit/audit-portals.md)                                                                                                                                                                                                                                                                               | CAG, and how audit findings must be handled    |
| [`.docs/06-government-sources/local-government/local-government-portals.md`](./local-government/local-government-portals.md) · [`.docs/06-government-sources/local-government/panchayat-portals.md`](./local-government/panchayat-portals.md) · [`.docs/06-government-sources/local-government/municipal-portals.md`](./local-government/municipal-portals.md) | Local bodies                                   |
| [`.docs/06-government-sources/administrative-hierarchy-sources.md`](./administrative-hierarchy-sources.md)                                                                                                                                                                                                                                                     | **LGD** — the canonical hierarchy              |
| [`.docs/06-government-sources/central/open-data-portals.md`](./central/open-data-portals.md)                                                                                                                                                                                                                                                                   | data.gov.in, NDAP, eSankhyiki                  |

---

## Status model (§31)

| Status             | Meaning                                                                                                    | Count                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `DISCOVERED`       | Found in an official directory or search                                                                   | 6,466 catalogue rows + 3 registry entries |
| `VERIFIED`         | Fetched — status, final URL, page title recorded. **Confirms it responds, not what it holds.**             | **96**                                    |
| `PRODUCTION_READY` | Data exposure, retrieval, identifiers, cadence, history, extraction, legality and entity mapping all known | **0**                                     |

**Zero sources are production-ready, and that is the correct state after a discovery pass.** Promotion requires field-level inspection — the next phase.

---

## The rule this registry is built on (§35)

> Never record _"the government does not publish X"_ because we could not find X.
> Record _"X was not identified in the sources reviewed as of [date]."_

This matters concretely here. A set of `.gov.in`/`.nic.in` hosts — including **OMMAS**, eGramSwaraj, and MoRD — were unreachable from this environment. `lgdirectory.gov.in` was among them and then **succeeded on a second network channel**, proving the pattern is a vantage-point restriction rather than site failure.

Every such host is recorded as _"not reachable from the verification vantage point on 21 August 2026; existence not disproven"_ — and flagged for re-verification from an Indian network.

---

## Next phase

Five questions, not more URLs:

1. Does Maharashtra PWD publish a public works register?
2. Is OMMAS publicly accessible, and what does it expose?
3. What fields does one GePNIC portal actually expose, end to end?
4. Does BEAMS expose allocation without authentication?
5. Can LGD codes be joined to boundary geometry?

Plus two things this pass did not do and the next must: **check `robots.txt`, terms and rate limits before writing any connector**, and **capture licence terms**, which `.docs/17-legal/legal-ethical-rules.md` requires displayed for every dataset.
