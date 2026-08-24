# Wireframes — Navigation shell

## The shell

```text
┌──────────────────────────────────────────────┐
│  Pune district ▾        FY2024-25 ▾    🔔  ⚙ │  56pt — scope header
├──────────────────────────────────────────────┤
│                                              │
│                                              │
│                  CONTENT                     │
│                                              │
│                                              │
│                                              │
├──────────────────────────────────────────────┤
│    🏠        🗺         🔍          ☆        │  49pt + safe area
│   Home     Explore    Search      Saved      │
└──────────────────────────────────────────────┘
```

The scope header is per-tab and sticky. `🔔` and `⚙` appear on Home only; other tabs use that space for tab-specific actions.

## Entity header (S-23, S-27 and every entity screen)

```text
┌──────────────────────────────────────────────┐
│ ←   Upgradation of ODR-14, Baramati      ⋮   │
├──────────────────────────────────────────────┤
│ ↑ India › Maharashtra › Pune › Baramati   ▸  │  ← ancestor row, left-ellipsized,
├──────────────────────────────────────────────┤     horizontally scrollable
│ Rural road · in progress · PWD               │
│ FY2024-25 ▾                        ☆  ⇧      │
├──────────────────────────────────────────────┤
```

- No breadcrumb bar on non-entity screens — the ancestor row appears **only** where an entity has a real position in the hierarchy.
- `⋮` = Save · Share · Ask about this · Report a data issue.
- **Long-press ←** opens the stack list ("Back to Search results", "Back to Pune district") — the escape hatch for a deep stack.

## Collapsed header on scroll

```text
┌──────────────────────────────────────────────┐
│ ←  Upgradation of ODR-14…              ☆  ⋮  │  ← 44pt, title only
├──────────────────────────────────────────────┤
```

## Bottom sheet (S-52 shown; the pattern for all sheets)

```text
│                                              │
│              (content dimmed)                │
│                                              │
├──────────────────────────────────────────────┤
│                    ────                      │  ← grab handle + a visible ✕
│                                              │     (gesture is never the only way)
│  SHEET CONTENT                               │
│                                              │
│  [ Primary action ]     [ Secondary ]        │
└──────────────────────────────────────────────┘
```

Detents per sheet in `.docs/02-architecture/mobile-navigation-architecture.md`. **Max sheet depth 2**; a third would open as a screen.

## Deep-link landing (synthetic stack)

```text
lokdarpan://project/501
        ↓
Stack built:  Home → unit/7 (Pune) → unit/412 (Baramati) → project/501
        ↓
┌──────────────────────────────────────────────┐
│ ←   Upgradation of ODR-14, Baramati      ⋮   │  ← back walks UP the hierarchy,
│ ↑ India › Maharashtra › Pune › Baramati   ▸  │     never out of the app
```

## Tab-level empty/first-run

Each tab has its own first-run state; none is a generic "nothing here":
Home → scope not set yet · Explore → "Locate me or browse" · Search → recents + examples · Saved → the teaching empty state (S-62).
