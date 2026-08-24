# Wireframes — Launch & onboarding (S-01 – S-07)

## S-01 · Bootstrap

```text
┌──────────────────────────────────────────────┐
│                                              │
│                                              │
│                  लोकदर्पण                     │
│                 LokDarpan                    │
│                                              │
│                                              │
│                                              │
└──────────────────────────────────────────────┘
```

No spinner before 400 ms. **Never blocks on the network** — a dead connection still reaches cached Home.

## S-02 · Onboarding — 3 panels

```text
PANEL 1                          PANEL 2 (never skippable)
┌────────────────────────────┐   ┌────────────────────────────┐
│                            │   │                            │
│   Follow public money      │   │   What this is not         │
│                            │   │                            │
│   From the Union Budget    │   │   LokDarpan does not        │
│   to a road in your        │   │   investigate, accuse, or   │
│   village — using only     │   │   make legal findings.      │
│   official government      │   │                            │
│   records.                 │   │   A difference or gap       │
│                            │   │   shown here means the      │
│                            │   │   DATA warrants a closer    │
│                            │   │   look — it is not a claim  │
│                            │   │   of wrongdoing by any      │
│                            │   │   person or organization.   │
│                            │   │                            │
│   ● ○ ○                    │   │   ○ ● ○                     │
│   [ Next ]          Skip   │   │   [ Next ]                  │
└────────────────────────────┘   └────────────────────────────┘

PANEL 3 — a live demo, not a description
┌────────────────────────────┐
│   Every number has a       │
│   source                   │
│                            │
│   ┌──────────────────────┐ │
│   │ Utilized             │ │
│   │ ₹8.00 crore          │ │  ← the user actually taps this
│   │ 🔗 MH PWD — Works    │ │
│   └──────────────────────┘ │
│         ↓ tap              │
│   ┌──────────────────────┐ │
│   │ MH PWD — Works       │ │
│   │ p.42 table 3 · OCR   │ │
│   │ [ View document ]    │ │
│   └──────────────────────┘ │
│   ○ ○ ●                    │
│   [ Get started ]          │
└────────────────────────────┘
```

**"Skip" skips panels 1 and 3. Panel 2 is always shown** — the neutrality frame is not optional (`.docs/17-legal/legal-ethical-rules.md`).

## S-03 · Language

```text
┌──────────────────────────────────────────────┐
│  Choose your language                        │
│  भाषा निवडा · भाषा चुनें                       │
├──────────────────────────────────────────────┤
│  ● English                                   │  ← preselected from device locale
│  ○ मराठी                                     │
│  ○ हिन्दी                                     │
├──────────────────────────────────────────────┤
│  Numbers are shown in Indian format          │
│  (₹8,00,00,000 · ₹8 crore) in all languages. │
│                                              │
│  [ Continue ]                                │
└──────────────────────────────────────────────┘
```

## S-04 · Location primer · S-05 · Choose your area

```text
S-04                              S-05
┌────────────────────────────┐   ┌────────────────────────────┐
│                            │   │ ←  Choose your area        │
│   Find spending near you   │   ├────────────────────────────┤
│                            │   │ 🔍 Search a place          │
│   LokDarpan can show       │   ├────────────────────────────┤
│   projects and public      │   │ STATE                      │
│   money around you.        │   │ Maharashtra              ▸ │
│                            │   │ ⋯ (others: not yet covered)│
│   Your location is used    │   ├────────────────────────────┤
│   for that search only.    │   │ DISTRICT                   │
│   It is never stored and   │   │ Pune                     ▸ │
│   never linked to you.     │   │ Ahmednagar               ▸ │
│                            │   │ Satara                   ▸ │
│   [ Allow location ]       │   │ ⋯                          │
│   [ Choose my area ]       │   ├────────────────────────────┤
│   Not now                  │   │ 📍 Use my location instead │
└────────────────────────────┘   └────────────────────────────┘
```

The state/district list is **bundled in the app**, so this works with no connection on first run.
Denial is not a dead end — S-05 is a permanent equal path, never a consolation screen.

## S-06 · Forced upgrade · S-07 · Notification primer

```text
S-06 (blocking; dismissible OFFLINE)   S-07 (sheet, on first save only)
┌────────────────────────────┐   ├────────────────────────────┤
│                            │   │            ────            │
│   Update required          │   │  Know when this changes?   │
│                            │   │                            │
│   This version can't read  │   │  We check in the background│
│   the current data format. │   │  and tell you what changed │
│                            │   │  — the amount, the record, │
│   [ Update ]               │   │  and its source.           │
│                            │   │                            │
│   (offline: [ Continue     │   │  [ Enable updates ]        │
│    with saved data ] )     │   │  Not now                   │
└────────────────────────────┘   └────────────────────────────┘
```
