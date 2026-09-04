# Source Discovery Report

**Date:** 21 August 2026 · **Scope:** Government of India, all 28 States, all 8 Union Territories
**Method:** Official government directories first (§4), then domain-restricted search, then live verification of every URL.

---

## Executive summary

India's public procurement data is in far better shape than its public **execution** data. That is the finding that should shape everything after this phase.

**36 of 36 States and UTs have a verified, live, official e-procurement portal**, and roughly 28 of them run the same NIC platform (GePNIC) with an identical public page structure — meaning one connector can serve most of the country. The Central Public Procurement Portal publishes awards, tender results, cancelled tenders and a **debarred bidder list** as public endpoints. Procurement is a solved discovery problem.

What is **not** solved is everything between the award and the audit. No public works register was located for Maharashtra PWD. No source was verified for physical progress, financial progress, work orders, completion, or per-project expenditure. The strongest candidate — **PMGSY's OMMAS**, which official sources describe as monitoring physical and financial progress of every PMGSY work in real time — could not be reached from either network channel available and therefore remains `DISCOVERED`, not `VERIFIED`.

The consequence is direct and worth stating plainly: **`.docs/07-analytics/analytics-engine.md`'s central variance calculation (`Released − Utilized`, per project) has no verified source today.** The project-level Money Trail that `.docs/wireframes/08-financial-flow.md` treats as the product's signature screen depends on a link in the chain that this pass could not confirm exists publicly.

That is not a reason to stop. It is a reason to make the next phase a **targeted verification exercise on five specific questions** rather than a broader URL hunt. Adding another 500 discovered URLs would not change the picture; answering Q1–Q5 in §Recommended next steps would.

One further result deserves emphasis: **the government's own published list of state procurement portals contained seven dead URLs**, omitted Ladakh entirely, and still lists Dadra & Nagar Haveli and Daman & Diu as separate UTs six years after their merger. A source registry cannot be seeded from any single official list and trusted. It needs multiple directories, live verification, and periodic re-checking — which `.docs/02-architecture/system-architecture.md` already schedules as a weekly link-health cron.

---

## Numbers

|                                                                   | Count                             |
| ----------------------------------------------------------------- | --------------------------------- |
| **Organisations discovered** (IGOD crawl, official directory)     | **6,466**                         |
| — State/UT organisations across 36 States/UTs                     | 6,360                             |
| — Union Government ministries & departments                       | 106 (95 with an official website) |
| **Sources promoted to the curated registry**                      | **99**                            |
| — `VERIFIED` (fetched; status, final URL, title recorded)         | **96**                            |
| — `DISCOVERED` (referenced by official sources, unreachable here) | 3                                 |
| — `PRODUCTION_READY`                                              | **0**                             |
| URLs individually fetched and recorded                            | 168                               |
| States/UTs with a verified e-procurement portal                   | **36 / 36**                       |
| Dead URLs found in the official CPPP state list                   | **7 / 36**                        |

### By government level

Central **31** · State **60** · UT **8**

### By category

Procurement 47 · Infrastructure 13 · Finance 11 · GIS 4 · Scheme 3 · District portal 3 · Directory 2 · Open data 2 · Local government 2 · Statistics 2 · Project monitoring 2 · Urban 2 · Revenue 2 · Budget 1 · Audit 1 · Administrative hierarchy 1 · Regulator 1

### By machine-accessibility grade

Predominantly **C** (HTML portals) and **D** (PDF documents). Only one confirmed general-purpose API (`data.gov.in`) and one registration-gated API (LGD NAPIX). **An API-first ingestion design would serve almost none of the real sources** — `.docs/04-data-engineering/data-collection-architecture.md`'s scraping-and-PDF pipeline is the correct architecture.

---

## Category findings

### Procurement & tenders — **strong**

36/36 States/UTs verified live. CPPP publishes awards, results, cancelled tenders and debarment. ~28 states share the GePNIC page structure (`FrontEndTendersByOrganisation`, `FrontEndTendersByClassification`, `FrontEndListTendersbyDate`, `WebTenderStatusLists`, `StandardBiddingDocuments`). Non-GePNIC: Gujarat (nProcure via the state PSU GIL), Andhra Pradesh, Telangana, Karnataka, Bihar, Chhattisgarh, plus separate SPPP portals in Assam and Rajasthan.
**Not established:** which fields any portal exposes; CAPTCHA; archive depth; APIs. → [`.docs/06-government-sources/procurement/procurement-portals.md`](./procurement/procurement-portals.md)

### Administrative hierarchy — **strong**

**LGD is the single best find of this pass.** 36 States/UTs · 784 districts · 7,092 sub-districts · 7,323 blocks · **677,367 villages** · rural and urban local bodies with ward mappings · unique codes · **historical change tracking with government-order references** · 58+ reports · state/district downloads · a registration-gated API. It maps directly onto `.docs/05-data-model/database-design.md`'s `admin_unit` including the `valid_from`/`valid_to` versioning columns, and it is already the documented integration key between MoPR systems (LGD ↔ eGramSwaraj ↔ PFMS). → [`.docs/06-government-sources/administrative-hierarchy-sources.md`](./administrative-hierarchy-sources.md)

### Finance & budget — **medium**

Union budget, Demand for Grants, CGA monthly accounts and Finance/Appropriation Accounts are published, as PDFs. Maharashtra has a full treasury stack verified live (Mahakosh, IFMS, **BEAMS**, GRAS, ARTHWAHINI). **Expenditure is published by budget head and DDO, not by project** — the attribution gap. → [`.docs/06-government-sources/finance/finance-portals.md`](./finance/finance-portals.md)

### Project execution & progress — **weak. The critical gap.**

No works register located. No verified source for work order, start date, planned completion, extensions, physical progress, financial progress, bills, completion, or per-project final cost. → [`.docs/06-government-sources/infrastructure/project-monitoring-portals.md`](./infrastructure/project-monitoring-portals.md)

### Contractors — **medium, with a structural problem**

CPPP award records and debarment lists are public endpoints. But there is **no national contractor registry**, no confirmed link from a procurement award to a CIN or GSTIN, and 36 independent state systems each with their own vendor IDs. Cross-state contractor identity is fuzzy-only and should be out of scope for Phase 1. → [`.docs/06-government-sources/procurement/contractor-portals.md`](./procurement/contractor-portals.md)

### GIS — **unassessed**

Bhuvan, Bharat Maps, NRSC and MRSAC all verified live. **No service endpoint (WMS/WFS/WMTS) was enumerated for any of them**, and boundary geometry is not in LGD — so the code↔geometry join is unverified. → [`.docs/06-government-sources/gis/gis-portals.md`](./gis/gis-portals.md)

### Audit — **available as documents**

CAG verified live. Narrative PDFs, not structured records. State AG offices and local-body audit not located. Recommended treatment: a **document class linked to entities and cited**, never a feed into the analytics engine — an auditor's conclusion is categorically different from `.docs/07-analytics/analytics-engine.md`'s arithmetic. → [`.docs/06-government-sources/audit/audit-portals.md`](./audit/audit-portals.md)

### Local government — **identity yes, money no**

LGD gives every local body a code. eGramSwaraj (rural accounting and progress) was unreachable; **no national urban local-body finance system was identified at all**. This matches `.docs/15-scalability/scalability-plan.md` Phase 4's expectation of sparse local publication, and validates the coverage-first design of the mobile Unit screen. → [`.docs/06-government-sources/local-government/local-government-portals.md`](./local-government/local-government-portals.md) · [`.docs/06-government-sources/local-government/panchayat-portals.md`](./local-government/panchayat-portals.md) · [`.docs/06-government-sources/local-government/municipal-portals.md`](./local-government/municipal-portals.md)

### Resources / BOQ — **weak**

Tendered BOQ may be extractable from tender-document attachments (PDF/XLS). **Actual executed quantities, labour and equipment were not identified in any source.** A separate open question: `.docs/03-domain/road-infrastructure-intelligence.md`'s coefficients may derive from IRC standards, which are **sold rather than freely published** — a licensing issue for the road model. → [`.docs/06-government-sources/infrastructure/resource-boq-sources.md`](./infrastructure/resource-boq-sources.md)

---

## The two chains

### Tender → project → money (§33)

```text
Budget ──✅──> Allocation ──🟡──> Scheme ──✅──> Project ──❓──> Tender ──✅──> Bid ──🟡──>
Award ──🟡──> Contractor ──🟡──> Contract value ──🟡──> Work order ──❓──> Start ──❓──>
Planned completion ──❓──> Extensions ──❓──> Physical progress ──❓──> Financial progress ──❓──>
Bills ──❌──> Payments ──🟡──> Final expenditure ──🟡──> Completion ──❓──> Audit ──✅──>
```

**Both ends strong, middle weak.**

### Resource chain (§34)

```text
Project ──❓──> BOQ ──🟡──> Material ──🟡──> Quantity ──🟡──> Unit rate ──🟡──> Cost ──🟡──>
Labour ──❌──> Equipment ──❌──> Specification ──🟡──> Actual execution ──❌──>
```

**Tendered quantities possibly; as-built quantities no.**

---

## Sources requiring each ingestion method

| Method                  | Sources                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **API**                 | data.gov.in; LGD NAPIX (registration-gated)                                                               |
| **Structured download** | LGD state/district files; NDAP; eSankhyiki                                                                |
| **HTML scraping**       | CPPP; ~28 GePNIC portals via one parameterised connector; 8 bespoke state portals; IGOD; department sites |
| **PDF extraction**      | India Budget; CGA accounts; CAG reports; state budgets; tender documents/BOQ                              |
| **OCR**                 | Expected for state and local-body documents — **none confirmed in this pass**                             |
| **Partial / blocked**   | GeM, PFMS, state IFMS (authenticated flows)                                                               |

---

## Sources with an API · with history · unreachable

**Confirmed API:** `data.gov.in` (public); LGD NAPIX (registration-gated). That is all.
**Confirmed historical depth:** LGD (with government-order references); India Budget (annual); CAG (multi-year). Procurement archive depth **unverified on every portal**.
**Not reachable from the verification vantage point** (existence _not_ disproven — §35): `finmin.gov.in`, `doe.gov.in`, `rural.nic.in`, `pmgsy.nic.in`, `omms.nic.in`, `online.omms.nic.in`, `egramswaraj.gov.in`, `amrut.gov.in`, `smartcities.gov.in`, `pmayurban.gov.in`, `pmayg.nic.in`, `censusindia.gov.in`, `nrida.nic.in`, `koshwahini.mahakosh.gov.in`, `mahaegs.maharashtra.gov.in`.

`lgdirectory.gov.in` was in this group and **succeeded on a second network channel** — proving the pattern is a vantage-point restriction. **All of the above must be re-verified from an Indian network.** Several are high-value; OMMAS is critical.

---

## Highest-value sources

1. **LGD** — the place spine. Highest confidence in the registry.
2. **CPPP + 36 State/UT portals** — the procurement layer, essentially complete.
3. **OMMAS** _(reachable 28 Aug, licence-blocked)_ — it does close the execution gap for rural roads in one source, and NRIDA's terms forbid copying or republishing it without written permission. See [`pmgsy-ommas-findings.md`](./pmgsy-ommas-findings.md).
4. **India Budget + CGA** — the money-in side.
5. **Maharashtra BEAMS** _(surface unverified)_ — closest thing found to a state allocation system.
6. **CAG** — audit, as cited documents.

---

## Major gaps

1. **Per-project expenditure** — breaks `.docs/07-analytics/analytics-engine.md`'s core variance.
2. **Physical and financial progress** — no verified source.
3. **Tender ↔ project join** — procurement is organised by tender, execution by work; nothing verified connects them.
4. **Cross-state contractor identity** — no national registry, no CIN/GSTIN link.
5. **Urban local-body finance** — no national system identified.
6. **GIS service endpoints** — nothing enumerated; code↔geometry join unverified.
7. **Licence terms** — captured for no source, though `.docs/17-legal/legal-ethical-rules.md` requires displaying them.
8. **Field-level exposure** — not verified for a single portal.

---

## Recommended next steps

Five questions, in priority order. Answering these matters more than expanding the URL count.

| #      | Question                                                                                     | Why it decides things                                                                                  |
| ------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Q1** | Does Maharashtra PWD publish a public works register with per-work progress and expenditure? | Decides whether Phase 1 can deliver the project-level Money Trail for state roads                      |
| **Q2** | Is OMMAS publicly accessible, and what does it expose?                                       | Could close links 11–15 and 19 in one source for rural roads                                           |
| **Q3** | What fields does one GePNIC portal actually expose publicly, end to end?                     | Establishes the template for ~28 states; determines whether award + contractor + value are extractable |
| **Q4** | Does BEAMS expose allocation without authentication?                                         | Decides whether structured state allocation is available                                               |
| **Q5** | Can LGD codes be joined to boundary geometry?                                                | Decides whether the mobile map can be built from official geometry                                     |

Alongside those: **check `robots.txt`, terms of use and rate limits for every source before writing a connector** (§24), and **capture licence terms**, which `.docs/17-legal/legal-ethical-rules.md` requires and this pass did not collect.

### Recommended ingestion order

1. LGD (place spine — high confidence, unblocks `admin_unit`)
2. One GePNIC portal, field-verified end to end (Maharashtra)
3. CPPP awards + debarment
4. India Budget + Maharashtra finance/BEAMS
5. OMMAS, _if_ Q2 succeeds
6. Remaining GePNIC states via the parameterised connector
7. Non-GePNIC states, bespoke

---

## Method note and its limits

Discovery began from the Integrated Government Online Directory as §4 directs — 6,466 organisation records across 38 scopes, crawled from the government's own directory rather than recalled. The official CPPP State/UT procurement list was parsed from its published PDF. Gaps were filled with searches restricted to `gov.in`/`nic.in`. Every promoted URL was then fetched, with status, final URL and page title recorded.

**Two honest limitations:**

- **`robots.txt` and terms were not checked before the IGOD crawl.** The crawl was modest and polite (~1,000 requests, 6 concurrent, backoff on failure), but the check should have preceded it and must precede any repeat.
- **`VERIFIED` here means the source responds** — status, final URL and page title recorded. It does **not** mean we know what data it holds. That is why no source is `PRODUCTION_READY`, and why the next phase is verification rather than discovery.

Throughout, §35 was applied: nothing is recorded as unpublished because it could not be found. Unreachable hosts are recorded as _"not reachable from the verification vantage point on 21 August 2026; existence not disproven."_
