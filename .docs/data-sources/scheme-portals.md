# Scheme Sources

> Centrally sponsored and state schemes — the funding vehicle between allocation and project (`docs/19`).
>
> Verified 21 August 2026. Every URL fetched; none written from memory.

| Source | URL | Status | Relevance | Page title (as fetched) |
|---|---|---|---|---|
| **MGNREGA / NREGA Public Data Portal** | `https://nrega.nic.in/` | ✅ VERIFIED | HIGH | — |
| **Jal Jeevan Mission** | `https://jaljeevanmission.gov.in/` | ✅ VERIFIED | MEDIUM | Home | Jal Jeevan Mission |
| **Swachh Bharat Mission (Grameen)** | `https://swachhbharatmission.ddws.gov.in/` | ✅ VERIFIED | LOW | Home | sbm |
| **eProcurement System for PMGSY** | `https://pmgsytenders.gov.in` | ✅ VERIFIED | CRITICAL | eProcurement System for Pradhan Mantri Gram Sadak Yojana (PMGSY) |
| **Public Financial Management System (PFMS)** | `https://pfms.nic.in/SitePages/index.html` | ✅ VERIFIED | CRITICAL | Home |
| **eGramSwaraj (Panchayat planning, accounting & progress)** | `https://egramswaraj.gov.in/` | 🔍 DISCOVERED | CRITICAL | — |
| **PMGSY OMMAS (Online Management, Monitoring and Accounting System)** | `https://online.omms.nic.in/` | 🔍 DISCOVERED | CRITICAL | — |

## Scheme identity

`docs/04` models `scheme(scheme_code, name, ministry_id, scheme_type, domain)`. **PFMS is the system that carries scheme codes and fund flow**, but it is largely authenticated and its public report surface was not enumerated.

## Road-relevant schemes

| Scheme | Ministry | Procurement | Monitoring |
|---|---|---|---|
| **PMGSY** | Rural Development / NRIDA | `pmgsytenders.gov.in` ✅ | **OMMAS** 🔍 |
| MGNREGA | Rural Development | — | `nrega.nic.in` ✅ (deep public MIS; not inventoried) |
| AMRUT · Smart Cities · PMAY | MoHUA | — | 🔍 unreachable from this vantage point |
| Jal Jeevan Mission | Jal Shakti | — | ✅ verified |

**PMGSY is the best-instrumented road scheme in the country** and is the natural Phase-1 target: a dedicated national procurement portal plus a dedicated monitoring system. Its value depends entirely on OMMAS being publicly accessible — currently unverified.

## §14 field checklist

Scheme name, code, ministry, central/state, funding pattern, allocation, release, expenditure, beneficiaries, coverage, projects, guidelines, MIS, dashboard, reports, API — **none of these were field-verified for any scheme in this pass.**
