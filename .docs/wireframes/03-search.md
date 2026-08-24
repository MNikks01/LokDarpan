# Wireframes — Search (S-13 – S-17)

## S-13 · Search idle

```text
┌──────────────────────────────────────────────┐
│ 🔍 Search projects, places, contractors   🎤 │  ← focused on mount
├──────────────────────────────────────────────┤
│  RECENT                              Clear   │
│  🕐 ODR-14 baramati                       ✕  │
│  🕐 ABC Infra                             ✕  │
│  🕐 PMGSY pune                            ✕  │
├──────────────────────────────────────────────┤
│  SAVED                                       │
│  ☆ Upgradation of ODR-14, Baramati        ▸  │
│  ☆ Katewadi Gram Panchayat                ▸  │
├──────────────────────────────────────────────┤
│  TRY SEARCHING FOR                           │
│  a village        "Katewadi"                 │
│  a road number    "ODR-14" · "SH-60"         │
│  a work ID        "PWD-PUN-2024-1408"        │
│  a contractor     "ABC Infra"                │
│  a scheme         "PMGSY"                    │
├──────────────────────────────────────────────┤
│    🏠        🗺         🔍          ☆        │
└──────────────────────────────────────────────┘
```

The examples are not filler — they teach that IDs, road numbers, and aliases are all searchable, which most users would not guess.

## S-14 · Results — grouped, never flat

```text
┌──────────────────────────────────────────────┐
│ 🔍 baramati                             ✕  ⚙ │
├──────────────────────────────────────────────┤
│  IN PUNE DISTRICT                            │
│                                              │
│  PLACES                                      │
│  ┌────────────────────────────────────────┐  │
│  │ Baramati                             ▸ │  │
│  │ Taluka · Pune district                 │  │
│  ├────────────────────────────────────────┤  │
│  │ Baramati Nagar Parishad              ▸ │  │
│  │ Municipal council · Baramati taluka     │  │
│  └────────────────────────────────────────┘  │
│                              See all 4 ▸     │
│                                              │
│  PROJECTS                                    │
│  ┌────────────────────────────────────────┐  │
│  │ Upgradation of ODR-14, Baramati      ▸ │  │
│  │ Rural road · Pune · FY2024-25          │  │
│  │ ₹8.00 cr utilized · ◔ needs verif.     │  │
│  ├────────────────────────────────────────┤  │
│  │ Baramati–Indapur SH widening         ▸ │  │
│  │ State highway · Pune · FY2023-24       │  │
│  └────────────────────────────────────────┘  │
│                             See all 23 ▸     │
│                                              │
│  CONTRACTORS                                 │
│  ┌────────────────────────────────────────┐  │
│  │ Baramati Constructions Pvt Ltd       ▸ │  │
│  │ 7 tenders · Baramati taluka            │  │
│  │ matched alias "Baramati Const."        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  TENDERS · SCHEMES · DEPARTMENTS ⋯           │
├──────────────────────────────────────────────┤
│  ELSEWHERE IN MAHARASHTRA                    │
│  ⋯                                           │
└──────────────────────────────────────────────┘
```

Every row carries its **disambiguator** — the district for a village, category + FY for a project, the matched alias for a contractor. Without it, eight rows named "Rampur" are a failed search.

Scope raises ranking; it never hides results (`ELSEWHERE` divider).

## S-15 · The three zero-result states

```text
(a) OUT OF COVERAGE            (b) TYPO                  (c) NOT INGESTED
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│  ◷ Not yet covered     │  │  ⌕ No results for      │  │  ⌕ No record found     │
│                        │  │    "baramti"           │  │                        │
│  LokDarpan currently   │  │                        │  │  No official record    │
│  covers Maharashtra    │  │  Did you mean          │  │  matching "ODR-99" has │
│  roads (Phase 1).      │  │  ▸ Baramati            │  │  been ingested.        │
│  "Nashik railway" is   │  │                        │  │                        │
│  outside that.         │  │                        │  │  It may not have been  │
│                        │  │                        │  │  published, or not yet │
│  [ What we cover ]     │  │                        │  │  collected.            │
│                        │  │                        │  │  [ Source registry ]   │
│                        │  │                        │  │  [ Report an issue ]   │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

Case (c) never says _"this project does not exist."_ The platform knows what it ingested, not what exists.

## S-16 · Filters · Offline search

```text
S-16                                OFFLINE
├────────────────────────────┤     ┌────────────────────────────┐
│            ────            │     │ 🔍 baramati            ✕   │
│  Filters              Reset │     ├────────────────────────────┤
├────────────────────────────┤     │ ⚡ Offline — searching your │
│  TYPE                       │     │   saved items only (24)    │
│  ☑ Places  ☑ Projects       │     ├────────────────────────────┤
│  ☐ Contractors ☐ Tenders    │     │ SAVED                      │
├────────────────────────────┤     │ Upgradation of ODR-14…   ▸ │
│  PLACE   Pune district ▾    │     └────────────────────────────┘
│  YEAR    FY2024-25 ▾        │
│  CATEGORY  Rural road ▾     │
│  STATUS  Any ▾              │
│  ☐ With observations only   │
├────────────────────────────┤
│  [ Show 23 results ]        │  ← live count
└────────────────────────────┘
```

Filters live in route params, so a filtered result set is a shareable deep link.
