# Wireframes — Saved & offline (S-62 – S-65)

## S-62 · Saved

```text
┌──────────────────────────────────────────────┐
│  Saved                          Collections ▸ │
├──────────────────────────────────────────────┤
│  24 items · 4.2 MB on this device         ⚙  │
├──────────────────────────────────────────────┤
│  PROJECTS (14)                               │
│  ┌────────────────────────────────────────┐  │
│  │ Upgradation of ODR-14, Baramati      ▸ │  │
│  │ Rural road · Pune · FY2024-25          │  │
│  │ ₹8.00 cr utilized · ◔ needs verif.     │  │
│  │ ● Updated 2 days ago · saved offline   │  │
│  ├────────────────────────────────────────┤  │
│  │ Bridge over Karha, Baramati          ▸ │  │
│  │ Bridge · Pune · FY2024-25              │  │
│  │ ▤ No expenditure records published     │  │
│  │ ○ as of 14 Aug 2026 · saved offline    │  │
│  └────────────────────────────────────────┘  │
│                            See all 14 ▸      │
│                                              │
│  PLACES (6)                                  │
│  ┌────────────────────────────────────────┐  │
│  │ Katewadi Gram Panchayat              ▸ │  │
│  │ ₹60.50 lakh received                   │  │
│  │ ● Coverage improved 5 days ago         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  CONTRACTORS (2)   ·   SEARCHES (2)          │
│  ┌────────────────────────────────────────┐  │
│  │ 🔍 "cost per km" in Pune · rural road ▸ │  │
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│    🏠        🗺         🔍          ☆        │
└──────────────────────────────────────────────┘
```

`●` = changed since last viewed. Every saved item states its freshness (`as of …`) and that it is available offline.

**Empty state — the one place a teaching empty state is right:**

```text
│           ☆                                  │
│                                              │
│   Nothing saved yet                          │
│                                              │
│   Save a project to keep its figures, its    │
│   sources, and its updates — and to read     │
│   it with no connection.                     │
│                                              │
│   [ Explore near me ]     [ Search ]         │
```

## Saving — what actually happens

```text
▸ ☆ on S-27
   ├─ item written to SQLite (durable, never auto-evicted)
   ├─ offline bundle downloaded — 62 KB
   │    project · finance chain · both variances · ledger lines
   │    · observations · priority + factors · tender · contractor
   │    · road intelligence · progress · PROVENANCE FOR EVERY FIGURE
   │    · coverage · asOf + datasetVersion
   ├─ first save only → S-07 notification primer
   └─ toast: "Saved · available offline (62 KB)"        [ Undo ]
```

The document PDFs are **not** auto-downloaded — a scanned budget document can be 80 MB. The bundle stores document metadata; downloading an artifact is a separate, size-labelled action.

## S-64 · Offline packs

```text
┌──────────────────────────────────────────────┐
│ ←  Offline                                   │
├──────────────────────────────────────────────┤
│  156 MB used on this device                  │
│  ☑ Download over Wi-Fi only                  │
├──────────────────────────────────────────────┤
│  AREA PACKS                                  │
│  ┌────────────────────────────────────────┐  │
│  │ Pune district                       ⋮  │  │
│  │ 34 MB · maps + 142 projects            │  │
│  │ as of 04 Aug 2026 · v137               │  │
│  │ ⓘ 2 days of updates available (1.2 MB) │  │
│  │                     [ Update ]         │  │
│  ├────────────────────────────────────────┤  │
│  │ Baramati taluka                     ⋮  │  │
│  │ 6 MB · maps + 41 projects              │  │
│  │ ▓▓▓▓▓▓▓░░░  68% · downloading…         │  │
│  │                     [ Pause ]          │  │
│  └────────────────────────────────────────┘  │
│  [ + Add an area ]                           │
├──────────────────────────────────────────────┤
│  SAVED ITEMS            4.2 MB · 24 items ▸  │
│  DOCUMENTS             118 MB · 3 files      │
│  ┌────────────────────────────────────────┐  │
│  │ MH PWD Works FY2024-25       78 MB  🗑 │  │
│  │ MH Budget 2024-25 vol.2      32 MB  🗑 │  │
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│  CACHE                          18 MB        │
│  Pages you've viewed recently.               │
│  [ Clear cache ]                             │
│  ⓘ Clearing the cache does not remove        │
│    saved items or downloaded areas.          │
└──────────────────────────────────────────────┘
```

Size is stated **before** any download. Updates are deltas (1.2 MB), never a re-download. The cache note exists because "clear cache" is otherwise terrifying when you have 24 saved items you rely on.

**Adding an area:**

```text
├──────────────────────────────────────────────┤
│            ────                              │
│  Download an area                            │
├──────────────────────────────────────────────┤
│  Pune district                               │
│  Maps (zoom 6–13)              28 MB         │
│  14 talukas, 13 local bodies    2 MB         │
│  142 projects + finance         4 MB         │
│  ─────────────────────────────────────       │
│  Total                         34 MB         │
│                                              │
│  ⓘ Source documents are not included.        │
│    Download them individually as needed.     │
│                                              │
│  [ Download over Wi-Fi ]  [ Download now ]   │
└──────────────────────────────────────────────┘
```

## S-63 · Collections · S-65 · Watch settings

```text
S-63                                S-65 (sheet)
┌────────────────────────────┐   ├────────────────────────────┤
│ ←  Baramati road story     │   │            ────            │
├────────────────────────────┤   │  Tell me when…             │
│ 6 items · created 12 Aug   │   │  Upgradation of ODR-14     │
├────────────────────────────┤   ├────────────────────────────┤
│ Upgradation of ODR-14    ▸ │   │  ☑ A financial figure      │
│ Bridge over Karha        ▸ │   │    changes                 │
│ ABC Infra Pvt Ltd        ▸ │   │  ☑ A new record is         │
│ Baramati taluka          ▸ │   │    published               │
│ Tender MHT-2024-…        ▸ │   │  ☐ The status changes      │
│ 🔍 "cost per km" Pune    ▸ │   │  ☐ A value is revised      │
├────────────────────────────┤   │  ☐ A new observation       │
│ [ Share evidence pack ]    │   │    appears (count only)    │
│ [ Export CSV ]             │   │  ☐ A source is superseded  │
├────────────────────────────┤   ├────────────────────────────┤
│ Collections are stored on  │   │  We check about every 6    │
│ this device only.          │   │  hours in the background.  │
└────────────────────────────┘   │  Your list of watched      │
                                 │  items never leaves this   │
                                 │  device.             (?)   │
                                 └────────────────────────────┘
```

The last sentence in S-65 is the user-facing statement of the privacy architecture in `.docs/10-mobile/notifications.md` — it is a commitment worth making visible.

**Export CSV** always carries the source columns (`source_name`, `source_url`, `extraction_method`, `extraction_confidence`, `retrieved_at`, `dataset_version`). A figure is never exported without its provenance.
