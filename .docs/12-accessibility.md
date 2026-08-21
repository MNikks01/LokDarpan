# 12 — Accessibility

Target: **WCAG 2.2 AA**, applied to a native app (`docs/09` commits to WCAG 2.1 AA; this raises it to 2.2, whose additions — target size, focus appearance, dragging alternatives — are all mobile-relevant).

Accessibility is not a compliance exercise here. The audience includes older citizens reading small figures in daylight, people using a screen reader to check their village's accounts, and users of low-end devices where "reduce motion" is a performance setting as much as a comfort one.

---

## 1 · Screen readers (TalkBack / VoiceOver)

### Figures read with their provenance

A money figure announced as "eight crore rupees" is incomplete — the whole product is that the number has a source. The `<Figure>` component composes its own label:

```text
Visual:   Utilized
          ₹8.00 crore
          🔗 MH PWD — Works · OCR 82% · 30 Jul 2026

Announced:
  "Utilized: eight crore rupees.
   Source: Maharashtra Public Works Department, Works.
   Extracted by OCR, confidence eighty-two percent, low.
   Data as of thirty July twenty twenty-six.
   Double tap for source details."
```

Rules:
- The **crore/lakh word** is spoken, never the digit string — "₹8,00,00,000" read digit-by-digit is meaningless.
- Confidence below 0.90 is spoken as a word ("low", "medium"), not a bare percentage.
- Missing values announce the reason: *"Utilized: no expenditure records published for FY 2024-25. Source that would carry this: MH PWD Works."*

### Structure
- Every screen has one `accessibilityRole="header"` H1 and correctly ordered section headers, so heading navigation works.
- Reading order follows visual order; `importantForAccessibility` hides decorative elements.
- Live regions announce loading completion, errors, filter result counts, and streaming AI answers (announced at sentence boundaries, not per token).
- Bottom sheets trap focus, announce on present, restore focus on dismiss, and close on the back gesture.
- Lists announce position ("item 3 of 25") and load-more state.

### Charts and maps — mandatory alternatives
Every chart component **must** provide:
1. An `accessibilityLabel` carrying the full textual equivalent — *"Cost per km: this project ₹3.20 crore. Modeled estimate ₹2.60 crore, 23% above. District median ₹2.75 crore across 19 comparable roads, 16% above."*
2. A **"view as list"** action rendering the same data as a `RecordList`.

A chart without both fails CI (`.docs/17-testing-strategy.md`). The map's alternative is the **List mode of S-18**, which is not a lesser view but the same query in a different presentation, and `Settings → Prefer list over map` makes it the default permanently.

---

## 2 · Text scaling

The hardest constraint in this product: `₹12,45,67,890` cannot be truncated, ever. A truncated money figure is a *wrong* money figure.

| Rule | |
|---|---|
| Support | 85% → 200% OS text scale |
| `maxFontSizeMultiplier` | 2.0 prose · **1.6 figures** |
| Above ~130% scale | `label + value` rows switch from horizontal to **stacked**; two-column layouts become one column |
| Truncation | **Never** on a monetary value, a percentage, a date, or a unit name. Prose may ellipsize with an expand affordance |
| Containers | Every card and row is height-flexible; no fixed heights on text containers |
| Devanagari | +2 pt line height at all sizes; Marathi/Hindi strings budgeted at 1.35× English length |
| Testing | Every screen is snapshot-tested at 100%, 150%, and 200% |

---

## 3 · Colour and contrast

- `text/primary` ≥ 12:1 · `text/secondary` ≥ 4.6:1 · `text/tertiary` ≥ 3.2:1 (decorative/non-essential only).
- Interactive graphics, chart marks, icons and focus indicators ≥ 3:1.
- **Colour is never the only carrier** (`docs/09`): every band, severity, status and confidence pairs colour with an **icon and a text label**.
- The data palettes are colour-vision-deficiency safe by construction — a single-hue sequential ramp for magnitude and a blue↔amber diverging ramp; **no red/green anywhere** (`.docs/06-design-system.md`). This is simultaneously an accessibility decision and a neutrality decision.
- `Settings → Increase contrast` raises borders to `border/strong`, removes tint backgrounds behind text, and darkens `text/secondary` to `text/primary`.
- Contrast is asserted in CI against the token files for both themes; a failing pair breaks the build.

---

## 4 · Touch targets and motor accessibility

- Minimum **44×44 pt** for every interactive element, including the source chip on a caption line (which is visually 12 pt but has a 44 pt hit slop).
- ≥ 8 pt between adjacent targets.
- **No gesture is the only way to do anything.** Sheet dismissal has a visible close control; the map's pinch-zoom has +/− buttons; swipe-to-delete on saved items has a long-press menu equivalent (WCAG 2.2 *Dragging Movements*).
- No double-tap, long-press, multi-finger, or shake gesture is required for any function; all are shortcuts with a visible equivalent.
- Primary actions sit in the lower two-thirds of the screen for one-handed reach on 6.7" devices.
- `Settings → Larger touch targets` raises the minimum to 52 pt.

---

## 5 · Motion

`prefers-reduced-motion` (OS) and an in-app override collapse every transition to an opacity change ≤120 ms: no sheet spring, no skeleton shimmer (static tint instead), no chart draw-in, no screen-push slide. Nothing auto-plays, auto-scrolls, or auto-advances anywhere in the app.

---

## 6 · Language and reading

- **English · मराठी · हिन्दी**, switchable at first launch and any time.
- **Numerals stay Latin in all locales.** Deliberate: every source government document uses Latin digits, and a reader cross-checking a figure against a PDF must see the same glyphs. Documented here so it is a decision, not an oversight.
- Number *grouping* follows the Indian system (`##,##,###`) in all locales, with an international-grouping option in S-69.
- `lang` is set per text node so the screen reader picks the right voice — mixing Devanagari prose with Latin figures otherwise produces unintelligible output.
- Plain language: the app avoids jargon where possible, and where a term is unavoidable (variance, HHI, BE/RE, verification priority) it carries a `(?)` opening a plain-language explanation (S-57). Reading-level target: comprehensible to a competent 15-year-old reader.

---

## 7 · Cognitive accessibility

Under-served in most data products, and this one is dense:

- **One learned layout everywhere.** The same six sections in the same order on every Unit screen at every level (`.docs/01-screen-inventory.md` S-23). Learn it once at district level, apply it in a village.
- **Every derived number has a `(?)`** explaining what it is, in one sentence, before the formula.
- **No time limits** anywhere. No auto-dismissing toast carrying essential information.
- **Errors are recoverable** and say what to do next, never just what failed.
- Consistent verbs: "Save" always means the same thing; "Source" always opens the same sheet.
- Destructive actions confirm and state consequences in concrete terms ("Delete Pune district pack — frees 34 MB. You'll need a connection to view this area again.").

---

## 8 · Platform integration

Both platforms' accessibility settings are respected without an app-level override: bold text, larger text, reduce transparency, high contrast, screen reader, switch control, voice control (every control has a spoken name matching its visible label), and external keyboard navigation on tablets (full focus order, visible focus ring, Escape closes sheets).

---

## 9 · Testing

| Layer | Method | Gate |
|---|---|---|
| Static | ESLint a11y rules; every `Pressable` requires a label; every image requires alt or decorative | CI blocking |
| Token | Contrast assertions across both themes | CI blocking |
| Component | RNTL queries by accessibility role/label — tests are written as a screen reader sees the UI | CI blocking |
| Layout | Snapshots at 100/150/200% text scale | CI blocking |
| Chart | Every chart must expose a text equivalent + list view | CI blocking |
| E2E | Maestro flows for the core journey with TalkBack enabled | Pre-release |
| Manual | Screen-reader walkthrough of J1, J3, J10 each release | Pre-release |
| External | Audit with users of assistive technology, including Marathi screen-reader users, before public launch | Launch gate |

**Definition of done for any screen** includes: screen-reader-navigable, 200% scale intact, 44 pt targets, contrast verified, no colour-only signal, reduced-motion respected, all figures announced with provenance.
