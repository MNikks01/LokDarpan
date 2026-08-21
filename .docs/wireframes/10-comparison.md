# Wireframes — Comparison (S-37, S-38)

## S-37 · Picker

```text
┌──────────────────────────────────────────────┐
│ ←  Compare with                              │
├──────────────────────────────────────────────┤
│  Comparing: Upgradation of ODR-14, Baramati  │
│  Rural road · 10.0 km · Pune                 │
├──────────────────────────────────────────────┤
│  SUGGESTED PEERS                             │
│  Same category, district, and scale bucket   │
│  ┌────────────────────────────────────────┐  │
│  │ ☑ Katewadi–Supe road repair            │  │
│  │   Rural road · 8.4 km · Baramati       │  │
│  ├────────────────────────────────────────┤  │
│  │ ☑ ODR-22 upgradation, Indapur          │  │
│  │   Rural road · 11.2 km · Indapur       │  │
│  ├────────────────────────────────────────┤  │
│  │ ☐ Supe–Malegaon road, Baramati         │  │
│  │   Rural road · 9.1 km · Baramati       │  │
│  │   ▤ no expenditure published           │  │
│  └────────────────────────────────────────┘  │
│  🔍 Add another project                   ▸  │
├──────────────────────────────────────────────┤
│  ⓘ Comparison is most meaningful between     │
│    projects of similar type and scale.       │
│  [ Compare 3 projects ]                      │
└──────────────────────────────────────────────┘
```
Peer suggestions come from the same peer-set logic the analytics engine uses (`docs/06` §4) — so what a user compares by hand matches what the engine compares automatically.

## S-38 · Result — cards, never a table

```text
┌──────────────────────────────────────────────┐
│ ←  Comparison (3)                        ⇧   │
├──────────────────────────────────────────────┤
│  Metric  Cost per km ▾                       │
├──────────────────────────────────────────────┤
│  DISTRIBUTION (19 comparable rural roads)    │
│   ├────┼──────┼──────●──▲───┤                │
│   1.8 median 2.75   3.20 3.44                │
│         ▲ = the other two projects           │
├──────────────────────────────────────────────┤
│  ◀ ─────────── swipe ─────────────── ▶       │
│  ┌────────────────────────────────────────┐  │
│  │ Upgradation of ODR-14, Baramati        │  │
│  │ Rural road · in progress               │  │
│  │                                        │  │
│  │ Cost per km     ₹3.20 crore/km      🔗 │  │
│  │                 +16.4% vs median       │  │
│  │ Length          10.0 km             🔗 │  │
│  │ Allocated       ₹10.00 crore        🔗 │  │
│  │ Released        ₹ 9.00 crore        🔗 │  │
│  │ Utilized        ₹ 8.00 crore        🔗 │  │
│  │ Release var.    ₹ 1.00 cr · 11.1%      │  │
│  │ Status          ◔ Needs verification   │  │
│  │ Contractor      ABC Infra Pvt Ltd   ▸  │  │
│  │                          Open ▸        │  │
│  └────────────────────────────────────────┘  │
│  ● ○ ○                                       │
├──────────────────────────────────────────────┤
│  ALL THREE, BY METRIC                        │
│                                              │
│  Cost per km                                 │
│   ODR-14 Baramati    ₹3.20 cr/km      +16.4% │
│   ODR-22 Indapur     ₹3.44 cr/km      +25.1% │
│   Katewadi–Supe      ₹1.67 cr/km      −39.3% │
│                                              │
│  Release variance                            │
│   ODR-14 Baramati    ₹1.00 cr · 11.1%        │
│   ODR-22 Indapur     ₹0.20 cr ·  1.8%        │
│   Katewadi–Supe      ⊘ insufficient data     │
│                                              │
│  Status                                      │
│   ODR-14 Baramati    ◔ Needs verification    │
│   ODR-22 Indapur     ○ Consistent            │
│   Katewadi–Supe      ⊘ Insufficient data     │
├──────────────────────────────────────────────┤
│  ⓘ Differences in cost per km can reflect    │
│    terrain, soil, traffic load, drainage,    │
│    structures, and the year of the rates     │
│    used. A higher figure is not by itself    │
│    an indication of anything.                │
├──────────────────────────────────────────────┤
│  [ Share evidence ]                          │
└──────────────────────────────────────────────┘
```

### Why cards + a metric rail instead of a table

- A 3×12 table at 390 pt requires horizontal scrolling, which hides columns and breaks with font scaling.
- **Vertical, per-metric grouping keeps every comparison a same-axis comparison** — the reader compares three numbers of the same kind on one line, which is what a table is actually for.
- Each card keeps its **source chips**, which a table cell cannot carry.
- `insufficient_data` appears explicitly per metric per project — a table would tempt a blank cell, and a blank cell reads as zero.
- The caveat block is mandatory: cost-per-km differences have many legitimate causes, and a comparison screen is where a reader is most likely to over-conclude.
