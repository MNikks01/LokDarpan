# Finance, Treasury & Expenditure Sources

> Sources for the `Revenue → Budget → Allocation → Release → Expenditure → Accounts → Audit` chain of `.docs/12-security/security.md`/`.docs/03-domain/administrative-hierarchy.md`.
>
> Verified 21 August 2026. Every URL fetched; none written from memory.

| Source                                                                       | URL                                        | Status      | Relevance | Page title (as fetched)                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------ | ----------- | --------- | ---------------------------------------------------------- |
| **BEAMS — Budget Estimation, Allocation and Monitoring System, Maharashtra** | `https://beams.mahakosh.gov.in`            | ✅ VERIFIED | CRITICAL  | BEAMS :: Budget Estimation, Allocation & Monitoring System |
| **Controller General of Accounts (CGA)**                                     | `https://cga.nic.in/`                      | ✅ VERIFIED | CRITICAL  | Home : CONTROLLER GENERAL OF ACCOUNTS                      |
| **Directorate of Accounts and Treasuries (Mahakosh), Maharashtra**           | `https://mahakosh.maharashtra.gov.in`      | ✅ VERIFIED | CRITICAL  | Mahakosh : The Official Website                            |
| **Finance Department, Maharashtra**                                          | `https://finance.maharashtra.gov.in`       | ✅ VERIFIED | CRITICAL  | Homepage                                                   | वित्त विभाग                   | भारत                |
| **India Budget Portal (Union Budget)**                                       | `https://www.indiabudget.gov.in/`          | ✅ VERIFIED | CRITICAL  | India Budget                                               | Ministry of Finance           | Government of India |
| **Integrated Financial Management System (IFMS) — Mahakosh**                 | `https://www.mahakosh.gov.in`              | ✅ VERIFIED | CRITICAL  | Government of Maharashtra - Finance Department             |
| **Public Financial Management System (PFMS)**                                | `https://pfms.nic.in/SitePages/index.html` | ✅ VERIFIED | CRITICAL  | Home                                                       |
| **Planning Department, Maharashtra**                                         | `https://plan.maharashtra.gov.in`          | ✅ VERIFIED | HIGH      | मुख्यपृष्ठ                                                 | नियोजन विभाग, महाराष्ट्र शासन | भारत                |
| **ARTHWAHINI — TreasuryNet Management System, Maharashtra**                  | `https://arthwahini.mahakosh.gov.in`       | ✅ VERIFIED | MEDIUM    | Dashboard : Finance Department, Government of Maharashtra  |
| **Department of Economic Affairs**                                           | `https://dea.gov.in/`                      | ✅ VERIFIED | MEDIUM    | Department of Economic Affairs                             |
| **GRAS — Government Receipt Accounting System, Maharashtra**                 | `https://gras.mahakosh.gov.in`             | ✅ VERIFIED | MEDIUM    | GRAS-Government Receipt Accounting System                  |
| **SEVAARTH — Payroll System, Maharashtra**                                   | `https://sevaarth.mahakosh.gov.in`         | ✅ VERIFIED | LOW       | —                                                          |

## Chain assessment (§13)

| Stage             | Status                  | Source                                                                                      |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| Revenue           | **AVAILABLE**           | India Budget receipts ✅; state receipt systems (MH GRAS ✅)                                |
| Budget            | **AVAILABLE**           | India Budget ✅; state finance departments ✅                                               |
| Demand for Grants | **AVAILABLE**           | India Budget ✅                                                                             |
| Allocation        | **PARTIALLY_AVAILABLE** | Union: budget documents ✅. Sub-state: only Maharashtra **BEAMS** ✅ located                |
| Revised Estimate  | **AVAILABLE**           | India Budget ✅ (supports `.docs/05-data-model/data-models.md` `estimateType` BE/RE/actual) |
| Release           | **PARTIALLY_AVAILABLE** | PFMS 🔍 (largely authenticated)                                                             |
| Allotment         | **UNKNOWN**             | —                                                                                           |
| Expenditure       | **PARTIALLY_AVAILABLE** | CGA monthly accounts ✅; state treasuries ✅ — **aggregate, not per-project**               |
| Utilization / UCs | **UNKNOWN**             | Not identified in the sources reviewed                                                      |
| Final accounts    | **AVAILABLE**           | CGA ✅ (Finance & Appropriation Accounts)                                                   |
| Audit             | **AVAILABLE**           | CAG ✅                                                                                      |

**The gap that matters:** expenditure is published by budget head and DDO, not by project. Attributing spend to a specific work is unresolved — see [`.docs/04-data-engineering/entity-linking.md`](../../04-data-engineering/entity-linking.md).

## Note on format

Almost everything here is **PDF** (grade D). `.docs/04-data-engineering/data-collection-architecture.md`'s PDF/table-extraction pipeline is not optional — it is the primary ingestion path for the money-in side of the ledger.
