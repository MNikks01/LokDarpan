# 06 — Design System

## Design brief

The product must feel **institutional but not bureaucratic; serious but not severe; data-dense but readable at arm's length on a ₹8,000 phone in daylight.**

Three constraints are unusual here and shape everything:

1. **Neutrality is a visual property.** Colour, weight, and iconography are how a reader decides whether they are looking at a fact or an accusation. A red badge on an 11% variance says "wrongdoing" more loudly than any caption can deny. `docs/15` therefore binds the palette, not just the copy.
2. **Non-partisanship must be visible.** In an Indian civic product, saffron, the tricolour, party blues and greens all carry political meaning. The identity must read as belonging to no one.
3. **Numbers are the content.** Not decoration around content — the content. Typography is chosen for tabular figures before it is chosen for headlines.

### Reference points, not templates
The quality bar is that of a well-made reference tool — a good transit app, a good banking statement, a good reader — where restraint, alignment, and legibility do the work. Explicitly **not**: admin dashboards, gradient SaaS marketing, glassmorphism, neon data-viz, or a 2012 government portal.

---

## Typography

### Typefaces

| Role | Family | Why |
|---|---|---|
| Latin + **all numerals** | **Inter** (variable) | Genuine tabular lining figures, a disambiguated `1`/`l`/`I` and `0`/`O`, excellent at 11–13 pt on low-DPI screens, OFL |
| Devanagari (मराठी, हिन्दी) | **Noto Sans Devanagari** | Full conjunct coverage, matched x-height to Inter, OFL, designed for UI |
| Monospace (IDs, hashes, work IDs) | **JetBrains Mono** | Only for identifiers — work IDs, tender IDs, artifact hashes |

**Bundled, not fetched.** Fonts ship in the binary — a font that requires the network is a font that fails offline, and the app must be fully legible with no connection.

**Numerals are always Latin digits**, even in Marathi and Hindi, because every source government document uses them and a reader cross-checking a figure against a PDF must see the same glyphs. This is a deliberate localization exception and is stated in `.docs/12-accessibility.md`.

### Scale

Base 16 pt, ratio ≈1.2, capped so 200% OS scaling stays usable.

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 34 / 40 | 600 | −0.02em | The one headline figure on a screen |
| `headline` | 24 / 30 | 600 | −0.01em | Entity names |
| `title` | 20 / 26 | 600 | 0 | Section headers |
| `subtitle` | 17 / 24 | 500 | 0 | Card titles |
| `body` | 15 / 22 | 400 | 0 | Prose, observations |
| `bodyStrong` | 15 / 22 | 600 | 0 | Inline emphasis |
| `label` | 13 / 18 | 500 | +0.01em | Field labels |
| `caption` | 12 / 16 | 400 | +0.01em | Source chips, `asOf`, confidence |
| `overline` | 11 / 14 | 600 | +0.06em, uppercase | Section eyebrows |
| **`figureLg`** | 28 / 32 | 600 | **tabular** | Money Trail stage totals |
| **`figureMd`** | 20 / 24 | 600 | **tabular** | Card figures |
| **`figureSm`** | 15 / 20 | 500 | **tabular** | In-list figures |
| `mono` | 13 / 18 | 400 | 0 | Identifiers |

**Every numeric token sets `fontVariantNumeric: ['tabular-nums','lining-nums']`.** Money in a vertical list that does not align by digit is unreadable, and misreading a crore as a lakh is the exact failure this product cannot have.

### Rules

- `maxFontSizeMultiplier`: 2.0 on prose, **1.6 on figures** (beyond that a `₹12,45,678` string cannot fit any layout and must reflow — see below).
- Above 130% scale, `label + figure` rows switch from horizontal to **stacked** layout automatically. No truncation of a monetary value is permitted, ever — a truncated figure is a wrong figure.
- Devanagari gets +2 pt line height at every size (matras need the room).
- Marathi/Hindi strings are allowed 1.35× the English length in layout budgets.

---

## Colour

### Foundations

A **graphite-and-paper** neutral base with a single institutional accent: **deep teal**. Teal is legible, has no party association in India, is distinguishable under the common colour-vision deficiencies, and reads as civic/utility rather than commercial.

```text
LIGHT                                   DARK
bg/canvas      #FBFBFA                  #0E1113
bg/surface     #FFFFFF                  #171A1D
bg/raised      #F4F5F4                  #1F2326
bg/sunken      #F0F1F0                  #0A0C0E
border/hair    #E3E5E3                  #2A2F33
border/strong  #C9CDC9                  #3A4045
text/primary   #14181A   (AA on canvas) #EDEFEF
text/secondary #55605F                  #A3ADAC
text/tertiary  #7A8483                  #7E8888
accent         #0F766E                  #2DD4BF
accent/soft    #E6F2F0                  #10312E
focus ring     #0F766E @ 2px            #2DD4BF @ 2px
```

Contrast: `text/primary` ≥ 12:1, `text/secondary` ≥ 4.6:1, `text/tertiary` ≥ 3.2:1 (never used for essential text). Verified in CI (`.docs/12-accessibility.md`).

### Data colour — the neutrality-critical part

**Rule 1 — no red for variance, deviation, or verification priority.** Red means alarm, error, danger, and — in a public-finance context — blame. `docs/15` forbids implying wrongdoing; a red badge implies it before a word is read. Red is reserved for exactly one thing: **a destructive user action** (delete an offline pack).

**Rule 2 — no red/green diverging ramps.** They fail deuteranopia and protanopia (~8% of men in India), and green/red encodes good/bad, which is a judgment the app is not entitled to make.

**Rule 3 — colour is never the only signal** (`docs/09`): every band, severity, and status carries an icon **and** a text label.

```text
Sequential (magnitude — choropleth, intensity, share)      colour-blind safe, prints legibly
  seq/1 #E8EDEC  seq/2 #BFD4D1  seq/3 #8FBAB5  seq/4 #5B9A94  seq/5 #2F7A73  seq/6 #0F5951

Diverging (only where a true midpoint exists: above/below a median)  blue ↔ amber, never R/G
  div/-3 #1D4E89  div/-2 #4C7FB5  div/-1 #A9C4DE  div/0 #EDEDEA
  div/+1 #E8C88A  div/+2 #C79A3E  div/+3 #8A6519

Verification-priority bands (docs/07) — INTENSITY, not hue-as-alarm
  Low 0–24        #E8EDEC bg  ·  #2F4F4C text  ·  icon ○
  Medium 25–49    #DCE6E4 bg  ·  #1F3E3B text  ·  icon ◔
  High 50–74      #EFE3CB bg  ·  #6B4E14 text  ·  icon ◑
  Very high 75+   #E5D2AE bg  ·  #4A360C text  ·  icon ◕
  → an amber ramp, deliberately quiet. No red, no siren, no gauge.

Confidence
  High ≥0.90  text/secondary, no chip     Medium 0.70–0.89  amber outline chip
  Low <0.70   amber solid chip + "extracted from a scanned document" in words

Status (project lifecycle — categorical, not judgmental)
  sanctioned #7A8483 · tendered #55605F · in_progress #0F766E
  completed  #2F7A73 · stalled #8A6519 · unknown  hatched grey

Coverage / missing data
  A neutral slate + a hatch pattern. Never a colour that reads as "bad" —
  a gap in publication is not a finding.
```

### Dark mode
Required (night reading, OLED battery, low-light rural use). Not an inversion: surfaces lift with lightness rather than shadow, the sequential ramp is re-tuned for a dark ground, and the amber band colours are lightened to hold ≥4.5:1. Both themes are defined explicitly; neither is derived from the other.

---

## Spacing, radius, elevation

```text
space   0:0  1:4  2:8  3:12  4:16  5:20  6:24  7:32  8:40  9:48  10:64
radius  sm:6  md:10  lg:14  xl:20  full:999
hit     minimum 44×44 pt, always (12-pt icon → 44-pt target)
gutter  16 pt screen edge · 12 pt card padding · 8 pt inline gaps
```

**Near-flat elevation.** Hairline borders (`border/hair`, 1 px) do the separation work; shadows are reserved for surfaces that genuinely float:

| Level | Use | Light | Dark |
|---|---|---|---|
| 0 | Cards, rows | border only | border only |
| 1 | Sticky headers | y1 blur2 @4% | border + `bg/raised` |
| 2 | Bottom sheets | y−4 blur16 @10% | border/strong + `bg/raised` |
| 3 | Modals, map callouts | y8 blur24 @14% | as above |

Shadows on data cards make a screen look like a dashboard template. They are not used.

---

## Motion

Fast, purposeful, cheap on a mid-range GPU.

| Motion | Duration | Curve |
|---|---|---|
| Press feedback | 90 ms | ease-out, scale 0.98 |
| Sheet present | 300 ms | spring (damping 26, stiffness 260) |
| Screen push | platform default | platform |
| Skeleton shimmer | 1200 ms loop | linear, ≤6% opacity delta |
| Value change (updated figure) | 400 ms | background-tint flash, no movement |
| Chart draw-in | 350 ms | ease-out, **once**, never on re-render |

`reduceMotion` collapses every one of these to an opacity change ≤120 ms. No parallax, no hero transitions, no animated counters (an animated money figure is unreadable *and* implies precision it may not have).

---

## Components

### Neutrality primitives — the components that encode `docs/15`

These four are the reason the design system exists. Each makes a rule from `docs/15` structurally impossible to violate (see `.docs/05-mobile-architecture.md` §3).

**`<Figure>`** — the only way to display a fact.
```text
┌──────────────────────────────────────────┐
│ Utilized                                 │  label
│ ₹8.00 crore                              │  figureLg, tabular
│ 🔗 MH PWD — Works · OCR 82% · 30 Jul 26  │  caption, tappable → S-52
└──────────────────────────────────────────┘
```
Requires `provenance`. Renders `missingReason` instead of the value when null (never ₹0). Screen-reader label reads value **and** source **and** confidence.

**`<Observation>`** — accepts only `ServerText` (branded). A literal string will not compile.

**`<MissingData>`** — states *what* is missing, *which source* would carry it, and *when it was last checked*. Never a blank, never a zero, never a shrug.

**`<VerificationPriorityChip>`** — the 0–100 score. Band label leads with the action ("worth a closer look"), amber ramp only, always with a one-tap path to the factor breakdown, never renderable without its confidence.

### Product components

| Component | Notes |
|---|---|
| `AppHeader` | Scope chip + FY chip + up to 2 actions. Collapses on scroll to a title bar |
| `AncestorRow` | Left-ellipsized hierarchy path, horizontally scrollable, ▸ opens the full chain |
| `ScopeChip` · `FiscalYearChip` | Open S-09 / S-08 |
| `SearchBar` | Debounced, cancellable, voice-optional, clearable |
| `FilterSheet` | Live result count; Apply / Reset |
| `DataCard` | Base card: title, optional eyebrow, optional action, hairline border |
| `FinanceCard` | A stage of the chain — amount + record count + source + status |
| **`MoneyTrail`** | The signature component. See below |
| **`VarianceRow`** | Two figures, their difference, the percentage, **and its denominator in words**. Never a bare % |
| `Metric` | label + `figureMd` + optional peer context + `?` → S-57 |
| `PeerDistributionStrip` | Where this value sits in the peer distribution; median marked; `n` always shown; withheld below n=8 |
| `Timeline` | Vertical, dated nodes, each source-linked; gaps drawn as gaps |
| `ProjectCard` | Name, category, place, headline figure, priority chip, status |
| `UnitCard` | Name, level, headline metric, coverage indicator |
| `SourceCard` · `SourceChip` | Authority, doc, page locator, method, confidence |
| `EvidenceCard` | An observation's inputs: each figure + its source |
| `ComparisonCard` | One entity per card; swipeable set shares a metric rail. **Replaces tables** |
| `CoverageNote` | Expected vs. present vs. missing, with the responsible source |
| `ConfidenceChip` | High (no chip) / Medium / Low, with an explanation on tap |
| `StatusIndicator` | Icon + text + colour, in that order of importance |
| `Badge` · `Chip` | Neutral by default; no semantic colour without a matching icon and label |
| `BottomSheet` | Detented, gesture-dismissible, a11y-complete, max depth 2 |
| `EmptyState` · `ErrorState` · `OfflineState` | Distinct components, never one generic "no data" (`.docs/15-state-design.md`) |
| `LoadingSkeleton` | Shape-matched to the real content, not grey rectangles |
| `MapMarker` · `MapCluster` | Type icon + count; ≥44 pt tap target |
| `Chart*` | See `.docs/06` §Charts below |
| `RecordList` | **The mobile replacement for a data table** — see below |

### `MoneyTrail` — the signature component

Vertical because the phone is vertical, and because the flow *is* a sequence. It is the visual argument of the whole product.

```text
  ┌────────────────────────────────────────────┐
  │  ALLOCATED                    1 record  🔗 │
  │  ₹10.00 crore                     BE       │
  └──────────┬─────────────────────────────────┘
             │
             ├─  Allocation variance (A−U)   ₹2.00 crore
             │   20.0% of the allocated amount        (?)
             │
  ┌──────────┴─────────────────────────────────┐
  │  RELEASED                   1 instalment 🔗│
  │  ₹9.00 crore                               │
  └──────────┬─────────────────────────────────┘
             │
             ├─  Release variance (R−U)      ₹1.00 crore
             │   11.1% of the released amount         (?)
             │
  ┌──────────┴─────────────────────────────────┐
  │  UTILIZED                     1 record  🔗 │
  │  ₹8.00 crore                               │
  └────────────────────────────────────────────┘
     Status:  ◔ Needs verification    what does this mean? (?)
```

Rules, all load-bearing:
- **Both variances, both labeled with their formula and their denominator in words.** Never a bare "11.1%" (`00-document-audit` C1).
- A missing stage renders as `MissingData`, **never ₹0**, and no variance is computed across it — the status becomes `insufficient_data`.
- Every stage total is tappable → ledger lines; every figure carries its source chip.
- No colour encodes the size of a variance. The status label and the number carry the meaning.
- `(?)` opens the methodology sheet with the exact formula from `docs/06`.

### `RecordList` — the table replacement

`docs/09`'s inconsistency tables and district comparison tables have no mobile equivalent. Instead:

```text
┌────────────────────────────────────────────┐
│ Release · instalment 1        ₹9.00 crore  │   ← primary line: what + how much
│ 02 Nov 2024 · MH Treasury · 🔗            │   ← secondary: when + source
└────────────────────────────────────────────┘
```
Two lines, one figure, always source-linked, sortable via a header control, virtualised with `FlashList`. Where a genuine matrix is unavoidable (comparison), `ComparisonCard` + a shared metric rail is used — never horizontal scroll of a grid.

---

## Charts

Built in-house on `react-native-svg`; **no charting library in Phase 1** (`adr/007-charting.md`). The visualizations this product needs are bespoke and simple; a generic chart library would deliver a generic dashboard look and 200 KB of bundle for shapes we can draw in 40 lines.

| Chart | Form | Mobile-first because |
|---|---|---|
| Money trail | Vertical stepper | Not a Sankey — a phone is tall, and a chain is a sequence |
| Variance | Two aligned bars + an explicit difference row | A pie or donut cannot express "9 minus 8" |
| Peer position | 1-D distribution strip, median marked, this value pinned | A boxplot is unreadable at 350 pt; a scatter needs axes we don't have room for |
| Trend | Compact sparkline + a range segmented control (3y / 5y / all) | No scrubbing crosshair — a fat finger cannot hit a data point |
| Composition | Stacked horizontal bar with an inline legend | Donuts hide small slices and require a legend lookup |
| Cost per unit | Value vs. model vs. median as three aligned rows | Direct comparison beats a chart when n=3 |

**Every chart is required to ship a text equivalent** (`accessibilityLabel` + a "view as list" action) and a `Chart→RecordList` fallback honoured by the `alwaysShowDataAsList` accessibility setting. A chart without a text equivalent fails CI.

---

## Iconography

A single line-icon set at 1.5 px stroke, 24 pt grid (`lucide` — OFL/ISC, tree-shakeable). Banned: warning triangles, sirens, alarm bells, exclamation marks, thumbs, scales-of-justice, magnifying-glass-over-money, and any icon implying judgment or investigation. Coverage gaps use a neutral hatch glyph; observations use `◔`-family band glyphs; the source affordance is a consistent link glyph everywhere in the app.

---

## Tokens in code

```ts
// ui/tokens — the single source of truth; no raw hex, px, or ms outside this folder (lint-enforced)
export const tokens = {
  color: { light: {...}, dark: {...} },
  space: [0,4,8,12,16,20,24,32,40,48,64],
  radius: { sm:6, md:10, lg:14, xl:20, full:999 },
  type:  { display:{...}, figureLg:{...}, /* … */ },
  motion:{ fast:90, sheet:300, skeleton:1200 },
  hit:   { min: 44 },
} as const;
```

Theme is provided by context, consumed via `useTokens()`. A `Text` component that is not one of the typographic primitives, or a colour that is not a token, fails lint. This is what keeps a 15-domain national app visually coherent across years and contributors.

---

## What this system deliberately does not have

Gradients · glassmorphism · neon accents · animated counters · decorative illustrations of money or buildings · card shadows on data · a 6-colour categorical palette · red-amber-green traffic lights · progress rings around risk scores · confetti · a mascot · emoji in product copy · any imagery of officials, contractors, or ministries.
