# 03 — Navigation Architecture

## The problem mobile navigation must solve here

This product's data is **seven to nine levels deep** and cross-linked in every direction:

```text
India → Maharashtra → Pune division → Pune district → Baramati taluka
      → Gram Panchayat Katewadi → Ward 3 → Project → Money Trail → Ledger line
      → Source document → page 42
```

…and from that project a user can also step sideways into a tender, a contractor, a scheme, a department, a peer comparison, or a map. A desktop app solves this with a sidebar plus a breadcrumb bar. Neither exists on a phone.

Three failure modes must be prevented:

1. **Lost in the stack** — 9 screens deep with no sense of where "here" is.
2. **Stack explosion** — sideways navigation (project → contractor → tender → project) grows an unbounded back stack the user can never unwind.
3. **Chrome tax** — a breadcrumb bar costs ~44 pt of vertical space on every screen, permanently, to display what the back button already implies.

---

## Decision: 4 bottom tabs + stacks + sheets, with a persistent scope, not a breadcrumb

```text
┌──────────────────────────────────────────────┐
│  [Pune district ▾]        FY2024-25 ▾   🔔 ⚙ │  ← scope header (per-tab, sticky)
├──────────────────────────────────────────────┤
│                                              │
│                content                       │
│                                              │
├──────────────────────────────────────────────┤
│   🏠 Home    🗺 Explore    🔍 Search   ☆ Saved │  ← 4 tabs
└──────────────────────────────────────────────┘
```

### Why four tabs, and why these four

They map to the four ways a person actually arrives at public-spending data, not to the shape of the database:

| Tab         | Question it answers                             | Primary persona          |
| ----------- | ----------------------------------------------- | ------------------------ |
| **Home**    | "What's around me / in my area?"                | Citizen                  |
| **Explore** | "Show me the map / walk me down the hierarchy." | Citizen, researcher      |
| **Search**  | "I know what I'm looking for."                  | Journalist, RTI activist |
| **Saved**   | "What am I tracking?"                           | Journalist, activist     |

Alternatives rejected:

- **5 tabs with "More"** — a "More" tab is where features go to die; Settings belongs in the Home header (visited rarely, never mid-task).
- **3 tabs + header search** — Search is a first-class investigative surface here (`.docs/01-product/search-experience.md`); demoting it to an icon buries the journalist's primary path.
- **Ask/AI as a tab** — see `adr/002-navigation.md`; it would make this a chatbot product and invite exactly the out-of-scope questions the guardrails must then refuse. Ask is entered _from_ a scope.
- **Drawer navigation** — hides the entire IA behind a hamburger; poor reachability on 6.5" phones.

Full rationale and trade-offs: `adr/002-navigation.md`.

---

## Navigation tree

```text
RootStack (Expo Router)
├── (bootstrap)                                 S-01   modal, no chrome
├── (onboarding)                                        modal group, first run only
│   ├── intro                                   S-02
│   ├── language                                S-03
│   ├── location-primer                         S-04
│   └── choose-area                             S-05
├── (tabs)                                              ← the persistent shell
│   ├── home/
│   │   ├── index                               S-10
│   │   └── updates                             S-11
│   ├── explore/
│   │   ├── index            (map ⇄ list)       S-18
│   │   └── browse/[unitId]  (hierarchy level)  S-22, S-24
│   ├── search/
│   │   ├── index                               S-13
│   │   ├── results                             S-14, S-15
│   │   └── history                             S-17
│   └── saved/
│       ├── index                               S-62
│       ├── collection/[id]                     S-63
│       └── packs                               S-64
│
├── unit/[id]                                   S-23   ← shared entity routes,
│   ├── children                                S-24      pushed onto the ACTIVE tab's stack
│   ├── consistency                             S-25
│   ├── peers                                   S-26
│   ├── observations                            S-49
│   └── coverage                                S-51
├── project/[id]                                S-27
│   ├── finance                                 S-28
│   │   └── ledger/[kind]                       S-29
│   │       └── line/[lineId]                   S-30, S-30a
│   ├── timeline                                S-31
│   ├── progress                                S-32
│   ├── intelligence                            S-33
│   ├── observations                            S-34
│   │   └── [observationId]                     S-35
│   ├── priority                                S-36
│   ├── compare                                 S-37, S-38
│   └── location                                S-39
├── tender/[id]                                 S-40
├── contractor/[id]                             S-42
│   ├── tenders                                 S-43
│   └── concentration                           S-44
├── scheme/[id] · department/[id]               S-45, S-47
├── source/[docId]                              S-53
│   ├── document        (modal, full-screen)    S-54
│   └── lineage                                 S-55
├── sources (registry)                          S-56
├── ask                                         S-58
│   ├── citations                               S-59
│   └── history                                 S-60
├── settings/*                                  S-68 … S-80
└── (sheets)  ← presented over anything, never routed to as a screen
    S-07 · S-08 · S-09 · S-16 · S-19 · S-20 · S-21 · S-30 · S-50 · S-52 · S-57 · S-65
```

### Entity routes live in _every_ tab's stack

`project/[id]` is not owned by a tab. Opening a project from Search pushes it onto the Search stack; opening the same project from the map pushes it onto the Explore stack. Consequences:

- **Back always returns to where you came from.** A journalist mid-search does not lose their results because they opened a project.
- **Each tab retains its own history**, so switching tabs and returning restores context.
- The trade-off is a screen that can exist twice in two stacks. That is correct: they are two independent investigations.

---

## Depth control — three mechanisms instead of a breadcrumb

**1 · The scope chip (persistent, 1 line, in the header)**
Shows the user's _chosen scope_, not their stack position: `[Pune district ▾]`. Tapping opens S-09 to change it. It answers "where am I working?" without answering "how did I get here?", which the back button already covers. It costs one line, and it is also the FY carrier.

**2 · The ancestor row (contextual, on entity screens only)**
Directly under the header of S-23 / S-27:

```text
↑  India › Maharashtra › Pune › Baramati            ▸
```

One line, horizontally scrollable, ellipsized from the left so the _nearest_ ancestors stay visible. Tapping a segment pushes that unit. Tapping ▸ opens the full ancestor list as a sheet. This is a breadcrumb — but only where it carries information (an entity's position in the hierarchy), not on every screen.

**3 · Long-press back → ancestor menu**
Long-pressing the header back button lists the current stack and offers "Back to <screen>" — the standard escape hatch for a 9-deep stack. On Android, the hardware/gesture back still pops one level.

**Stack depth guard.** When a stack exceeds **12 entries**, opening a further entity _replaces_ the top entry rather than pushing, and the ancestor menu remains the way back. This bounds memory (`.docs/02-architecture/performance.md`) and prevents the 40-tap unwind.

---

## Sheets: the mobile answer to hover, popover, and drawer

`.docs/01-product/dashboard-design-legacy.md` specifies a `ProvenanceDrawer`, hover tooltips, and popovers — all desktop affordances. On mobile these become **bottom sheets**, which are reachable one-handed, dismissible by gesture, and preserve the underlying context.

| Sheet                    | Detent           | Dismiss          | Why a sheet and not a screen            |
| ------------------------ | ---------------- | ---------------- | --------------------------------------- |
| **S-52 Source**          | 55% → full       | swipe / backdrop | Must never lose the figure it explains  |
| S-57 Methodology         | 45%              | swipe            | Reference, read and dismissed           |
| S-19 Feature preview     | 30% (peek) → 70% | swipe down       | Map must stay visible behind it         |
| S-20 Cluster contents    | 55% → full       | swipe            | Same                                    |
| S-16/21/50 Filters       | 70%              | apply / swipe    | Live result count needs the list behind |
| S-08 FY · S-09 Scope     | 45%              | select           | Global switches, no context loss        |
| S-30 Ledger line         | 60%              | swipe            | Detail of the row behind it             |
| S-65 Watch settings      | 40%              | swipe            | Per-item toggle                         |
| S-07 Notification primer | 35%              | swipe            | Contextual permission                   |

**Rules.** Maximum sheet depth is **2** (a source sheet may open over a filter sheet; nothing may open over that — it opens as a screen instead). Sheets never contain their own tab bar. Every sheet is fully operable with a screen reader and closes on the Escape/back gesture.

**S-54 Document viewer is a full-screen `modal`, not a sheet** — it needs the full viewport, its own zoom/pan gesture space (which would conflict with sheet dismissal), and it must not be dismissed by an accidental downward swipe while panning a PDF.

---

## Modals

Reserved for surfaces that must interrupt: **S-06 forced upgrade** (blocking), **S-54 document viewer**, **S-67 sign-in**, and the onboarding group. Nothing else. Every modal declares an explicit dismiss affordance; only S-06 lacks one, and even S-06 is dismissible when the device is offline (never strand a user behind an upgrade wall they cannot satisfy).

---

## Deep linking

Expo Router's file-based routes **are** the deep-link table — the route tree above is the URL space, with no second mapping to drift out of sync. That is a primary reason for choosing Expo Router (`adr/002-navigation.md`).

```text
lokdarpan://project/501                     → project/[id]
lokdarpan://project/501/finance             → project/[id]/finance
lokdarpan://unit/532                        → unit/[id]
lokdarpan://village/8891  district/7  ...   → alias → unit/[id]  (see 21-deep-linking)
lokdarpan://contractor/61                   → contractor/[id]
lokdarpan://source/220?page=42              → source/[docId]/document
lokdarpan://search?q=…&types=…              → search/results
```

**Synthetic back stack.** A deep link never lands the user on a screen whose back button exits the app. Opening `lokdarpan://project/501` builds `Home → unit/7 → project/501` so "back" walks _up the hierarchy_, matching the user's mental model. The ancestor chain comes from the entity payload, so the synthetic stack is real, not guessed.

Full scheme, universal-link setup, validation, and security: `.docs/10-mobile/deep-linking.md`.

---

## Navigation state ownership

| State                 | Owner                               | Persisted               | Why                                                    |
| --------------------- | ----------------------------------- | ----------------------- | ------------------------------------------------------ |
| Route stacks          | Expo Router / React Navigation      | Yes (state restoration) | Survive process death mid-investigation                |
| Active tab            | Router                              | Yes                     |                                                        |
| **Scope** (unit + FY) | Zustand `scopeStore`                | Yes (MMKV)              | Global, cross-tab, survives relaunch                   |
| Sheet presentation    | Local component state               | No                      | Transient by definition                                |
| Map camera            | Zustand `mapStore`                  | Session only            | Restoring a stale camera on cold start is disorienting |
| Filters               | Per-screen, encoded in route params | In-stack only           | Shareable and restorable via the URL                   |

Filters live in route params, not global state — so a filtered list is a shareable link and back/forward restores it correctly.

---

## Transitions and motion

- Push/pop: platform default (iOS slide, Android fade-through). No custom hero animations in Phase 1 — they cost frames on the reference low-end device (`.docs/02-architecture/performance.md`).
- Tab switch: no animation; instant.
- Sheets: spring, 300 ms, with `reduceMotion` collapsing to a 100 ms fade (`.docs/01-product/accessibility.md`).
- **Skeleton on push, not spinner.** The header of the destination renders instantly from the route params the caller already had (name, category, place), so a push always paints real content in the first frame.

---

## Anti-patterns explicitly excluded

| Excluded                                       | Reason                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Persistent breadcrumb bar on every screen      | 44 pt of permanent chrome duplicating the back stack                                                  |
| Hamburger drawer                               | Hides the IA; poor thumb reach                                                                        |
| Nested tabs (tabs inside a tab)                | Two competing "current locations"                                                                     |
| Modal-over-modal chains                        | Unrecoverable dismissal; iOS card-stack degradation                                                   |
| Custom back gestures                           | Fights the OS; breaks Android predictive back                                                         |
| Tab-bar badge on an "observations" count       | Would turn neutral observations into a notification-driven engagement loop (`00-document-audit` PR-3) |
| Bottom-sheet navigation as the primary pattern | Sheets are for context, not for a hierarchy — a 7-level sheet stack is unnavigable                    |
