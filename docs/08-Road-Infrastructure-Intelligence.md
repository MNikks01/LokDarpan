# 08 — Road Infrastructure Intelligence

This module estimates **expected** engineering quantities and costs for a road from its published physical attributes, and compares actuals against peers. The expected values are **transparent reference models with stated assumptions** — they are engineering estimates for context, not official standards, and never a claim that a deviation is improper. Every coefficient is configurable, sourced (e.g. from published Schedule of Rates / Morth/IRC norms where available), and shown to the user.

> **Framing rule:** outputs are phrased as _"expected under model X"_ vs _"reported."_ A gap is _"reported cost is 35% above the modeled estimate,"_ never _"overcharged."_ See [15](./15-Legal-Ethical-Rules.md).

## Inputs (from `road` / `project_finance`)

- `length_km`, `width_m`, `surface_type`, `road_class`
- `utilized_inr` (actual expenditure), `district_id`, `fiscal_year`
- Model coefficients (config, versioned, sourced): layer thicknesses, material densities, unit rates (SoR).

## 1. Cost per kilometer

```text
Cost per km (₹/km) = Utilized (₹) / Length (km)        (null if length missing/0)
```

## 2. Average width

For a project spanning multiple road segments:

```text
Length-weighted average width (m) = Σ(length_i × width_i) / Σ(length_i)
```

Width is also used to derive carriageway area for material estimates.

## 3. Carriageway area

```text
Area (m²) = Length (m) × Width (m) = (length_km × 1000) × width_m
```

## 4. Expected material — bituminous (asphalt) road model

A simplified multi-layer flexible-pavement model. Thicknesses `t_layer` (m) come from config by `road_class` (illustrative defaults shown; replace with the applicable IRC/SoR spec at implementation).

```text
Layer volume (m³)      = Area (m²) × t_layer (m)
Layer mass (tonnes)    = Layer volume × density (t/m³)
```

Illustrative coefficients (config — **must be replaced with official spec values**):

| Layer | Default thickness `t` | Default density |
|---|---|---|
| Bituminous surface (BC) | 0.040 m | 2.4 t/m³ |
| Dense bituminous macadam (DBM) | 0.075 m | 2.4 t/m³ |
| Wet mix macadam (WMM) base | 0.250 m | 2.2 t/m³ |
| Granular sub-base (GSB) | 0.200 m | 2.1 t/m³ |

### Expected asphalt (bituminous) quantity

```text
Asphalt volume (m³)  = Area × (t_BC + t_DBM)
Asphalt mass (t)     = Asphalt volume × density_bitmix
Bitumen binder (t)   = Asphalt mass × binder_fraction        (binder_fraction ≈ 0.05)
```

### Expected aggregate / sub-base quantities

```text
WMM (t) = Area × t_WMM × density_WMM
GSB (t) = Area × t_GSB × density_GSB
```

## 5. Expected construction cost (bottom-up)

```text
Material cost   = Σ_layer ( quantity_layer × unit_rate_layer )      # unit_rate from Schedule of Rates
Labour+plant    = Material cost × lp_factor                          # lp_factor from SoR, e.g. 0.35
Overheads       = (Material + Labour+plant) × overhead_factor        # e.g. 0.10
Expected cost   = Material cost + Labour+plant + Overheads
Expected cost/km = Expected cost / length_km
```

All factors and unit rates are **displayed with their source and effective year**, and adjusted for inflation to the project year using the official index ([06 §6](./06-Analytics-Engine.md)).

## 6. Comparison with district average

Two independent reference points are shown side by side so the user can judge:

```text
(a) Model-based:   Deviation_model %   = ((cost/km_actual − cost/km_expected) / cost/km_expected) × 100
(b) Peer-based:    Deviation_district% = ((cost/km_actual − median_district) / median_district) × 100
```

Where `median_district` is the robust median of cost/km over comparable roads in the district ([06 §4](./06-Analytics-Engine.md)), with peer count `n` shown and a minimum-sample guard.

### Worked example

```text
Road: length 10 km, width 7 m, bituminous
Area = 10,000 m × 7 m = 70,000 m²

Asphalt volume = 70,000 × (0.040 + 0.075) = 8,050 m³
Asphalt mass   = 8,050 × 2.4 ≈ 19,320 t
Bitumen binder = 19,320 × 0.05 ≈ 966 t

Actual utilized = ₹32 crore → cost/km = ₹3.20 crore/km
Expected (model) cost/km      = ₹2.60 crore/km
District median cost/km (n=19)= ₹2.75 crore/km

Deviation_model    = (3.20 − 2.60)/2.60 × 100 = +23.1%
Deviation_district = (3.20 − 2.75)/2.75 × 100 = +16.4%

Observation: "Reported cost per km is 23% above the modeled estimate and
16% above the district median for comparable bituminous roads (n=19)."
```

That observation is descriptive and reproducible. It carries the model coefficients, the peer set, and the source of every figure — and it makes **no** claim about why the difference exists.

## Outputs

Per road/project the module stores: `cost_per_km_actual`, `cost_per_km_expected`, `expected_asphalt_tonnes`, `expected_material_breakdown` (JSONB), `deviation_model_pct`, `deviation_district_pct`, `peer_n`, `model_version`, and a neutral `observation`. These feed the Project Detail page ([09](./09-Dashboard-Design.md)), the `cost_per_km_outlier` anomaly type, and the `excessive_cost` risk factor ([07](./07-Risk-Scoring-Engine.md)).

## Caveats (always displayed)

- The model is a **simplification**; real designs vary by terrain, soil (CBR), traffic (MSA), drainage, and structures. Deviations can be fully legitimate.
- Coefficients and unit rates must track the applicable IRC codes and the current Schedule of Rates; the effective spec/year is shown.
- If width, length, or surface type is missing, the estimate is withheld with a missing-data note rather than guessed.
