# Wireframes — Home (S-10, S-08, S-09, S-11)

## S-10 · Home

Deliberately **not** a KPI dashboard. An intent launcher: where am I, what's near me, what was I doing, what's worth a look.

```text
┌──────────────────────────────────────────────┐
│  Pune district ▾        FY2024-25 ▾    🔔  ⚙ │
├──────────────────────────────────────────────┤
│                                              │
│  NEAR YOU                                    │
│  ┌────────────────────────────────────────┐  │
│  │  ░░░░░░ map peek, 5 km ░░░░░░░░░░░░░░  │  │
│  │  ░░░░░  ●    ●   ●░░░░░░░░░░░░░░░░░░░  │  │
│  └────────────────────────────────────────┘  │
│  34 projects · ₹412.0 cr utilized      🔗    │
│  within 5 km                              ▸  │
│                                              │
│  PUNE DISTRICT · FY2024-25                   │
│  ┌────────────────────────────────────────┐  │
│  │ Money in                               │  │
│  │   Allocated      ₹1,240.00 crore    🔗 │  │
│  │ Money out                              │  │
│  │   Released       ₹1,102.00 crore    🔗 │  │
│  │   Utilized       ₹  968.40 crore    🔗 │  │
│  │                                        │  │
│  │ Release variance  ₹133.60 crore        │  │
│  │ 12.1% of the released amount      (?)  │  │
│  │ ◔ Needs verification                   │  │
│  │                                        │  │
│  │ 142 projects · 118 roads · 24 bridges  │  │
│  │                              Open ▸    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  CONTINUE                                    │
│  ┌────────────────────────────────────────┐  │
│  │ Upgradation of ODR-14, Baramati      ▸ │  │
│  │ Rural road · ₹8.00 cr utilized         │  │
│  ├────────────────────────────────────────┤  │
│  │ Katewadi Gram Panchayat              ▸ │  │
│  │ ▤ No expenditure records FY2024-25     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  WORTH VERIFYING IN PUNE DISTRICT            │
│  ⓘ Data-consistency observations from        │
│    official records, not findings of         │
│    wrongdoing.                               │
│  ┌────────────────────────────────────────┐  │
│  │ ◑ Reported cost per km is 23% above   │  │
│  │   the district median (n=19)         ▸ │  │
│  ├────────────────────────────────────────┤  │
│  │ ◔ Utilized is 11.1% below released   ▸ │  │
│  ├────────────────────────────────────────┤  │
│  │ ○ Records missing for 3 of 14 talukas▸ │  │
│  └────────────────────────────────────────┘  │
│                   See all 12 ▸               │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 💬 Ask about Pune district           ▸ │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Data as of 04 Aug 2026 · version 137        │
│  3 of 14 talukas have no published           │
│  expenditure for this year.            ▸     │
├──────────────────────────────────────────────┤
│    🏠        🗺         🔍          ☆        │
└──────────────────────────────────────────────┘
```

### Why it is built this way

- **"Worth verifying" is capped at 3, scoped to the user's own unit, and carries the disclaimer above the list** — it is never an infinite feed and never national. Removing that cap would turn neutral observations into an engagement stream (`.docs/00-overview/document-audit.md` PR-3).
- The district card is the **same four-panel pattern** as S-23, so Home teaches the layout the rest of the app uses.
- Every figure has 🔗. The variance shows its denominator in words, never a bare percentage.
- Coverage sits at the bottom of Home, not hidden in a settings screen.

### Offline

```text
├──────────────────────────────────────────────┤
│ ⚡ Offline — showing data from 14 Aug 2026   │
├──────────────────────────────────────────────┤
```
Content renders fully underneath; "Near you" falls back to the last known scope unit.

## S-08 · Fiscal year   ·   S-09 · Scope switcher

```text
S-08                                S-09
├────────────────────────────┤     ├────────────────────────────┤
│            ────            │     │            ────            │
│  Fiscal year               │     │  Your area                 │
├────────────────────────────┤     ├────────────────────────────┤
│  ● FY2024-25               │     │  📍 Use my location        │
│  ○ FY2023-24               │     ├────────────────────────────┤
│  ○ FY2022-23  partial data │     │  RECENT                    │
│  ○ FY2021-22  partial data │     │  Pune district           ▸ │
├────────────────────────────┤     │  Baramati taluka         ▸ │
│  "Partial" means some       │     ├────────────────────────────┤
│  records for that year are  │     │  SAVED                     │
│  not yet published or       │     │  Katewadi Gram Panchayat ▸ │
│  collected.                 │     ├────────────────────────────┤
└────────────────────────────┘     │  🔍 Browse all places    ▸ │
                                   └────────────────────────────┘
```

## S-11 · Updates inbox

```text
┌──────────────────────────────────────────────┐
│ ←  Updates                        Mark read  │
├──────────────────────────────────────────────┤
│  TODAY                                       │
│  ┌────────────────────────────────────────┐  │
│  │ Upgradation of ODR-14, Baramati      ▸ │  │
│  │ Utilized  ₹8.00 cr → ₹8.60 cr          │  │
│  │ New expenditure record · 12 Sep 2026   │  │
│  │ MH PWD — Works                      🔗 │  │
│  ├────────────────────────────────────────┤  │
│  │ Katewadi Gram Panchayat              ▸ │  │
│  │ Expenditure records now available      │  │
│  │ for FY2024-25                          │  │
│  └────────────────────────────────────────┘  │
│  EARLIER                                     │
│  ⋯                                           │
├──────────────────────────────────────────────┤
│  Updates come from items you saved.          │
│  Manage what you follow ▸                    │
└──────────────────────────────────────────────┘
```
Every row states **what changed, by how much, and from which record** — never "this was updated". Tapping opens the entity anchored to the changed section with the previous value alongside.

**Empty:** *"You'll see updates here when a saved project's figures change."* → ▸ Saved.
