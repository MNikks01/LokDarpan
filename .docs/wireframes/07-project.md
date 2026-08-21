# Wireframes — Project (S-27, S-31, S-32, S-39)

## S-27 · Project detail

```text
┌──────────────────────────────────────────────┐
│ ←  Upgradation of ODR-14, Baramati       ⋮   │
│ ↑ India › Maharashtra › Pune › Baramati   ▸  │
├──────────────────────────────────────────────┤
│  Rural road · in progress                    │
│  Public Works Department · PMGSY             │
│  Work ID  PWD-PUN-2024-1408                  │
│  FY2024-25 ▾                        ☆   ⇧    │
├──────────────────────────────────────────────┤
│                                              │
│  MONEY TRAIL                                 │
│  ┌────────────────────────────────────────┐  │
│  │  ALLOCATED            1 record      🔗 │  │
│  │  ₹10.00 crore              BE          │  │
│  │      │                                 │  │
│  │      ├ Allocation variance (A−U)       │  │
│  │      │ ₹2.00 crore                     │  │
│  │      │ 20.0% of the allocated amt (?)  │  │
│  │      │                                 │  │
│  │  RELEASED         1 instalment      🔗 │  │
│  │  ₹9.00 crore                           │  │
│  │      │                                 │  │
│  │      ├ Release variance (R−U)          │  │
│  │      │ ₹1.00 crore                     │  │
│  │      │ 11.1% of the released amt  (?)  │  │
│  │      │                                 │  │
│  │  UTILIZED             1 record      🔗 │  │
│  │  ₹8.00 crore                           │  │
│  │                                        │  │
│  │  ◔ Needs verification             (?)  │  │
│  │                     Full trail ▸       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  VERIFICATION PRIORITY                       │
│  ┌────────────────────────────────────────┐  │
│  │  ◔  40 / 100                           │  │
│  │  Medium — worth a closer look          │  │
│  │  Confidence 94% · based on digital     │  │
│  │  source figures                        │  │
│  │                                        │  │
│  │  ⓘ A data-consistency indicator, not   │  │
│  │    an assessment of any person or      │  │
│  │    organization.                       │  │
│  │           See all six factors ▸        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ROAD                                        │
│  ┌────────────────────────────────────────┐  │
│  │ ODR · 10.0 km · 7.0 m · bituminous  🔗 │  │
│  │                                        │  │
│  │ Cost per km      ₹3.20 cr           🔗 │  │
│  │ Modeled estimate ₹2.60 cr    +23.1%    │  │
│  │ District median  ₹2.75 cr    +16.4%    │  │
│  │                  (n=19)                │  │
│  │                                        │  │
│  │ ⓘ Modeled estimates are engineering    │  │
│  │   approximations. Deviations can be    │  │
│  │   entirely legitimate.                 │  │
│  │                  Model details ▸       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  TIMELINE                                    │
│  ┌────────────────────────────────────────┐  │
│  │ Sanctioned  12 Aug 2024             🔗 │  │
│  │ Tendered    02 Sep 2024             🔗 │  │
│  │ Awarded     18 Oct 2024             🔗 │  │
│  │ Released    02 Nov 2024             🔗 │  │
│  │ ⋯                     Full timeline ▸  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  CONTRACTOR & TENDER                         │
│  ┌────────────────────────────────────────┐  │
│  │ ABC Infra Pvt Ltd                    ▸ │  │
│  │ Class I-A                              │  │
│  │ Awarded ₹9.40 cr · est. ₹9.80 cr    🔗 │  │
│  │ 4 bidders · 18 Oct 2024                │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  OBSERVATIONS (3)                            │
│  ⓘ Data-consistency observations from        │
│    official records, not findings of         │
│    wrongdoing.                               │
│  ┌────────────────────────────────────────┐  │
│  │ ◑ Reported cost per km is 23% above   │  │
│  │   the modeled estimate and 16% above  │  │
│  │   the district median (n=19)         ▸ │  │
│  ├────────────────────────────────────────┤  │
│  │ ◔ Utilized is 11.1% below released   ▸ │  │
│  ├────────────────────────────────────────┤  │
│  │ ○ No progress record since Mar 2026  ▸ │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  LOCATION                                    │
│  ┌────────────────────────────────────────┐  │
│  │ ░░░░ ▬▬▬▬▬▬▬▬ ░░░░░░░░░░░░░░░░░░░░░░  │  │
│  │           View on map ▸                │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  SOURCES (6)                             ▸   │
│  COVERAGE                                    │
│  ▤ No progress record published since        │
│    Mar 2026. Expected: MH PWD — Works.   ▸   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 💬 Explain this project              ▸ │  │
│  └────────────────────────────────────────┘  │
│  Data as of 04 Aug 2026 · version 137        │
│  [ Report a data issue ]                     │
└──────────────────────────────────────────────┘
```

### Hierarchy decisions

1. **Money Trail first.** It is what the user came for, and it is above the fold.
2. **Verification Priority second, but immediately caveated**, with its confidence and a one-tap path to all six factors. Never a gauge, never red.
3. **Road intelligence carries its caveat inline**, not behind a tooltip — `docs/08` requires the caveat to always be displayed.
4. **Observations are near the bottom, under a non-collapsible disclaimer.** Their position is deliberate: the figures and their sources come first; observations are secondary.
5. **Coverage before the footer**, so an incomplete record can never read as a complete one.

## S-31 · Timeline

```text
┌──────────────────────────────────────────────┐
│ ←  Timeline · ODR-14 Baramati                │
├──────────────────────────────────────────────┤
│  ●  12 Aug 2024   Sanctioned              🔗 │
│  │                ₹10.00 cr · BE             │
│  │                                           │
│  ●  02 Sep 2024   Tender published        🔗 │
│  │                est. ₹9.80 cr              │
│  │                                           │
│  ●  18 Oct 2024   Awarded                 🔗 │
│  │                ₹9.40 cr · ABC Infra       │
│  │                4 bidders                  │
│  │                                           │
│  ●  02 Nov 2024   Release, instalment 1   🔗 │
│  │                ₹9.00 cr                   │
│  │                                           │
│  ●  20 Feb 2025   Expenditure recorded    🔗 │
│  │                ₹8.00 cr                   │
│  │                                           │
│  ●  31 Mar 2026   Progress 68% physical   🔗 │
│  ┊                                           │
│  ┊  ▤ No records published after this date.  │
│  ┊    Expected: MH PWD — Works                │
│  ┊    Last checked 18 Aug 2026                │
│  ○  Expected completion  30 Jun 2026      🔗 │
└──────────────────────────────────────────────┘
```
The dotted segment is a **gap made visible**. It is never interpolated, and no "delay" is asserted — only that no record exists after that date.

## S-32 · Progress history   ·   S-39 · Location

```text
S-32                                S-39
┌────────────────────────────┐   ┌────────────────────────────┐
│ ←  Progress                │   │ ←  ODR-14 Baramati         │
├────────────────────────────┤   ├────────────────────────────┤
│ 100 ┤                      │   │  ░░░░░░░░░░░░░░░░░░░░░░░░  │
│  75 ┤          ●───●       │   │  ░░░ ▬▬▬▬▬▬▬▬▬▬ ░░░░░░░░░  │
│  50 ┤    ●─────╯     ┊     │   │  ░░░░░░░░░░░░░░░░░░░░░░░░  │
│  25 ┤  ●╯            ┊     │   │  ░░░░░░░░░░░░░░░░░░░░░░░░  │
│   0 ┼──┴───┴───┴───┴─┊──   │   ├────────────────────────────┤
│    Aug Nov Feb Mar  (gap)  │   │  10.0 km · ODR          🔗 │
│                            │   │  Baramati taluka           │
│ ● physical   ○ financial   │   │  Exact location            │
│ [ View as list ]           │   │  [ Open in Explore ▸ ]     │
├────────────────────────────┤   └────────────────────────────┘
│ 31 Mar 2026  68% / 80%  🔗 │
│ 28 Feb 2026  61% / 80%  🔗 │
│ 30 Nov 2025  42% / 55%  🔗 │
│ ▤ Nothing published since  │
│   31 Mar 2026              │
└────────────────────────────┘
```
Every chart carries `[ View as list ]` — a hard accessibility requirement (`.docs/12-accessibility.md`).
