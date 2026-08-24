# Wireframes — Unit detail (S-23, S-25, S-26, S-51)

**S-23 is the single most important screen in the app.** It replaces the six separate dashboards of `.docs/01-product/dashboard-design-legacy.md` (National, State, District, Village/Local-Body, Infrastructure, Audit). The same six sections, in the same order, at *every* level — learned once at district level, applied in a village.

## S-23 · Unit detail

```text
┌──────────────────────────────────────────────┐
│ ←  Pune                                 ⋮    │
│ ↑ India › Maharashtra                     ▸  │
├──────────────────────────────────────────────┤
│  District · LGD 521 · pop. 94.3 lakh         │
│  FY2024-25 ▾                        ☆  ⇧     │
├──────────────────────────────────────────────┤
│                                              │
│  ① MONEY IN                                  │
│  ┌────────────────────────────────────────┐  │
│  │ Allocated            ₹1,240.00 cr   🔗 │  │
│  │   Budget allocation  ₹1,050.00 cr   🔗 │  │
│  │   Transfers received ₹  190.00 cr   🔗 │  │
│  │                                        │  │
│  │ BY SCHEME                              │  │
│  │   PMGSY              ₹  420.00 cr   🔗 │  │
│  │   State road fund    ₹  510.00 cr   🔗 │  │
│  │   15th FC grants     ₹  190.00 cr   🔗 │  │
│  │   Other              ₹  120.00 cr   🔗 │  │
│  │                          See all ▸     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ② MONEY OUT                                 │
│  ┌────────────────────────────────────────┐  │
│  │   Allocated   ₹1,240.00 cr          🔗 │  │
│  │        │                               │  │
│  │        ├ Allocation variance (A−U)     │  │
│  │        │  ₹271.60 cr · 21.9% of the    │  │
│  │        │  allocated amount        (?)  │  │
│  │        │                               │  │
│  │   Released    ₹1,102.00 cr          🔗 │  │
│  │        │                               │  │
│  │        ├ Release variance (R−U)        │  │
│  │        │  ₹133.60 cr · 12.1% of the    │  │
│  │        │  released amount         (?)  │  │
│  │        │                               │  │
│  │   Utilized    ₹  968.40 cr          🔗 │  │
│  │                                        │  │
│  │   ◔ Needs verification            (?)  │  │
│  │                    See ledger ▸        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ③ WHAT WAS BUILT                            │
│  ┌────────────────────────────────────────┐  │
│  │ 142 projects                           │  │
│  │   118 roads · 24 bridges               │  │
│  │                                        │  │
│  │ in progress 61 · completed 58          │  │
│  │ sanctioned 18 · stalled 5              │  │
│  │                                        │  │
│  │  [ View on map ]   [ All projects ▸ ]  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ④ CONSISTENCY                               │
│  ⓘ Data-consistency observations from        │
│    official records, not findings of         │
│    wrongdoing.                               │
│  ┌────────────────────────────────────────┐  │
│  │ Roll-up check                        ▸ │  │
│  │ Sub-unit allocations sum to 8.2% more  │  │
│  │ than this district's recorded          │  │
│  │ allocation. Records may be incomplete. │  │
│  ├────────────────────────────────────────┤  │
│  │ Compared with 33 other districts     ▸ │  │
│  │ Per-capita expenditure ₹1,027         │  │
│  │ 28% above the state median (n=34)      │  │
│  ├────────────────────────────────────────┤  │
│  │ 12 observations                      ▸ │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ⑤ SUB-UNITS                                 │
│  ┌────────────────────────────────────────┐  │
│  │ 14 talukas · 13 local bodies         ▸ │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ⑥ COVERAGE                                  │
│  ┌────────────────────────────────────────┐  │
│  │ ▤ 3 of 14 talukas have no published    │  │
│  │   expenditure for FY2024-25.           │  │
│  │   Expected source: MH PWD — Works      │  │
│  │   Last checked: 18 Aug 2026        ▸   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 💬 Ask about Pune district           ▸ │  │
│  └────────────────────────────────────────┘  │
│  Data as of 04 Aug 2026 · version 137        │
└──────────────────────────────────────────────┘
```

### The same screen at Gram Panchayat level

```text
┌──────────────────────────────────────────────┐
│ ←  Katewadi Gram Panchayat              ⋮    │
│ ↑ … › Pune › Baramati › Baramati P.S.     ▸  │
├──────────────────────────────────────────────┤
│  Gram Panchayat · LGD 556104 · pop. 3,412    │
├──────────────────────────────────────────────┤
│  ⑥ COVERAGE  ← promoted to the top here      │
│  ┌────────────────────────────────────────┐  │
│  │ ▤ Limited records for FY2024-25        │  │
│  │   Money in    2 scheme grants        ✓ │  │
│  │   Money out   no records             ▤ │  │
│  │   Works       4 works listed         ✓ │  │
│  │   [ What's missing and why ]         ▸ │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ① MONEY IN                                  │
│  ┌────────────────────────────────────────┐  │
│  │ 15th FC grant       ₹ 18.40 lakh    🔗 │  │
│  │ MGNREGA             ₹ 42.10 lakh    🔗 │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ② MONEY OUT                                 │
│  ┌────────────────────────────────────────┐  │
│  │ ▤ No expenditure records published for │  │
│  │   this Gram Panchayat in FY2024-25.    │  │
│  │                                        │  │
│  │   This does not mean no money was      │  │
│  │   spent — it means the record has not  │  │
│  │   been published or collected yet.     │  │
│  │                                        │  │
│  │   Expected source:                     │  │
│  │   MH Rural Development — GP accounts   │  │
│  │   Last checked: 18 Aug 2026            │  │
│  │                                        │  │
│  │   ⊘ Insufficient data — no variance    │  │
│  │     can be calculated.            (?)  │  │
│  │                                        │  │
│  │   [ Report a data issue ]              │  │
│  └────────────────────────────────────────┘  │
```

**Same six sections, same order.** Only the emphasis changes — coverage leads where publication is weakest. No variance is computed across the gap, and `₹0` is never shown.

## S-25 · Roll-up consistency

```text
┌──────────────────────────────────────────────┐
│ ←  Roll-up check · Pune · FY2024-25          │
├──────────────────────────────────────────────┤
│  ⓘ This compares recorded figures. A gap     │
│    means records may be incomplete — it is   │
│    not a claim that money went missing.      │
├──────────────────────────────────────────────┤
│  This district's recorded allocation         │
│                          ₹1,240.00 cr     🔗 │
│                                              │
│  Sum of its 14 talukas' allocations          │
│                          ₹1,341.68 cr        │
│                                              │
│  Difference              ₹  101.68 cr        │
│  8.2% of the district's allocation      (?)  │
├──────────────────────────────────────────────┤
│  INCLUDED IN THE SUM (11 of 14)              │
│  Baramati        ₹142.60 cr               🔗 │
│  Haveli          ₹318.40 cr               🔗 │
│  ⋯                                           │
├──────────────────────────────────────────────┤
│  ▤ NOT IN THE SUM (3)                        │
│  Indapur · Mulshi · Velhe                    │
│  No allocation records published for these   │
│  talukas — the sum above is incomplete, so   │
│  the difference may be larger or smaller.    │
├──────────────────────────────────────────────┤
│  [ How this is calculated ]              (?) │
└──────────────────────────────────────────────┘
```

Naming which children are **missing from the sum** is what turns a suspicious-looking gap into an honest one.

## S-26 · Peer comparison

```text
┌──────────────────────────────────────────────┐
│ ←  Compared with other districts             │
├──────────────────────────────────────────────┤
│  Metric  Per-capita expenditure ▾            │
│  FY2024-25 · 34 districts in Maharashtra     │
├──────────────────────────────────────────────┤
│                                              │
│   ├────────────┼──────●─────────────┤        │
│   ₹410      median      Pune      ₹2,180     │
│             ₹802       ₹1,027                │
│                                              │
│  Pune is 28% above the state median.    (?)  │
│  Based on 34 districts with published        │
│  expenditure for this year.                  │
│                                              │
│  ⓘ Higher or lower is not better or worse.   │
│    Districts differ in size, terrain,        │
│    road length, and scheme mix.              │
├──────────────────────────────────────────────┤
│  Ahmednagar   ₹1,412                      ▸  │
│  Nashik       ₹1,190                      ▸  │
│  Pune         ₹1,027                      ▸  │
│  Satara       ₹  884                      ▸  │
│  ⋯            (alphabetical, NOT ranked)     │
└──────────────────────────────────────────────┘
```

The list is **alphabetical, never ranked by the metric.** A descending list is a leaderboard, and a leaderboard of districts by spending is an implicit judgment (`.docs/08-risk/risk-scoring-engine.md`).

Below n=8: *"Fewer than 8 comparable districts have published data — comparison withheld."*

## S-51 · Coverage report

```text
┌──────────────────────────────────────────────┐
│ ←  Coverage · Pune · FY2024-25               │
├──────────────────────────────────────────────┤
│  What we have, and what we don't.            │
│  Missing records are a publication gap —     │
│  not a finding about anyone.                 │
├──────────────────────────────────────────────┤
│  PRESENT                                     │
│  ✓ Allocations          14 of 14 talukas     │
│  ✓ Tenders             132 records           │
│  ✓ Project progress    118 of 142 projects   │
├──────────────────────────────────────────────┤
│  MISSING                                     │
│  ▤ Expenditure          3 of 14 talukas      │
│    Indapur · Mulshi · Velhe                  │
│    Expected: MH PWD — Works                  │
│    Last checked: 18 Aug 2026              ▸  │
│                                              │
│  ▤ Progress             24 of 142 projects ▸ │
├──────────────────────────────────────────────┤
│  LOW CONFIDENCE                              │
│  ⚠ 18 figures extracted by OCR at below      │
│    90% confidence                         ▸  │
├──────────────────────────────────────────────┤
│  [ Report a data issue ]                     │
└──────────────────────────────────────────────┘
```

Coverage gaps and low-confidence values are kept **separate from deviations** (`.docs/01-product/dashboard-design-legacy.md`) — a gap is a reason to ask a department a question; a deviation is a reason to check a figure.
