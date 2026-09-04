# Phase 1 — Maharashtra Roads: Source Map

> The prioritised, verified source set for the first production scope (`.docs/01-product/prd.md`, `.docs/15-scalability/scalability-plan.md` Phase 1).

Verified 21 August 2026. All URLs below were fetched.

## Priority source map

| #   | Role                         | Source                                                        | URL                                                                          | Status                                      |
| --- | ---------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | **Works / roads department** | Public Works Department, Maharashtra                          | `https://pwd.maharashtra.gov.in`                                             | ✅ VERIFIED                                 |
| 2   | **Procurement**              | eProcurement System, Maharashtra (GePNIC)                     | `https://mahatenders.gov.in`                                                 | ✅ VERIFIED                                 |
| 3   | **Budget / allocation**      | **BEAMS** — Budget Estimation, Allocation & Monitoring System | `https://beams.mahakosh.gov.in`                                              | ✅ VERIFIED                                 |
| 4   | **Finance department**       | Finance Department, Maharashtra                               | `https://finance.maharashtra.gov.in`                                         | ✅ VERIFIED                                 |
| 5   | **Treasury**                 | Directorate of Accounts and Treasuries (Mahakosh)             | `https://mahakosh.maharashtra.gov.in`                                        | ✅ VERIFIED                                 |
| 6   | **Treasury (IFMS)**          | Integrated Financial Management System                        | `https://www.mahakosh.gov.in`                                                | ✅ VERIFIED                                 |
| 7   | **Receipts**                 | GRAS — Government Receipt Accounting System                   | `https://gras.mahakosh.gov.in`                                               | ✅ VERIFIED                                 |
| 8   | **Treasury ops**             | ARTHWAHINI — TreasuryNet                                      | `https://arthwahini.mahakosh.gov.in`                                         | ✅ VERIFIED                                 |
| 9   | **Rural roads / local govt** | Rural Development & Panchayat Raj Dept                        | `https://rdd.maharashtra.gov.in`                                             | ✅ VERIFIED                                 |
| 10  | **District planning**        | Planning Department                                           | `https://plan.maharashtra.gov.in`                                            | ✅ VERIFIED                                 |
| 11  | **State road PSU**           | MSRDC                                                         | `https://msrdc.in`                                                           | ✅ VERIFIED                                 |
| 12  | **Urban roads**              | Urban Development Department                                  | `https://urban.maharashtra.gov.in`                                           | ✅ VERIFIED                                 |
| 13  | **GIS**                      | MRSAC — Maharashtra Remote Sensing Application Centre         | `https://mrsac.gov.in`                                                       | ✅ VERIFIED                                 |
| 14  | **PMGSY procurement**        | PMGSY eProcurement (national)                                 | `https://pmgsytenders.gov.in`                                                | ✅ VERIFIED                                 |
| 15  | **PMGSY monitoring**         | **OMMAS**                                                     | `https://pmgsy.dord.gov.in/` (was `online.omms.nic.in`, now absent from DNS) | ⚖️ **REACHABLE — licence-blocked** (28 Aug) |
| 16  | **Central procurement**      | CPPP (awards, results, debarment)                             | `https://eprocure.gov.in/cppp/`                                              | ✅ VERIFIED                                 |
| 17  | **Audit**                    | CAG                                                           | `https://cag.gov.in/`                                                        | ✅ VERIFIED                                 |
| 18  | **Hierarchy / codes**        | LGD                                                           | `https://lgdirectory.gov.in/`                                                | ✅ VERIFIED (alt channel)                   |
| 19  | **National highways**        | MoRTH · NHAI                                                  | `https://morth.nic.in/` · `https://nhai.gov.in/`                             | ✅ VERIFIED                                 |
| 20  | **Open data**                | data.gov.in                                                   | `https://data.gov.in/`                                                       | ✅ VERIFIED                                 |
| 21  | **Land / revenue**           | IGR Maharashtra (stamp duty)                                  | `https://igrmaharashtra.gov.in`                                              | ✅ VERIFIED                                 |
| 22  | **Districts**                | 40 district entries in IGOD; 3 verified                       | `ahmednagar.nic.in` · `aurangabad.gov.in` · `mumbaisuburban.gov.in`          | ✅ VERIFIED (3)                             |

Two Maharashtra sources were **not reachable** and are recorded as such, not as absent: `koshwahini.mahakosh.gov.in` (timeout) and `mahaegs.maharashtra.gov.in` (timeout — Employment Guarantee Scheme, Planning Dept).

## The two blocking unknowns

Everything above is a live, official, verified endpoint. But **two questions decide whether Phase 1 can deliver the project-level Money Trail**, and neither was resolved in this pass:

### Q1 — Does Maharashtra PWD publish a works register?

`.docs/04-data-engineering/data-collection-architecture.md` assumes a source `mh_pwd_works` supplying `work_id`, `project_name`, `allocation_amount`, `expenditure_amount`, and physical progress. **That dataset was not located.** `pwd.maharashtra.gov.in` is live, but whether it exposes a queryable works MIS with per-work progress and expenditure is unknown.

If it does not exist publicly, the project-level chain for state highways and MDR/ODR roads cannot be built from Maharashtra sources, and Phase 1 would have to narrow to **PMGSY rural roads** (where OMMAS may provide it) or to **tender-level** rather than work-level reporting.

### Q2 — Does BEAMS expose allocation publicly?

BEAMS is the state's budget estimation, allocation and monitoring system — on paper, exactly the `Allocation → Distribution` stage of `.docs/07-analytics/analytics-engine.md`. Whether it publishes allocation by department/scheme/DDO **without authentication** was not determined.

## Recommended next actions, in order

1. **Field-verify `mahatenders.gov.in` end to end.** Establish the actual public field set for a tender: identity, procuring entity, work, financial, timeline, outcome, documents (§9). One portal, done properly, becomes the template for ~28 GePNIC states.
2. **Determine whether PWD Maharashtra publishes a works register** (Q1). This is the highest-value unknown for Phase 1.
3. **Determine BEAMS' public surface** (Q2).
4. **Verify OMMAS from an Indian network vantage point.**
5. **Ingest LGD** for Maharashtra — districts, talukas, blocks, GPs, villages, wards, with codes and change history. High confidence, unblocks `admin_unit`.
6. **Check `robots.txt`, terms and rate limits** for each of the above before writing any connector.
7. **Locate the Maharashtra Schedule of Rates** for `.docs/03-domain/road-infrastructure-intelligence.md`, and resolve the IRC licensing question ([`.docs/06-government-sources/infrastructure/resource-boq-sources.md`](./infrastructure/resource-boq-sources.md)).

## Realistic Phase-1 expectation

Based on what is verified today:

| Capability                                           | Confidence                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Administrative hierarchy for Maharashtra, with codes | **High** — LGD                                                         |
| Tender and award records                             | **High** — mahatenders + CPPP                                          |
| Contractor award history within Maharashtra          | **Medium** — depends on award field exposure                           |
| State budget and allocation                          | **Medium** — documents certain; structured allocation depends on BEAMS |
| **Per-project expenditure**                          | **Low** — unresolved                                                   |
| **Physical progress**                                | **Low** — depends entirely on Q1/OMMAS                                 |
| Road geometry                                        | **Medium** — MRSAC live, endpoints unenumerated                        |
| Audit findings                                       | **High** — CAG, as documents                                           |

**The product should be planned against this table, not against the assumption that the full chain is available.** `.docs/01-product/state-design.md`'s `insufficient_data` state and the coverage-first design were built for exactly this, and this pass validates that choice.
