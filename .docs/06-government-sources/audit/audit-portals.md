# Audit Sources

> CAG, State AGs, and local-body audit (`.docs/02-architecture/deliverables-and-risk.md`).
>
> Verified 21 August 2026. Every URL fetched; none written from memory.

| Source | URL | Status | Relevance | Page title (as fetched) |
|---|---|---|---|---|
| **Comptroller and Auditor General of India (CAG)** | `https://cag.gov.in/` | ✅ VERIFIED | CRITICAL | Home | Comptroller and Auditor General of India |

## What was found

**Comptroller and Auditor General of India** ✅ `cag.gov.in` — verified live. Publishes Union and State audit reports, including performance and compliance audits.

## What was NOT found

- **State Accountant General offices** — not individually located or verified
- **Local body / panchayat / municipal audit** — not identified in the sources reviewed
- **Departmental internal audit** — not identified in the sources reviewed

## Format reality

CAG reports are **narrative PDFs** (grade D), not structured records. `.docs/05-data-model/database-design.md` models `anomaly` rows with `evidence` JSONB and neutral `observation` text — audit findings do not arrive in that shape and would require extraction and, more importantly, careful handling.

## Neutrality constraint — the most sensitive category

`.docs/17-legal/legal-ethical-rules.md` is explicit: audit findings must be presented **according to the official source**, never transformed into accusations.

Practically, for ingestion:

- An audit observation may be quoted or summarised **with attribution to the report, paragraph, and date**.
- It must never be restated in stronger language than the auditor used.
- It must never be merged into a computed anomaly or a Verification Priority factor as though it were a numeric signal — an audit finding is an official body's conclusion, categorically different from `.docs/07-analytics/analytics-engine.md`'s arithmetic observations, and `.docs/01-product/design-system.md`'s `FACT / CALCULATION / OBSERVATION / SOURCE / INFERENCE` distinction must keep them apart.

**Recommendation:** treat audit reports as a *document* class linked to an entity, displayed as citations — not as a data source feeding the analytics engine.
