# Contractor & Vendor Sources

> LokDarpan must answer *"who received this contract?"* — and, per `.docs/17-legal/legal-ethical-rules.md`, must do so **without any characterisation of the contractor**. This file records what official sources expose and, critically, whether a contractor can be tracked across systems.

Verified 21 August 2026.

## What was identified

| Source | Exposes | Status |
|---|---|---|
| **CPPP** `/cppp/awards`, `/cppp/resultoftendersnew` | Award records — expected to name the awarded party and value | ✅ endpoints verified public; **fields not verified** |
| **CPPP** `/cppp/debarredbidderlist`, `/cppp/debarmentlistsearch` | **Debarred / blacklisted bidders** | ✅ endpoints verified public |
| State GePNIC portals (`WebTenderStatusLists`) | Tender status, expected to include award outcome | ✅ 36/36 portals verified live; fields not verified |
| GeM | Vendor and contract data | ✅ site verified; largely behind authenticated buyer/seller flows |

## §10 field checklist — actual status

Not one of these was field-verified in this pass. Recording them as `UNKNOWN` rather than assuming, per §35.

| Field | Status |
|---|---|
| Contractor / vendor / company name | **PARTIALLY_AVAILABLE** — expected in CPPP award records; not verified |
| Bidder ID | UNKNOWN |
| Contractor registration number | UNKNOWN |
| GSTIN | UNKNOWN |
| Address | UNKNOWN |
| Class / category / registration | UNKNOWN — state PWD contractor classes exist administratively (`.docs/05-data-model/data-models.md` `classGrade`); no public register located |
| Awarded contracts, contract value | **PARTIALLY_AVAILABLE** — CPPP awards |
| Tender participation history | UNKNOWN |
| Completion history | **NOT identified in the sources reviewed** |
| Debarment / blacklisting | **AVAILABLE** — CPPP debarment list ✅ |
| Performance information | **NOT identified in the sources reviewed** |

## The identity problem

This is the hardest unsolved problem in the registry, and it is worth stating precisely.

`.docs/04-data-engineering/data-collection-architecture.md` already anticipates it: contractor names are "messy across sources" and require canonicalisation with deterministic rules plus fuzzy matching. What this discovery pass adds is the scale of the problem:

- There is **no national contractor registry** among the sources identified. No equivalent of a company-number that spans procurement systems.
- Each State/UT runs its own procurement system — 36 of them, on at least six different platforms. A contractor working in three states plausibly appears under three unrelated internal vendor IDs.
- MCA (`mca.gov.in`, Ministry of Corporate Affairs) holds CIN/company identity, but **no link was identified between a procurement award record and a CIN**.
- GSTIN would be a strong join key but was not confirmed as published in any award record reviewed.

**Consequence for the product.** `.docs/wireframes/11-procurement.md` shows a contractor screen with merged aliases and a `linkageConfidence`. That design was correct to anticipate uncertainty — this pass confirms the uncertainty is structural, not incidental. Cross-state contractor aggregation should be treated as **out of scope for Phase 1** and, when introduced, must display linkage confidence prominently, because a wrong merge attributes one firm's contracts to another.

## Neutrality constraints carried into ingestion

From `.docs/08-risk/risk-scoring-engine.md` and `.docs/17-legal/legal-ethical-rules.md`, binding on anything built from these sources:

- Debarment data is an **official finding by the procuring authority** and may be reported **as such, attributed to its source and date** — never restated as a general characterisation of the firm.
- No score, rank, badge, or risk indicator may attach to a contractor (`.docs/08-risk/risk-scoring-engine.md`: never rank people).
- Concentration statistics (HHI) attach to a **scope** — a taluka, a financial year — never to a firm.
