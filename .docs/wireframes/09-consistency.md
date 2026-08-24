# Wireframes — Consistency (S-33 – S-36, S-49, S-50)

## S-36 · Verification Priority breakdown

The most neutrality-sensitive screen in the app.

```text
┌──────────────────────────────────────────────┐
│ ←  Verification priority                     │
├──────────────────────────────────────────────┤
│  ⓘ This is a data-consistency indicator.     │
│    It shows where published figures are      │
│    unusual or incomplete and worth a         │
│    closer look. It is NOT an assessment      │
│    of any person or organization, and NOT    │
│    a finding of wrongdoing.                  │
├──────────────────────────────────────────────┤
│                                              │
│         ◔  40 / 100                          │
│         Medium — worth a closer look         │
│         Confidence 94%                       │
│                                              │
│  Bands   0–24 Low  ·  25–49 Medium           │
│          50–74 High · 75–100 Very high       │
│                                              │
├──────────────────────────────────────────────┤
│  HOW THIS IS MADE UP                         │
│                                              │
│  Cost above peers            weight 20%      │
│  factor 68 → contributes 13.60          ▸    │
│  Reported cost per km is 23% above the       │
│  modeled estimate and 16% above the          │
│  district median (n=19).                     │
│  ─────────────────────────────────────────   │
│  Schedule                    weight 15%      │
│  factor 50 → contributes 7.50           ▸    │
│  Expected completion 30 Jun 2026; latest     │
│  published progress 68% as of 31 Mar 2026.   │
│  ─────────────────────────────────────────   │
│  Variance                    weight 25%      │
│  factor 28 → contributes 7.00           ▸    │
│  Utilized is 11.1% below released.           │
│  ─────────────────────────────────────────   │
│  Tender concentration        weight 15%      │
│  factor 33 → contributes 4.95           ▸    │
│  In Baramati taluka FY2024-25, the top 3     │
│  contractors account for 61% of road tender  │
│  value (HHI 2,140 — moderate concentration). │
│  This is a statistic about the taluka, not   │
│  about any contractor.                       │
│  ─────────────────────────────────────────   │
│  Budget revisions            weight 10%      │
│  factor 40 → contributes 4.00           ▸    │
│  ─────────────────────────────────────────   │
│  Missing records             weight 15%      │
│  factor 20 → contributes 3.00           ▸    │
│  ─────────────────────────────────────────   │
│  Total                                40.05  │
│                                    → 40      │
├──────────────────────────────────────────────┤
│  Weights are published and versioned.        │
│  Weights version 2026.1                  ▸   │
│  [ How this score is calculated ]        (?) │
└──────────────────────────────────────────────┘
```

**Design decisions, all load-bearing:**
- Disclaimer is **first**, above the score, and cannot be collapsed.
- Factors are listed **by contribution, largest first** — a reader must be able to see immediately what is actually driving the number, rather than hunt for it.
- Each factor states its arithmetic in neutral language, and the concentration factor explicitly disclaims that it says anything about a contractor.
- The weights version is shown, so a historical score is reproducible.
- No gauge, no dial, no colour bar, no red. The band glyph is a quiet fill indicator.

## S-33 · Road intelligence

```text
┌──────────────────────────────────────────────┐
│ ←  Road cost · ODR-14 Baramati               │
├──────────────────────────────────────────────┤
│  ROAD AS PUBLISHED                           │
│  Class ODR · 10.0 km · 7.0 m              🔗 │
│  Surface bituminous                       🔗 │
├──────────────────────────────────────────────┤
│  COST PER KM                                 │
│                                              │
│  Reported          ₹3.20 crore/km         🔗 │
│  Modeled estimate  ₹2.60 crore/km   +23.1%   │
│  District median   ₹2.75 crore/km   +16.4%   │
│                    (n=19 comparable roads)   │
│                                              │
│   ├──────┼────────┼────────●──────┤          │
│   1.8   median   model            4.6        │
│                              this project    │
│                                              │
│  [ View as list ]                            │
├──────────────────────────────────────────────┤
│  ⓘ CAVEAT                                    │
│  Modeled estimates are engineering           │
│  approximations with stated assumptions.     │
│  Real designs vary by terrain, soil, traffic,│
│  drainage, and structures. A deviation can   │
│  be entirely legitimate.                     │
├──────────────────────────────────────────────┤
│  MODEL (road-model 2026.1)                ▸  │
│  Carriageway area     70,000 m²              │
│  Expected asphalt     19,320 t               │
│  Bitumen binder          966 t               │
│  Layer thicknesses / densities / rates    ▸  │
│  Rates from MH Schedule of Rates 2024     🔗 │
├──────────────────────────────────────────────┤
│  [ How this is calculated ]              (?) │
└──────────────────────────────────────────────┘
```
If length, width, or surface type is missing, this whole block is replaced by *"Estimate withheld — road width not published"* (`.docs/03-domain/road-infrastructure-intelligence.md`). Never guessed.

## S-34 / S-35 · Observations

```text
S-34                                S-35
┌────────────────────────────┐   ┌────────────────────────────┐
│ ←  Observations (3)        │   │ ←  Observation             │
├────────────────────────────┤   ├────────────────────────────┤
│ ⓘ Data-consistency          │   │ ⓘ A data-consistency       │
│   observations from        │   │   observation, not a       │
│   official records, not    │   │   finding of wrongdoing.   │
│   findings of wrongdoing.  │   ├────────────────────────────┤
├────────────────────────────┤   │ ◑ Reported cost per km is  │
│ ◑ Reported cost per km is  │   │   23% above the modeled    │
│   23% above the modeled    │   │   estimate and 16% above   │
│   estimate and 16% above   │   │   the district median      │
│   the district median      │   │   (n=19).                  │
│   (n=19)                 ▸ │   ├────────────────────────────┤
│   medium · 97% confidence  │   │ THE ARITHMETIC             │
├────────────────────────────┤   │ (3.20 − 2.60) ÷ 2.60 × 100 │
│ ◔ Utilized is 11.1% below  │   │   = +23.1%                 │
│   released               ▸ │   │ (3.20 − 2.75) ÷ 2.75 × 100 │
│   low · 100% confidence    │   │   = +16.4%                 │
├────────────────────────────┤   │ Threshold for this         │
│ ○ No progress record       │   │ category: 15%         (?)  │
│   published since Mar 2026│   ├────────────────────────────┤
│   info                   ▸ │   │ FIGURES USED               │
└────────────────────────────┘   │ Utilized ₹8.00 cr       🔗 │
                                 │ Length   10.0 km        🔗 │
                                 │ Model    ₹2.60 cr/km    🔗 │
                                 │ Median   ₹2.75 cr/km       │
                                 │   from 19 roads         ▸  │
                                 ├────────────────────────────┤
                                 │ Detected 01 Aug 2026       │
                                 │ Dataset version 137        │
                                 ├────────────────────────────┤
                                 │ [ Share evidence ]         │
                                 │ [ 💬 Explain this ]        │
                                 └────────────────────────────┘
```
S-35 shows **the full arithmetic and every input with its source**. That is what makes an observation checkable rather than asserted.

## S-49 · Observations, scoped   ·   S-50 · Filters

```text
S-49  (always entered from a unit or project — never a global feed)
┌──────────────────────────────────────────────┐
│ ←  Worth verifying · Pune · FY2024-25    ⚙   │
├──────────────────────────────────────────────┤
│  ⓘ These are data-consistency observations   │
│    from official records, not findings of    │
│    wrongdoing. They indicate where figures   │
│    are unusual or incomplete.                │
├──────────────────────────────────────────────┤
│  12 observations                             │
│  Sort: Most recent ▾                         │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ ◑ Reported cost per km is 23% above the │ │
│ │   district median (n=19)               ▸ │ │
│ │   Upgradation of ODR-14, Baramati        │ │
│ │   medium · 97% · 01 Aug 2026             │ │
│ ├──────────────────────────────────────────┤ │
│ │ ◔ Utilized is 11.1% below released     ▸ │ │
│ │   Upgradation of ODR-14, Baramati        │ │
│ └──────────────────────────────────────────┘ │
│  ⋯ (cursor-paged)                            │
├──────────────────────────────────────────────┤
│  Coverage gaps are listed separately.    ▸   │
└──────────────────────────────────────────────┘
```

**Sort options are: most recent, severity, project name. There is no "highest score first" default**, and no cross-unit "worst projects" view — that would be the leaderboard `.docs/08-risk/risk-scoring-engine.md` forbids.

**Empty state matters here:** *"No consistency observations for Pune district in FY2024-25. This may mean the published records are consistent — or that records are missing."* → ▸ Coverage.
