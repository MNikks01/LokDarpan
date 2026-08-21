# Budget Sources

> Union and State budget publication. See also [`finance-portals.md`](./finance-portals.md).
>
> Verified 21 August 2026. Every URL fetched; none written from memory.

| Source | URL | Status | Relevance | Page title (as fetched) |
|---|---|---|---|---|
| **India Budget Portal (Union Budget)** | `https://www.indiabudget.gov.in/` | ✅ VERIFIED | CRITICAL | India Budget | Ministry of Finance | Government of India |
| **Finance Department, Maharashtra** | `https://finance.maharashtra.gov.in` | ✅ VERIFIED | CRITICAL | Homepage | वित्त विभाग | भारत |
| **BEAMS — Budget Estimation, Allocation and Monitoring System, Maharashtra** | `https://beams.mahakosh.gov.in` | ✅ VERIFIED | CRITICAL | BEAMS :: Budget Estimation, Allocation & Monitoring System |
| **Planning Department, Maharashtra** | `https://plan.maharashtra.gov.in` | ✅ VERIFIED | HIGH | मुख्यपृष्ठ | नियोजन विभाग, महाराष्ट्र शासन | भारत |

## What a budget source must supply

Per `docs/05`, each budget line needs: fiscal year, department/scheme, amount, `estimateType` (BE/RE/actual), revision flag, and provenance to a document page.

The India Budget Portal ✅ publishes Demand for Grants and Expenditure/Receipt Budget documents annually, which carry BE/RE/actual — matching the model. **Extraction difficulty is grade D (PDF) and the per-document table structure has not been inventoried.**

## State budgets

Only Maharashtra's were investigated in this pass:

- **Finance Department** ✅ `finance.maharashtra.gov.in`
- **BEAMS — Budget Estimation, Allocation and Monitoring System** ✅ `beams.mahakosh.gov.in`
- **Planning Department** ✅ `plan.maharashtra.gov.in` — District Annual Plans are a likely route to district-level allocation (`docs/19`'s cascade)

The other 35 States/UTs have finance/treasury departments catalogued in [`igod-organization-catalogue.csv`](./igod-organization-catalogue.csv) but **not verified or assessed**.
