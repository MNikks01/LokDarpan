# Wireframes — Cross-cutting states

Specification in `.docs/01-product/state-design.md`. These are the visual forms of the three inviolable rules:

> **R1** Missing is never zero · **R2** "Offline" ≠ "not published" · **R3** Every state names its responsible source.

## Loading — skeleton-first, shape-matched

```text
SCREEN PUSH                          MONEY TRAIL SKELETON
┌────────────────────────────┐   ┌────────────────────────────┐
│ ←  Upgradation of ODR-14   │   │ ┌────────────────────────┐ │
│ ↑ India › Maharashtra › …  │   │ │ ▒▒▒▒▒▒▒▒▒       ▒▒▒▒▒▒ │ │
├────────────────────────────┤   │ │ ▒▒▒▒▒▒▒▒▒▒▒▒▒          │ │
│ Rural road · in progress   │   │ └───────────┬────────────┘ │
├────────────────────────────┤   │             │ ▒▒▒▒▒▒▒▒▒▒▒ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │   │ ┌───────────┴────────────┐ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒        │   │ │ ▒▒▒▒▒▒▒▒        ▒▒▒▒▒▒ │ │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │   │ └───────────┬────────────┘ │
│                            │   │             │ ▒▒▒▒▒▒▒▒▒▒▒ │
└────────────────────────────┘   │ ┌───────────┴────────────┐ │
  ↑ header is REAL, from the     │ │ ▒▒▒▒▒▒▒▒        ▒▒▒▒▒▒ │ │
    route params the caller      │ └────────────────────────┘ │
    already had — frame 1        └────────────────────────────┘
                                   ↑ 3 stages + 2 connectors —
                                     matches the real shape, so
                                     nothing shifts when data lands
```

`> 2 s` adds "Still loading…". `> 8 s` becomes an error with retry. Refresh with data present shows a top progress line and **keeps the content interactive**.

## Empty — five distinct kinds

```text
E1 · NO RECORDS PUBLISHED (the most sensitive)
┌──────────────────────────────────────────────┐
│         ▤                                    │
│   No expenditure records published           │
│                                              │
│   No expenditure has been published for      │
│   this project for FY2024-25 in the          │
│   sources we've ingested.                    │
│                                              │
│   This does not mean no money was spent —    │
│   it means the record has not been           │
│   published or collected yet.                │   ← MANDATORY sentence
│                                              │      (.docs/17-legal/legal-ethical-rules.md rule 8)
│   Expected source   MH PWD — Works           │   ← R3
│   Last checked      18 Aug 2026              │
│                                              │
│   [ Try another year ] [ Report an issue ]   │
│   [ What we cover ]                          │
└──────────────────────────────────────────────┘

E2 · OUT OF COVERAGE          E3 · FILTERED TO NOTHING
┌────────────────────────┐   ┌────────────────────────┐
│      ◷                 │   │      ⌕                 │
│  Not yet covered       │   │  No results with       │
│                        │   │  these filters         │
│  LokDarpan covers      │   │                        │
│  Maharashtra roads     │   │  142 projects in Pune  │
│  (Phase 1). Health     │   │  district; none match  │
│  projects in Nashik    │   │  "completed" + "cost   │
│  aren't ingested yet.  │   │  above median".        │
│                        │   │                        │
│  [ What we cover ]     │   │ [Clear] [Remove 'compl'│
│  [ Nearest covered ]   │   └────────────────────────┘
└────────────────────────┘

E4 · NOTHING SAVED (teaches)   E5 · A GENUINE ZERO
┌────────────────────────┐   ┌────────────────────────┐
│      ☆                 │   │ Bridges in this        │
│  Nothing saved yet     │   │ project           0    │
│  Save a project to     │   │                        │
│  keep its figures,     │   │ ← a true zero renders  │
│  sources and updates — │   │   inline as 0. R1      │
│  and read it offline.  │   │   governs MISSING,     │
│  [Explore] [Search]    │   │   not zero.            │
└────────────────────────┘   └────────────────────────┘
```

## Error — section-scoped, never screen-scoped

```text
SECTION ERROR (the rest of the screen keeps working)
│  MONEY TRAIL                                 │
│  ┌────────────────────────────────────────┐  │
│  │  ALLOCATED  ₹10.00 crore            🔗 │  │  ← this still works
│  │  RELEASED   ₹ 9.00 crore            🔗 │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ROAD                                        │
│  ┌────────────────────────────────────────┐  │
│  │ Couldn't load road details.            │  │
│  │ It's not your connection.              │  │
│  │              [ Retry ]                 │  │
│  └────────────────────────────────────────┘  │

RATE LIMITED (429)              NOT FOUND (404)
┌────────────────────────┐   ┌────────────────────────┐
│ Too many requests just │   │ This record is no      │
│ now.                   │   │ longer in the          │
│ Retrying in 14s…       │   │ published dataset.     │
│ ▓▓▓▓▓░░░░░             │   │ It may have been       │
│                        │   │ superseded or removed  │
│ (auto-retry; never an  │   │ by the source.         │
│  alarming red error)   │   │ [ Search ] [ Report ]  │
└────────────────────────┘   └────────────────────────┘

SERVER ERROR
│ LokDarpan is having trouble loading this.    │
│ It's not your connection.                    │
│ [ Retry ]   [ Copy diagnostics ]             │  ← requestId, for support
```

## Offline — R2 made visible

```text
O1 · OFFLINE WITH CACHE
┌──────────────────────────────────────────────┐
│ ⚡ Offline — showing data from 14 Aug 2026   │  ← persistent, non-blocking,
├──────────────────────────────────────────────┤     reappears on navigation
│  (full content renders; every figure keeps   │
│   its own "as of" caption)                   │
│                                              │
│  [ 💬 Ask ]  ← disabled, with a reason shown │
└──────────────────────────────────────────────┘

O2 · OFFLINE WITHOUT CACHE
┌──────────────────────────────────────────────┐
│         ⚡                                    │
│   You're offline                             │
│                                              │
│   This project hasn't been downloaded to     │
│   your device.                               │
│                                              │
│   This is different from "no records         │
│   published" — we simply can't reach         │   ← the sentence that
│   LokDarpan right now.                       │      enforces R2
│                                              │
│   [ Retry ]                                  │
│   [ Save for offline when you reconnect ]    │
└──────────────────────────────────────────────┘
```

Compare O2 with E1 above: same visual weight, entirely different message, entirely different iconography (`⚡` vs `▤`). A user must never confuse a dropped connection with a government's failure to publish.

## Partial data

```text
┌──────────────────────────────────────────────┐
│ ⓘ Some information couldn't be loaded.       │
│   Financial records and sources are shown.   │
│   Tender details are unavailable.  [Retry]   │
├──────────────────────────────────────────────┤
```

## Stale data

```text
┌──────────────────────────────────────────────┐
│ Updated data available          [ Refresh ]  │  ← dismissible chip;
├──────────────────────────────────────────────┤     NEVER auto-refreshes
│  (content unchanged until the user asks —    │     under the reader
│   a journalist mid-read must not have        │
│   figures change beneath them)               │
```

## Confidence and version states

```text
LOW EXTRACTION CONFIDENCE       LOW LINKAGE CONFIDENCE (more serious)
│ Utilized                  │   │ Utilized                  │
│ ₹8.00 crore      ⚠ 82%    │   │ ₹8.00 crore      ⚠ matched│
│ 🔗 MH PWD — Works         │   │ 🔗 MH PWD — Works         │
│ ⚠ Extracted from a        │   │ ⚠ Matched to this project │
│   scanned document. The   │   │   by name similarity      │
│   value may contain an    │   │   (0.78). It may belong   │
│   OCR error.              │   │   to a different work.    │
                                │   [ How matching works ]  │

SUPERSEDED VALUE
│ Allocated                                    │
│ ₹11.50 crore              (revised)          │
│ Previous value ₹10.00 crore, published       │
│ 12 Aug 2024.                    History ▸    │
```

## Permission denied

```text
LOCATION                        NOTIFICATIONS
┌────────────────────────┐   ┌────────────────────────┐
│ 📍 Location is off     │   │ You'll see updates in  │
│                        │   │ the app.               │
│ Choose your area to    │   │ Enable notifications   │
│ see nearby spending.   │   │ to be told sooner.     │
│ [ Choose my area ]     │   │ [ Open settings ]      │
│ [ Open settings ]      │   └────────────────────────┘
└────────────────────────┘
   ↑ never framed as an error — S-05 is a permanent equal path
```

## Text scale — 100% → 200%

```text
100%                            200% (stacked, never truncated)
┌────────────────────────┐   ┌────────────────────────┐
│ Utilized   ₹8.00 crore │   │ Utilized               │
│ 🔗 MH PWD · OCR 82%    │   │ ₹8.00 crore            │
└────────────────────────┘   │ 🔗 MH PWD — Works      │
                             │    OCR · 82%           │
                             └────────────────────────┘
```
Above ~130% scale, `label + value` rows switch from horizontal to stacked. **A monetary value is never truncated** — a truncated figure is a wrong figure (`.docs/01-product/accessibility.md`).
