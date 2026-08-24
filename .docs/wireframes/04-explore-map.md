# Wireframes — Explore: map & list (S-18 – S-21)

## S-18 · Map mode

```text
┌──────────────────────────────────────────────┐
│  Pune district ▾   FY2024-25 ▾   [Map|List]  │
├──────────────────────────────────────────────┤
│ 🔍 Search this area                     ⚙    │
│                                              │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│   ░░░░░░░  ▨▨▨▨▨▨▨▨  ░░░░░░░░░░░░░░░░░░░░   │
│   ░░░░░  ▨▨▨▨(24)▨▨▨▨▨  ░░░░░░░░░░░░░░░░░░   │  ▨ = choropleth unit
│   ░░░░░░  ▨▨▨▨▨▨▨▨▨  ░  ●  ░░░░░░░░░░░░░░░   │  ● = project
│   ░░░░░░░░░░░░░  (7)  ░░░░░  ●  ░░░░░░░░░░   │  (n) = cluster
│   ░░░░░░░  ●  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 📍 ░░░░░░   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Showing 400 of 3,182 projects.         │  │  ← truncation is ANNOUNCED
│  │ Zoom in or filter to see the rest.  ▸  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌── LEGEND ──────────────────────────────┐  │
│  │ Utilization % · FY2024-25 · v137       │  │
│  │ ░░ 0%  ▒▒ 50%  ▓▓ 75%  ██ 100%         │  │
│  │ Colour shows a measurement,            │  │  ← mandatory (.docs/17-legal/legal-ethical-rules.md, .docs/03-domain/gis-intelligence.md)
│  │ not an assessment.                     │  │
│  └────────────────────────────────────────┘  │
│                            📍  ⊕  ⊖  ⧉      │
├──────────────────────────────────────────────┤
│    🏠        🗺         🔍          ☆        │
└──────────────────────────────────────────────┘
```

- Individual projects appear only at **z ≥ 11**; below that, choropleths and clusters (`.docs/10-mobile/gis-mobile-architecture.md` §3).
- Hard cap 400 features, and exceeding it is stated, never silent.
- `⊕ ⊖` exist because pinch must not be the only way to zoom (WCAG 2.2).

## S-18 · List mode — co-equal, not a fallback

```text
┌──────────────────────────────────────────────┐
│  Pune district ▾   FY2024-25 ▾   [Map|List]  │
├──────────────────────────────────────────────┤
│  3,182 projects in this area   Sort: Near ▾  │
├──────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │ Upgradation of ODR-14, Baramati      ▸ │  │
│  │ Rural road · in progress · 1.2 km away │  │
│  │ ₹8.00 cr utilized  🔗   ◔ needs verif. │  │
│  ├────────────────────────────────────────┤  │
│  │ Katewadi–Supe road repair            ▸ │  │
│  │ Rural road · completed · 2.8 km away   │  │
│  │ ₹1.40 cr utilized  🔗   ○ low          │  │
│  ├────────────────────────────────────────┤  │
│  │ Bridge over Karha, Baramati          ▸ │  │
│  │ Bridge · in progress · 3.1 km away     │  │
│  │ ▤ No expenditure records published     │  │
│  └────────────────────────────────────────┘  │
│  ⋯                                           │
├──────────────────────────────────────────────┤
│  18 projects in this area have no published  │  ← spatial missing-data warning
│  location and are not on the map.        ▸   │
└──────────────────────────────────────────────┘
```

The bottom note matters: a map that quietly omits unmapped projects understates spending exactly where publication is weakest.

**List is also the accessibility equivalent of the map** (`.docs/01-product/accessibility.md`); `Settings → Prefer list over map` makes it the default landing state permanently.

## S-19 · Feature preview (peek sheet)   ·   S-20 · Cluster contents

```text
S-19  (30% detent, map visible behind)   S-20
├────────────────────────────┤          ├────────────────────────────┤
│            ────            │          │            ────            │
│ Upgradation of ODR-14      │          │  24 projects here          │
│ Rural road · in progress   │          │  ₹142.6 cr utilized     🔗 │
│ Baramati taluka            │          ├────────────────────────────┤
│                            │          │ Upgradation of ODR-14    ▸ │
│ Allocated  ₹10.00 cr    🔗 │          │ ₹8.00 cr · ◔ needs verif.  │
│ Utilized   ₹ 8.00 cr    🔗 │          ├────────────────────────────┤
│ ◔ Needs verification       │          │ Katewadi–Supe repair     ▸ │
│                            │          │ ₹1.40 cr · ○ low           │
│ [ Open project ]           │          ├────────────────────────────┤
└────────────────────────────┘          │ ⋯  (cursor-paged)          │
                                        └────────────────────────────┘
```
S-19 renders entirely from the tile/feature payload — **tapping a pin costs no request**.

Approximate locations render as a hollow marker and the preview says *"approximate location"*.

## S-21 · Map filters (includes the legend)

```text
├──────────────────────────────────────────────┤
│                    ────                      │
│  Map                                  Reset  │
├──────────────────────────────────────────────┤
│  SHOW                                        │
│  ☑ Administrative boundaries                 │
│  ☑ Roads          ☑ Projects                 │
│  ☐ Facilities     ☐ Utility networks         │
├──────────────────────────────────────────────┤
│  COLOUR UNITS BY                             │
│  ● Utilization %                             │
│  ○ Per-capita expenditure                    │
│  ○ Project count                             │
│  ○ Median cost per km                        │
│  ⓘ Colour shows a measurement, not an        │
│    assessment. Neither high nor low values   │
│    indicate wrongdoing.                      │
├──────────────────────────────────────────────┤
│  CATEGORY  Any ▾    STATUS  Any ▾            │
│  YEAR      FY2024-25 ▾                       │
├──────────────────────────────────────────────┤
│  [ Apply — 3,182 projects ]                  │
└──────────────────────────────────────────────┘
```

## Offline map

```text
│   ░░░░░░░  cached  ░░░░╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱   │
│   ░░░░░░░░░░░░░░░░░░░░╱ Map data not     ╱   │  ← labelled hatch,
│   ░░░░░░░░░░░░░░░░░░░░╱ downloaded for   ╱   │     never a blank void
│   ░░░░░░░░░░░░░░░░░░░░╱ this area        ╱   │
│                       ╱ [ Download ▸ ]   ╱   │
```
