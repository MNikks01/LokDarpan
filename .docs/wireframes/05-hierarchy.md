# Wireframes — Hierarchy browser (S-22, S-24)

## S-22 · One level per screen

```text
┌──────────────────────────────────────────────┐
│ ←  Pune district                        ⋮    │
│ ↑ India › Maharashtra                     ▸  │
├──────────────────────────────────────────────┤
│  14 talukas          Sort: Utilized ▾    🔍  │
├──────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │ Baramati                             ▸ │  │
│  │ Taluka · 41 projects                   │  │
│  │ ₹142.60 cr utilized                 🔗 │  │
│  ├────────────────────────────────────────┤  │
│  │ Haveli                               ▸ │  │
│  │ Taluka · 68 projects                   │  │
│  │ ₹318.40 cr utilized                 🔗 │  │
│  ├────────────────────────────────────────┤  │
│  │ Indapur                              ▸ │  │
│  │ Taluka · 22 projects                   │  │
│  │ ▤ No expenditure records published     │  │
│  │   for FY2024-25                        │  │
│  ├────────────────────────────────────────┤  │
│  │ Mulshi                               ▸ │  │
│  │ Taluka · 19 projects                   │  │
│  │ ₹48.20 cr utilized                  🔗 │  │
│  └────────────────────────────────────────┘  │
│  ⋯                                           │
├──────────────────────────────────────────────┤
│  3 of 14 talukas have no published           │
│  expenditure for this year.              ▸   │
└──────────────────────────────────────────────┘
```

**Each row carries a metric, not just a name.** A list of 14 names is a directory; a list of 14 names with utilized amounts is a screen you can reason from. (This is why `GET /units/:id/children` must return a per-child metric — `.docs/18-mobile-api-contract.md`.)

Missing rows are shown **in place**, not filtered out, so the reader sees the gap in the sequence.

## Drilling down — urban and rural diverge

```text
Pune district
   ├─ RURAL                          ├─ URBAN
   │  Baramati taluka                │  Pune Municipal Corporation
   │    └ Panchayat Samiti           │    └ Ward 14
   │        └ Gram Panchayat         │
   │            └ Village            │  Baramati Nagar Parishad
   │                └ Ward           │    └ Ward 3
```

```text
┌──────────────────────────────────────────────┐
│ ←  Baramati taluka                      ⋮    │
│ ↑ India › Maharashtra › Pune              ▸  │
├──────────────────────────────────────────────┤
│  RURAL BODIES                                │
│  Baramati Panchayat Samiti               ▸   │
│    38 Gram Panchayats                        │
├──────────────────────────────────────────────┤
│  URBAN BODIES                                │
│  Baramati Nagar Parishad                 ▸   │
│    24 wards                                  │
├──────────────────────────────────────────────┤
│  ⓘ Urban and rural bodies both roll up to    │
│    the district, through different paths.  ▸ │
└──────────────────────────────────────────────┘
```

The note is genuinely necessary — `docs/19` states the hierarchy "is not a single clean tree", and a user who does not know that will read the two branches as a duplication or an error.

## Deepest level — where coverage dominates

```text
┌──────────────────────────────────────────────┐
│ ←  Katewadi Gram Panchayat              ⋮    │
│ ↑ … › Pune › Baramati › Baramati P.S.     ▸  │
├──────────────────────────────────────────────┤
│  ▤  Limited records for this Gram Panchayat  │
│                                              │
│     Local bodies publish least consistently. │
│     What we have for FY2024-25:              │
│                                              │
│     Money in    2 scheme grants           ✓  │
│     Money out   no records                ▤  │
│     Works       4 works listed            ✓  │
│                                              │
│     [ What's missing and why ]           ▸   │
└──────────────────────────────────────────────┘
```

Coverage is the **first** thing shown at local-body level, not a footnote — `docs/09` requires missing-data warnings to be especially prominent here.
