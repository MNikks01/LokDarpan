# 09 — Dashboard Design

The public dashboard is the surface where neutrality is most visible. Three UI contracts hold on **every** page:

1. **Every figure is a source.** Each number renders with a source link, an "as of" date, and a confidence indicator when extracted.
2. **Gaps are shown, not hidden.** Missing data appears as an explicit warning chip, never a blank or a zero.
3. **Neutral language only.** Labels are factual ("deviation," "needs verification"); never accusatory. Copy is reviewed against [15](../17-legal/legal-ethical-rules.md).

**Stack:** Next.js (App Router) + Tailwind + Mapbox GL + React Query ([12](../02-architecture/tech-stack.md)).

## Shared components

- `FigureWithSource` — renders a `Money`/number + source popover (link, method, confidence, date).
- `VarianceBadge` — shows deviation % with neutral color scale (informational, not red=bad).
- `ConfidenceChip` — 0–1 confidence → High/Medium/Low with tooltip.
- `MissingDataWarning` — "No expenditure records published for FY2024-25."
- `ProvenanceDrawer` — full source trail for a value or observation.
- `VerificationPriorityMeter` — the 0–100 score with its factor breakdown (labeled "Verification Priority," never "corruption").

## Pages

### 1. Overview (`/`)

Purpose: a state-level snapshot of Phase-1 roads finance.

- **Revenue summary:** total state revenue by source (tax/GST/excise/borrowing/grants) for the selected FY, each source-linked. Nominal + inflation-adjusted toggle.
- **Ministry / department spending:** allocated vs released vs utilized for PWD & road departments, as grouped bars.
- **Project count:** by category (SH/NH/bridge/rural/urban) and status (in-progress/completed/stalled) with a small funnel from sanctioned → completed.
- **Headline consistency:** count of projects by verification-priority band (not framed as "corrupt").
- **FY & scope selectors** persist across pages.

```text
┌───────────────────────────────────────────────────────────────┐
│  Maharashtra · Roads & Transportation · FY2024-25   [FY ▾]     │
├───────────────┬───────────────┬───────────────┬───────────────┤
│ Revenue       │ Allocated     │ Released      │ Utilized      │
│ ₹— cr (src)   │ ₹— cr (src)   │ ₹— cr (src)   │ ₹— cr (src)   │
├───────────────┴───────────────┴───────────────┴───────────────┤
│ [ Alloc vs Released vs Utilized by department — grouped bars ] │
│ [ Projects by status — funnel ]   [ Priority bands — donut ]   │
└───────────────────────────────────────────────────────────────┘
```

### 2. Map (`/map`)

Purpose: spatial exploration.

- **District choropleth** (PostGIS → vector tiles/GeoJSON) colored by a chosen neutral metric (utilization %, project count, median cost/km).
- **Roads** as line layer, **bridges** as point layer; click → mini-card → link to Project Detail.
- **Filters:** category, status, FY, verification-priority band.
- **Legend** states the metric and that color encodes a *measurement*, not a judgment.
- Clusters at low zoom; hover tooltips with source date.

### 3. Project Detail (`/project/[id]`)

Purpose: follow one project end-to-end. This is the core "follow the money" view.

- **Header:** name, category, district, department, status, external work id, verification-priority meter (with breakdown).
- **Finance chain:** Allocated → Released → Utilized with the derived **variance** and **deviation %** (`ProjectFinance`), each figure source-linked; missing links shown as warnings.
- **Timeline:** sanction → tender → releases (installments) → expenditure → progress snapshots → completion, on a horizontal time axis.
- **Contractor:** awarded tender(s), awarded amount vs estimate, number of bidders, contractor's aliases (transparency of canonicalization). No characterization of the contractor.
- **Road intelligence** (roads only): cost/km actual vs modeled vs district median, expected asphalt/material, all with model version and caveats ([08](../03-domain/road-infrastructure-intelligence.md)).
- **Observations:** the neutral anomaly list for this project, each expandable to its evidence/sources.

```text
┌ Project: <name>  ·  Rural Road  ·  <district>  ·  status: in_progress ┐
│ Verification Priority: 40 / 100  [ view factor breakdown ]           │
├──────────────────────────────────────────────────────────────────────┤
│ Allocated ₹10cr → Released ₹9cr → Utilized ₹8cr                       │
│   Release variance ₹1cr · deviation 11.1% · status: needs_verification│
│   (each figure: 🔗 source · confidence · as-of)                       │
├──────────────────────────────────────────────────────────────────────┤
│ [ Timeline: sanction ─ tender ─ releases ─ expenditure ─ progress ]   │
│ Contractor: <canonical name> · awarded ₹— vs est ₹— · bidders: —      │
│ Road: cost/km ₹3.2cr vs model ₹2.6cr (+23%) vs district median (+16%) │
│ Observations (3): [utilization deviation] [cost/km outlier] [1 gap]   │
└──────────────────────────────────────────────────────────────────────┘
```

### 4. Analytics (`/analytics`)

Purpose: aggregate patterns.

- **Anomaly charts:** counts by type and severity; distribution of deviation %; cost/km distribution with the selected project marked.
- **Trend graphs:** allocation/release/utilization over fiscal years (inflation-adjusted toggle); YoY and CAGR.
- **Contractor concentration:** HHI and top-k share by taluka/district with the standard descriptive labels ([06 §8](../07-analytics/analytics-engine.md)).
- **Comparison explorer:** pick a project → see it against its peer distribution.
- All charts export to CSV/PNG with sources embedded.

### 5. Audit View (`/audit`)

Purpose: a reviewer's worklist of inconsistencies — explicitly framed as _items to verify_.

- **Inconsistencies table:** every `anomaly`, filterable by type/severity/district/department, each row linking to its project and evidence.
- **Warnings:** missing-record and low-confidence items separated out (these are coverage issues, not deviations).
- **Explanations:** each row carries the plain-language, neutral observation and the exact figures + sources that produced it; an "Explain" action calls the AI layer for a longer neutral summary ([11](../09-ai/ai-layer.md)).
- **Prominent disclaimer** on this page: these are data-consistency observations from official records, not findings of wrongdoing.

## Accessibility & i18n

- WCAG 2.1 AA: color is never the only signal (icons + text on every badge); keyboard navigable; screen-reader labels on figures include the source and confidence.
- Bilingual **English + Marathi** (extensible to Hindi) — critical for the civic audience.
- Numbers formatted in the Indian system (crore/lakh) with a rupee sign and an accessible full-value tooltip.

## Empty / low-data states

Every widget has an explicit empty state that names *what* is missing and *why* (e.g., "No tender record linked to this project in the ingested sources"), reinforcing that absence of data ≠ absence of activity.

---

## National-scale dashboards (drill-down by hierarchy level)

The public app is a **drill-down** from nation → state → district → local body/village → project, each level reusing the shared components and UI contracts above. A breadcrumb (`India / Maharashtra / Pune / Baramati / GP Katewadi / Project`) is always present; every figure stays source-linked at every level.

### National Dashboard (`/`)
- **Revenue** by source (income tax, GST, corporate, customs, excise, non-tax, borrowings, grants), source-linked, nominal/real toggle.
- **Expenditure** by ministry and by domain (roads, health, education, water, …).
- **Fiscal deficit** = total expenditure − total receipts (shown as a figure with its source, not a judgment).
- **Ministry spending** ranked by allocation vs utilization ratio.
- **India choropleth** ([20](../03-domain/gis-intelligence.md)) by per-capita expenditure / utilization; click a state to drill down.

### State Dashboard (`/state/[id]`)
- State finances: own revenue + central transfers, allocation vs release vs utilized.
- Department & scheme spending within the state.
- District choropleth; ranked district comparison (per-capita, utilization).

### District Dashboard (`/district/[id]`)
- District analytics: allocation/release/expenditure, project counts by domain & status.
- Local-body breakdown (ULBs + PRIs); taluka/block map.
- Peer comparison against sibling districts; verification-priority bands.

### Village / Local-Body Dashboard (`/unit/[id]`)
- Gram Panchayat / ULB expenditure: scheme grants received (Finance Commission, MGNREGA, PMGSY, PMAY, etc.), works undertaken, per-capita spend.
- Ward-level project list; local map with asset points.
- Missing-data warnings are especially prominent here (local publication is the most uneven) — coverage gaps are shown, never inferred.

### Infrastructure Dashboard (`/infrastructure`)
- Cross-cutting view by asset type: roads, bridges, hospitals, schools, railways, pipelines, power.
- Cost-per-unit distributions (cost/km, cost/bed, cost/classroom) with the selected asset marked ([06](../07-analytics/analytics-engine.md)).
- Map + table linked; export with sources.

### Audit Dashboard (`/audit`)
As in Phase 1, but scoped to any hierarchy level: inconsistencies, warnings, roll-up gaps, and per-item neutral explanations with evidence links — with the standing disclaimer that these are data-consistency observations from official records, not findings of wrongdoing.

**Level-agnostic pattern:** every level shows the same four panels — *money in* (allocation/transfers), *money out* (release/expenditure), *what was built* (assets/progress), *consistency* (variance/observations) — so users learn one layout and apply it everywhere.
