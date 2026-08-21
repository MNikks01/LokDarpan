# 06 — Analytics Engine

The analytics engine turns the canonical ledger into **derived facts and neutral observations**. It is deterministic, reproducible (pinned to a `dataset_version`), and every output records the inputs and sources it used. It computes numbers; it never assigns intent. Language rules from [15](./15-Legal-Ethical-Rules.md) apply to every label it emits.

**Stack:** Python + pandas + DuckDB (DuckDB reads directly from Postgres/parquet for fast columnar aggregation). Results are written back to analytics tables / materialized views ([04](./04-Database-Design.md)).

## Conventions

- `A` = allocated, `R` = released, `U` = utilized (all in ₹).
- All ratios guard against divide-by-zero → return `null` + a `missing_data` note rather than `Infinity`.
- "Comparable projects" = same `category`, similar scale bucket, and (for district comparison) same or peer district.

---

## 1. Variance detection

Two complementary variances are computed and labeled explicitly so they are never conflated:

```text
Release variance   = Released − Utilized            = R − U
Allocation variance = Allocated − Utilized          = A − U
```

**Deviation percentages** (signed; denominator is the upstream figure):

```text
Release deviation %    = ((R − U) / R) × 100     (null if R = 0)
Allocation deviation % = ((A − U) / A) × 100     (null if A = 0)
```

Worked example (the brief's example, release-based):

```text
R = ₹9 crore, U = ₹8 crore
Release variance = 9 − 8 = ₹1 crore
Release deviation % = (1 / 9) × 100 = 11.1%
→ status: "needs_verification"   (observation only)
```

**Directional flags (facts, not verdicts):**

| Condition | Recorded observation | Anomaly type |
|---|---|---|
| `U > R` | "Utilized amount exceeds released amount by X%." | `utilization_exceeds_release` |
| `R > A` | "Released amount exceeds allocated amount by X%." | `release_exceeds_allocation` |
| `abs(deviation%) > τ` | "Utilization deviates from released amount by X%." | `variance_gap` |

`τ` (threshold) is configurable per category and documented; default illustrative `τ = 10%`.

## 2. Budget consistency

Checks the chain **Allocated ≥ Released ≥ Utilized** holds. This is the expected ordering; violations are surfaced, not corrected.

```python
def budget_consistency(A, R, U):
    if A is None or R is None or U is None:
        return {"status": "insufficient_data", "missing": _which_missing(A, R, U)}
    ordered = (A >= R >= U)
    return {
        "status": "consistent" if ordered else "needs_verification",
        "checks": {
            "released_le_allocated": R <= A,
            "utilized_le_released": U <= R,
        },
        "release_variance": R - U,
        "allocation_variance": A - U,
    }
```

## 3. Cost-per-kilometer (roads)

```text
Cost per km (₹/km) = Utilized (₹) / Road length (km)     (null if length = 0 or missing)
```

Detailed material/asphalt/expected-cost modeling in [08 — Road Infrastructure Intelligence](./08-Road-Infrastructure-Intelligence.md). The analytics engine stores `cost_per_km_inr` for every road-bearing project so it can be compared.

## 4. District comparison

For a given project, compare its metric (e.g. cost/km) against the **distribution of comparable projects in the same district**.

```text
Peer set P = comparable projects in same district & category
median_P   = median(cost_per_km over P)
Deviation from district median % = ((x − median_P) / median_P) × 100
```

We prefer **median and IQR** over mean/σ because infrastructure costs are skewed and median is robust to outliers.

```text
Robust z (modified z-score) = 0.6745 × (x − median_P) / MAD_P
   where MAD_P = median(|xᵢ − median_P|)
```

Observation emitted (example): _"This project's cost per km is 41% above the district median for comparable rural roads (n=23)."_ — a comparison, never a claim of wrongdoing. Minimum peer count (e.g. `n ≥ 8`) required or the comparison is withheld with a `low_sample` note.

## 5. Historical comparison

Compare a project/department metric against its own or the category's history across fiscal years.

```text
YoY change % = ((x_t − x_{t−1}) / x_{t−1}) × 100
Trend (CAGR over k years) = ( (x_t / x_{t−k})^(1/k) − 1 ) × 100
```

Used for budget-revision trends and to contextualize whether a deviation is unusual relative to the past.

## 6. Inflation adjustment

To compare rupee amounts across years fairly, convert nominal to **real** using an official deflator (e.g. CPI / a construction cost index published by an official body — the exact index is declared as a source).

```text
Real amount (base year b) = Nominal_t × (Index_b / Index_t)
```

All cross-year comparisons run on inflation-adjusted figures by default; the nominal figure is always shown alongside with the index and base year cited. If no official index is available for a period, the comparison is marked `nominal_only`.

## 7. Anomaly scoring (per-metric)

Each candidate metric produces an **anomaly signal** in [0,1] from its robust z-score, then anomalies are persisted (see `anomaly` table). Signal is a bounded transform so extreme outliers don't dominate:

```text
z    = robust z-score of metric vs peer set
signal = min(1, |z| / z_cap)        with z_cap ≈ 3.5
severity:
   signal < 0.33  → low
   0.33–0.66      → medium
   > 0.66         → high
   (info: informational flags like missing records)
```

An anomaly is only created when `signal` clears a floor AND the peer sample is adequate AND input confidence is sufficient; otherwise a `low_confidence`/`low_sample` note is attached instead of a flag. Anomaly-level signals feed the composite **risk score** in [07](./07-Risk-Scoring-Engine.md).

## 8. Contractor concentration

Measures how concentrated tender value is among contractors within a scope (taluka/district/department/FY) using the **Herfindahl–Hirschman Index (HHI)**.

```text
share_i = awarded_value_i / total_awarded_value
HHI = Σ (share_i × 100)²           range 0..10,000
CRk (top-k concentration) = Σ_{i=1..k} share_i × 100     (%)
```

Interpretation labels (descriptive, standard economics; **not** accusatory):

| HHI | Descriptive label |
|---|---|
| < 1500 | "competitive / low concentration" |
| 1500–2500 | "moderate concentration" |
| > 2500 | "high concentration" |

Observation example: _"In this taluka, the top 3 contractors account for 78% of road tender value in FY2024-25 (HHI 3120)."_ Purely a market-structure statistic.

---

## National-scale analytics (all levels, all domains)

The same deterministic, source-linked engine runs across the full hierarchy ([19](./19-Administrative-Hierarchy.md)) and every infrastructure domain. Only the **normalizer** and **peer set** change per level/domain.

### 9. Multi-level comparison (state / district / ministry / local body)

Any unit is compared against its **sibling units** on a normalized metric, using the same robust median/MAD machinery as §4:

```text
Normalized metric options:
  per_capita        = Σ utilized_inr(unit) / population(unit)
  per_area          = Σ utilized_inr(unit) / area_km²(unit)
  per_project       = Σ utilized_inr(unit) / project_count(unit)
  utilization_ratio = utilized_inr(unit) / allocated_inr(unit)

Deviation from peer median % = ((x_unit − median_siblings) / median_siblings) × 100
Robust z = 0.6745 × (x_unit − median_siblings) / MAD_siblings
```

- **State comparison:** state vs state on per-capita scheme spend / utilization ratio.
- **District comparison:** district vs district within a state.
- **Ministry comparison:** ministry vs ministry on allocation-vs-utilization, or a scheme across ministries.
- **Local-body comparison:** ULB vs ULB, GP vs GP on per-capita expenditure.

Observation example (neutral): _"This district's per-capita road expenditure is 28% above the state median for FY2024-25 (n=34 districts)."_

### 10. Vertical roll-up consistency

Checks that children reconcile with their parent across the hierarchy (the cascade check from [19](./19-Administrative-Hierarchy.md)):

```text
Roll-up gap = Σ allocation(children, scheme, FY) − allocation(parent → children, scheme, FY)
Roll-up gap % = (Roll-up gap / parent_allocation) × 100
```

A non-zero gap is reported as _"sub-unit allocations sum to X% more/less than the parent's recorded allocation — records may be incomplete"_ — never as a claim of diversion. Guarded for missing children (partial coverage → `low_coverage` note, not a flag).

### 11. Cost-per-unit metrics (domain intelligence)

Generalizes cost/km ([08](./08-Road-Infrastructure-Intelligence.md)) to social/utility infrastructure. Each divides utilized cost by a capacity attribute from the asset tables ([04](./04-Database-Design.md)):

```text
Cost per km            = utilized_inr / Σ length_km            (roads, railways, pipelines)
Cost per school        = utilized_inr / school_count           (or per classroom)
Cost per classroom     = utilized_inr / Σ classrooms
Cost per hospital bed  = utilized_inr / Σ beds
Cost per seat          = utilized_inr / Σ seats                (colleges)
Cost per MW / per MLD  = utilized_inr / capacity               (power / water)
Cost per sq.m          = utilized_inr / Σ area_sqm             (buildings)
```

Each is compared to the peer distribution (same facility type, same/peer district) exactly as cost/km is — robust median, minimum sample, model-vs-actual where an expected-cost model exists.

Worked example:

```text
District hospital block: utilized ₹18 crore, 120 beds
Cost per bed = 180,000,000 / 120 = ₹15,00,000 per bed
District median (comparable hospital projects, n=11) = ₹12,20,000 per bed
Deviation = (15.0 − 12.2)/12.2 × 100 = +23.0%
Observation: "Reported cost per hospital bed is 23% above the district median (n=11)."
```

### 12. Domain-aware anomaly & risk feed

Every metric above produces the same bounded anomaly signal (§7) and feeds the composite risk score ([07](./07-Risk-Scoring-Engine.md)); thresholds are configured **per domain** (a rural road and a metro line have different normal ranges), and each threshold set is versioned with the dataset.

## Output contract

Every analytic result stores: `metric`, `value`, `unit`, `level`, `domain`, `peer_set_size`, `inputs` (row ids + `source_document_id`), `dataset_version`, `computed_at`, and a **neutral `observation` string**. Nothing reaches the API without provenance and a version tag, guaranteeing reproducibility and traceability.
