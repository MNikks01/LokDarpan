# 07 — Risk Scoring Engine

The risk score is a **0–100 "needs-verification" indicator** — a triage number that helps a journalist or researcher decide where to look first. It is emphatically **not** a corruption score, a guilt score, or a legal finding. A high score means _"the published figures for this project are unusual or incomplete and are worth a closer look,"_ nothing more. Every score is fully decomposable into its contributing factors, each tied to source figures.

> **Naming discipline:** in the UI this is labeled **"Verification Priority"** or **"Data Consistency Score,"** never "corruption risk." See [15 — Legal & Ethical Rules](../17-legal/legal-ethical-rules.md).

## Design goals

- **Transparent:** the score = a documented weighted sum of factor sub-scores; the breakdown is always shown.
- **Bounded & stable:** each factor is normalized to 0–100 before weighting; total clamped to 0–100.
- **Robust:** uses median/MAD-based signals from [06](../07-analytics/analytics-engine.md), so a single outlier input can't silently swing everything.
- **Honest about gaps:** missing data raises the score modestly (because it *reduces verifiability*) and is labeled as such — we never treat "missing" as "bad actor."

## Factors and weights

| Factor | What it measures (from official figures) | Weight |
|---|---|---:|
| `variance` | Magnitude of |release/allocation deviation %| vs comparable projects | 25 |
| `excessive_cost` | Cost/km deviation above district/peer median (positive side only) | 20 |
| `delay` | Schedule slippage vs expected end date / low physical progress for elapsed time | 15 |
| `missing_records` | Share of expected finance/progress records that are absent | 15 |
| `budget_revisions` | Number/size of allocation revisions across versions | 10 |
| `contractor_concentration` | Scope-level HHI / top-k share around this project's tender | 15 |
| **Total** | | **100** |

Weights are configuration, versioned alongside the dataset so any historical score is reproducible.

## Factor sub-scores (each 0–100)

```text
f_variance          = clamp( |release_deviation_pct| / DEV_CAP , 0, 1 ) × 100      # DEV_CAP ≈ 40%
f_excessive_cost    = clamp( max(0, cost_dev_from_median_pct) / COST_CAP, 0,1)×100 # COST_CAP ≈ 60%
f_delay             = clamp( max(0, months_overdue) / DELAY_CAP , 0, 1 ) × 100     # DELAY_CAP ≈ 24
f_missing_records   = missing_expected_records / total_expected_records × 100
f_budget_revisions  = clamp( revision_score / REV_CAP, 0, 1) × 100
                       where revision_score = n_revisions + Σ|Δalloc%|/100
f_contractor_conc   = clamp( (HHI − 1500) / (10000 − 1500), 0, 1) × 100            # 0 below "moderate"
```

Anything whose inputs are unavailable contributes `0` to its own term **but** increments `missing_records`, so absence is captured once, in the right place, without double-counting.

## Composite score

```text
RiskScore = Σ ( weight_k / 100 × f_k )        clamped to [0, 100]
```

### Worked example

```text
f_variance         = 28   (weight 25) → 7.00
f_excessive_cost   = 68   (weight 20) → 13.60
f_delay            = 50   (weight 15) → 7.50
f_missing_records  = 20   (weight 15) → 3.00
f_budget_revisions = 40   (weight 10) → 4.00
f_contractor_conc  = 33   (weight 15) → 4.95
------------------------------------------------
RiskScore ≈ 40  → band: "Medium — review recommended"
```

## Bands

| Score | Band | Meaning (verification priority) |
|---|---|---|
| 0–24 | Low | Figures are internally consistent and well-covered |
| 25–49 | Medium | Some deviation or gaps; worth a look |
| 50–74 | High | Notable deviation and/or missing records |
| 75–100 | Very high | Multiple strong signals; prioritize verification |

Bands are advisory labels for triage. They never appear as conclusions about people.

## Confidence-aware scoring

Each factor's inputs carry a confidence (OCR/extraction). The engine attaches an **overall confidence** to the score:

```text
score_confidence = weighted mean of input confidences used
```

Low-confidence scores are visually de-emphasized and labeled _"based on low-confidence extracted figures."_ A score is never shown without its confidence.

## Persistence

Written to `risk_score(project_id, score, factors JSONB, computed_at, dataset_version)` where `factors` stores each sub-score, its weight, contribution, the inputs/sources used, and a neutral per-factor note. Recomputed by the nightly analytics cron and any time upstream figures for the project change.

## What the engine must never do

- Never output a label implying theft, fraud, bribery, or wrongdoing.
- Never combine factors into a claim of cause.
- Never rank *people* (contractors/officials) by "risk"; it scores **projects' data consistency and coverage** only. (Contractor concentration is a market-structure statistic about the scope, not a judgment of a contractor.)
- Never hide the breakdown — the score is meaningless to the user without its factors and sources.
