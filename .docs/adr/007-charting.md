# ADR-007 — Charting: `react-native-svg` only; no chart library

**Status:** Accepted · 2026-08-21

## Context

`docs/12` chose Recharts/visx — both web-only. The visualizations this product actually needs (`.docs/06-design-system.md` §Charts):

| Visualization | Form |
|---|---|
| Money Trail | Vertical stepper with labelled variance connectors |
| Variance | Two aligned bars + an explicit difference row |
| Peer position | 1-D distribution strip, median marked, this value pinned |
| Trend | Compact sparkline + a range segmented control |
| Composition | Stacked horizontal bar with inline legend |
| Cost per unit | Three aligned value rows (actual / model / median) |

**None of these is a generic chart.** There is no scatter plot, no multi-series axis chart, no interactive crosshair, no zoomable time series. Bundle budget is 3.5 MB on a low-end device (`.docs/14-performance.md`), and the design brief explicitly rejects a "generic admin dashboard" look (`.docs/06-design-system.md`).

## Decision

**Build a small internal chart kit on `react-native-svg`.** No third-party charting library in Phase 1. Every chart component is required to expose a text equivalent and a "view as list" fallback (`.docs/12-accessibility.md`).

## Alternatives considered

**Victory Native XL (Skia).** Excellent, modern, performant, good gesture support. Rejected: pulls in `@shopify/react-native-skia` (a large native dependency) for shapes we can draw in ~40 lines of SVG, and its axis/scale abstractions actively push toward conventional chart layouts — the opposite of the bespoke, mobile-first forms above. Its real strength (60 fps interactive scrubbing over thousands of points) is capability this product does not use.

**`react-native-gifted-charts`.** Fast to adopt. Rejected: opinionated visual defaults that read as "template dashboard", limited control over accessibility output, and it still would not produce the Money Trail — the one visualization that carries the product.

**`react-native-chart-kit`.** Rejected: unmaintained, limited, poor accessibility.

**Victory Native (legacy).** Rejected: performance issues on low-end Android; effectively superseded.

**A WebView with a JS charting library.** Rejected: memory, latency, gesture conflicts, and an accessibility black box.

## Why bespoke is genuinely correct here (not NIH)

1. **The signature component cannot be bought.** `MoneyTrail` — the vertical chain with labelled variance connectors, per-stage record counts, source chips, and an `insufficient_data` state — is not a chart type any library ships. It is the product's central visual argument and must be built regardless.
2. **Accessibility is a hard requirement, not a feature.** Every chart must emit a full textual equivalent and a list view (`.docs/12-accessibility.md`, CI-gated). Retrofitting that onto a library's internal SVG output is harder than writing the SVG.
3. **Neutrality binds the rendering.** No red, no traffic lights, no colour-only encoding, colour-blind-safe ramps (`.docs/06-design-system.md`). A library's default palette is the first thing we would override, and its defaults would keep reappearing as new charts are added.
4. **Bundle.** 150–250 KB avoided, on a 3.5 MB budget targeting a 4 GB phone.
5. **`react-native-svg` is needed anyway** — icons, the Money Trail connectors, map callouts. It is not an added dependency.

## Trade-offs

- **We maintain the chart code.** Bounded: six components, each under ~150 lines, pure and directly unit-testable.
- **No free interactivity.** Deliberate — a fat finger cannot hit a data point on a 350 pt chart, so tooltips and crosshairs were never in the design (`.docs/06-design-system.md`).
- **Adding a genuinely complex chart later would mean writing it.** Accepted, with a documented escape hatch below.

## Escape hatch

If a future requirement genuinely needs an interactive, multi-series, scrubbing chart (plausible when the platform expands to multi-year national trend analysis), **Victory Native XL** may be introduced **behind the same component API**, for that chart only. The chart kit's interface (`data`, `tokens`, `accessibilityLabel`, `onViewAsList`) is designed so a single component's internals can be replaced without touching a screen. This ADR would then be superseded, not silently violated.

## Consequences

- The visualizations look like this product, not like a dashboard template.
- Every chart is accessible by construction, because we write the accessibility output.
- Charts are pure functions of props — trivially unit-tested and snapshot-tested at multiple text scales.
- Chart code lives in `ui/charts/` and is domain-agnostic; product meaning is assembled in `features/`.
