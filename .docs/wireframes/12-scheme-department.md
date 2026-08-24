# Wireframes — Scheme & department (S-45 – S-48)

These reuse the **same four-panel pattern** as S-23 — money in, money out, what was built, consistency — applied to an organizational rather than a geographic unit. One layout, learned once.

## S-45 · Scheme detail

```text
┌──────────────────────────────────────────────┐
│ ←  PMGSY                                 ⋮   │
├──────────────────────────────────────────────┤
│  Pradhan Mantri Gram Sadak Yojana            │
│  Centrally sponsored · roads                 │
│  Ministry of Rural Development               │
│  In: Pune district ▾ · FY2024-25 ▾    ☆  ⇧   │
├──────────────────────────────────────────────┤
│  ① MONEY IN                                  │
│  Allocated to Pune       ₹420.00 crore    🔗 │
│    Central share         ₹252.00 crore    🔗 │
│    State share           ₹168.00 crore    🔗 │
├──────────────────────────────────────────────┤
│  ② MONEY OUT                                 │
│  Released                ₹390.00 crore    🔗 │
│  Utilized                ₹341.00 crore    🔗 │
│  Release variance ₹49.00 cr · 12.6% of       │
│  the released amount                    (?)  │
│  ◔ Needs verification                        │
├──────────────────────────────────────────────┤
│  ③ WHAT WAS BUILT                            │
│  38 projects · 412.6 km of road              │
│  completed 21 · in progress 14 · stalled 3   │
│  Median cost per km  ₹2.75 cr (n=31)      ▸  │
│           [ Map ]   [ All projects ▸ ]       │
├──────────────────────────────────────────────┤
│  ④ ACROSS UNITS                              │
│  Baramati taluka    ₹ 82.40 cr utilized   ▸  │
│  Indapur taluka     ₹ 61.10 cr utilized   ▸  │
│  Haveli taluka      ₹ 94.20 cr utilized   ▸  │
│  ⋯                                           │
├──────────────────────────────────────────────┤
│  ⑤ CONSISTENCY                               │
│  4 observations                           ▸  │
├──────────────────────────────────────────────┤
│  ⑥ COVERAGE                                  │
│  ▤ Utilization not published for 3 talukas ▸ │
└──────────────────────────────────────────────┘
```

The central/state split is shown because `.docs/03-domain/administrative-hierarchy.md` treats scheme transfers as a distinct funding mechanism from budget allocation, and a reader tracing money needs to know which it is.

## S-47 · Department / ministry detail

```text
┌──────────────────────────────────────────────┐
│ ←  Public Works Department               ⋮   │
├──────────────────────────────────────────────┤
│  State department · Maharashtra              │
│  Domain: roads                               │
│  In: Pune district ▾ · FY2024-25 ▾    ☆  ⇧   │
├──────────────────────────────────────────────┤
│  ① MONEY IN                                  │
│  Allocated               ₹1,050.00 crore  🔗 │
│    Budget Estimate       ₹1,000.00 crore  🔗 │
│    Revised Estimate      ₹1,050.00 crore  🔗 │
│                          Revision history ▸  │
├──────────────────────────────────────────────┤
│  ② MONEY OUT                                 │
│  Released                ₹  942.00 crore  🔗 │
│  Utilized                ₹  828.40 crore  🔗 │
│  Release variance ₹113.60 cr · 12.1%    (?)  │
├──────────────────────────────────────────────┤
│  ③ WHAT WAS BUILT                            │
│  118 projects · 96 roads · 22 bridges        │
│                       [ All projects ▸ ]     │
├──────────────────────────────────────────────┤
│  ④ SCHEMES                                   │
│  PMGSY               ₹420.00 cr allocated ▸  │
│  State road fund     ₹510.00 cr allocated ▸  │
│  Other               ₹120.00 cr allocated ▸  │
├──────────────────────────────────────────────┤
│  ⑤ CONSISTENCY   8 observations           ▸  │
│  ⑥ COVERAGE      complete for this FY     ▸  │
└──────────────────────────────────────────────┘
```

Showing BE and RE side by side with a link to revision history implements `.docs/17-legal/legal-ethical-rules.md` rule 9 at department level — a revised allocation is a fact with its own source, never a silent overwrite.

## S-46 / S-48 · Lists

```text
┌──────────────────────────────────────────────┐
│ ←  Schemes in Pune district                  │
├──────────────────────────────────────────────┤
│  8 schemes · FY2024-25   Sort: Allocated ▾   │
├──────────────────────────────────────────────┤
│  PMGSY                                    ▸  │
│  Centrally sponsored · roads                 │
│  ₹420.00 cr allocated · ₹341.00 cr utilized  │
│  ────────────────────────────────────────    │
│  State road fund                          ▸  │
│  State scheme · roads                        │
│  ₹510.00 cr allocated · ₹448.20 cr utilized  │
│  ────────────────────────────────────────    │
│  15th Finance Commission grants           ▸  │
│  Transfer · untied                           │
│  ₹190.00 cr received                         │
│  ▤ Utilization not published                 │
│  ⋯                                           │
└──────────────────────────────────────────────┘
```
Every row carries figures, not just a name. Missing utilization is shown in place rather than filtered out.
