# 14 — Performance

## The device that defines the budgets

Every number in this document is stated against the **reference device**, not a flagship:

```text
Reference (P50 target device)      Floor (P95 must still function)
Android 11–13                      Android 10
4 GB RAM                           3 GB RAM
Snapdragon 6-series / Helio G-class  Snapdragon 4-series
720 × 1600, 60 Hz                  720 × 1520
eMMC storage                       eMMC
4G, 150–400 ms RTT, frequent 3G    3G, 400–900 ms RTT
```

This is the phone the product's primary audience owns. Optimising for an iPhone 15 and "checking Android later" produces an app that is unusable for most of the people it exists for. All CI performance tests run against a profile matching the reference device.

---

## Budgets

### Startup

| Metric | Target (reference) | Ceiling |
|---|---|---|
| Cold start → first paint | **1.2 s** | 2.0 s |
| Cold start → Home interactive (cached) | **2.5 s** | 3.5 s |
| Cold start → Home interactive (no cache, 4G) | 4.0 s | 6.0 s |
| Warm start → interactive | **0.8 s** | 1.2 s |
| Resume from background | **0.3 s** | 0.5 s |

Held by: no network call blocks first paint (`.docs/02-architecture/data-flow.md` §11) · synchronous MMKV rehydration (<30 ms) · Hermes bytecode precompilation · lazy route segments for map/documents/charts/Ask · no synchronous work in the root layout · fonts bundled, not fetched.

### Navigation and rendering

| Metric | Target | Ceiling |
|---|---|---|
| Tab switch → first paint | **100 ms** | 200 ms |
| Screen push → skeleton | **1 frame (16 ms)** | 32 ms |
| Screen push → data painted (cached) | **150 ms** | 300 ms |
| Sheet present → interactive | **150 ms** | 250 ms |
| Frame rate, scrolling | **60 fps**, zero frames > 32 ms | ≥ 50 fps |
| List scroll, 500 rows | no blank cells during a fling | — |
| Input latency (search box) | **< 50 ms** | 100 ms |

The push→skeleton budget is met by a structural rule: **the destination header renders from the route params the caller already had** (name, category, place). A push always paints real content in frame 1, never a spinner.

### Network and payloads

| Metric | Target | Ceiling |
|---|---|---|
| API p50 (CDN hit) | 120 ms | 300 ms |
| API p95 (origin) | **400 ms** | 800 ms |
| Composite screen payload, gzipped | **≤ 60 KB p95** | 120 KB |
| List page (25 items), gzipped | ≤ 25 KB | 40 KB |
| Search suggest | ≤ 4 KB | 8 KB |
| Map feature payload | ≤ 80 KB | 150 KB |
| MVT tile | ≤ 60 KB | 120 KB |
| Cold-launch bytes (cached) | **0** | 2 KB (version check) |
| Session bytes, typical 5-min use | ≤ 800 KB | 2 MB |

The last two matter commercially: on a ₹19 daily data pack, an app that spends megabytes browsing gets uninstalled.

### Memory

| State | Target | Ceiling |
|---|---|---|
| Baseline (Home) | 130 MB | 180 MB |
| Entity screens | 180 MB | 250 MB |
| With map | 300 MB | 400 MB |
| With document viewer | 320 MB | 420 MB |
| Peak sustained | — | **< 450 MB** (OOM-kill risk on 3 GB devices above this) |

### Bundle

| Artifact | Target | Ceiling |
|---|---|---|
| Initial JS (Hermes bytecode) | **≤ 3.5 MB** | 4.5 MB |
| Android APK (arm64, per-ABI split) | ≤ 28 MB | 40 MB |
| iOS download | ≤ 35 MB | 50 MB |
| Lazy segments (map / documents / charts / Ask) | not in the initial bundle | — |
| Fonts (3 families, subset) | ≤ 900 KB | 1.2 MB |

### Map

Specified in `.docs/02-architecture/mobile-gis-architecture.md` §9: basemap ≤1.5 s, data layer ≤2.5 s, ≥50 fps pan, ≤400 features, ≤180 MB incremental.

---

## Techniques (and why each is here)

### Lists
`FlashList` for every list over ~20 rows. A `FlatList` of 500 finance rows on the reference device drops frames on a fling; `FlashList`'s recycling holds 60 fps. Requirements: a stable `estimatedItemSize`, memoized row components, no inline closures or object literals in `renderItem`, and `keyExtractor` on a real id. Cursor pagination with prefetch at 70% scroll.

### Rendering discipline
- Selector-based subscriptions (Zustand `useStore(s => s.slice)`) so a scope change does not re-render four tabs.
- View models are **pure selector functions** (`features/*/selectors/`), memoized, unit-tested — heavy derivation never runs inside a component body.
- `React.memo` on row and card components only, where it is measurable; blanket memoization is not a strategy.
- No inline styles: all styles are `StyleSheet` objects or precomputed token lookups.
- `InteractionManager.runAfterInteractions` for non-critical work (analytics flush, cache writes, watchlist diff).

### Money formatting
Formatting a `bigint` to `₹8,00,00,000` on every render for a 500-row list is measurable. Formatted strings are memoized by `(paise, locale, style)` in an LRU inside the `Money` value object.

### Images and documents
There are almost no images — a deliberate advantage. The document viewer renders page-at-a-time via `Range` requests (`.docs/01-product/source-traceability.md`), never a full download to render page 42.

### Code splitting
Expo Router segment-level lazy loading. The map SDK, the PDF renderer, the chart kit, and the Ask feature are absent from the initial bundle; each loads on first navigation with a skeleton. This is the single largest lever on cold start.

### Native
New Architecture (Fabric + TurboModules) and Hermes: lower bridge overhead, faster startup, smaller memory. `enableFreeze` on inactive screens. RAM-bundle/inline-requires enabled.

### Caching
Stale-while-revalidate everywhere (`.docs/02-architecture/data-flow.md` §4): a cached screen paints in ~150 ms while refreshing behind. Persisted query cache means the *second* cold launch is fast even on a dead connection.

### Background work
`InteractionManager`-deferred; nothing periodic except a 5-minute version check; no cellular prefetch; every request cancelled on unmount.

---

## Anti-patterns explicitly avoided

| Avoided | Cost on the reference device |
|---|---|
| React-rendered map markers (one component per feature) | The classic mobile-map killer; symbol layers are used instead |
| A generic chart library | 150–250 KB and unnecessary re-render churn (`adr/007-charting.md`) |
| Inline geometry in entity payloads | Megabyte payloads (`00-document-audit` C5) |
| `FlatList` for long lists | Frame drops on fling |
| Formatting money in render | Measurable in long lists |
| Animated number counters | Jank + unreadable + implies false precision |
| Blur / glassmorphism | Expensive per frame on mid-tier GPUs; also excluded by the design system |
| A global store causing app-wide re-renders | Selector subscriptions instead |
| Offset pagination | Duplicate rows on a live dataset (`00-document-audit` C6) |
| Prefetching adjacent screens on cellular | Spends the user's data pack without consent |
| Bundling all locales' fonts unsubsetted | ~3 MB of Devanagari glyph data |

---

## Measurement

### In production (`.docs/13-observability/observability.md`)
`app_start{cold|warm, ms}` · `screen_tti{screen_id, ms, cache_hit}` · `api_latency{endpoint, ms, status, cache}` · `frame_drops{screen_id, count}` · `memory_warning{screen_id}` · `bundle_load{segment, ms}`. All bucketed, all anonymous, sampled at 10% for timing events. Alert thresholds are set at the **ceiling** column above, and p75 is tracked alongside p50 because the reference device sits nearer p75 than p50 of the installed base.

### In CI
- **Bundle-size check** on every PR: a >5% initial-bundle increase requires an explicit justification in the PR.
- **Startup benchmark** on a real reference-class device in the device farm, on merge to main; a >10% regression fails.
- **Render benchmarks** for `MoneyTrail`, `RecordList` (500 rows), `ProjectCard`, and the map screen.
- **Payload-size assertions** against contract fixtures — a composite endpoint exceeding its budget fails the contract test.
- A **performance regression is a release blocker**, treated exactly like a failing correctness test.

### Manually, each release
Cold start ×10 on the reference device (median reported) · full journey J1→J3→J10 profiled with the Hermes sampling profiler · memory over a 10-minute session including map and document viewer · a 3G-throttled run of every core journey.

---

## Scaling checkpoints

`.docs/15-scalability/scalability-plan.md` grows this from ~10³ admin units to ~10⁶ and from ~10⁶ fact rows to ~10¹⁰. Performance work is scheduled against those phases, not deferred indefinitely:

| Phase | Pressure | Planned response |
|---|---|---|
| 1 — MH roads | Baseline | Budgets above |
| 2–3 — MH ministries/districts | More domains, deeper hierarchy | Domain-section registry (already in the architecture); no new screens |
| 4 — MH villages | ~10⁵ units; sparse data | Hierarchy list virtualization; coverage-first rendering at local-body level |
| 5 — India roads | Multi-state tiles | Per-state tile packs; zoom ladder already caps national feature counts |
| 6–8 — India all | ~10⁶ units, ~10¹⁰ rows | Re-validate list/search/map budgets on the then-current reference device; server-side aggregation is already the rule, so client work is bounded |

The architectural properties that make this survivable are already in place: the client never computes an aggregate, never loads geometry inline, never renders more than 400 map features, and pages every list.
