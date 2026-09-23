# ADR-062 · Performance is measured, and bytes are budgeted

**Status:** Accepted · **Date:** 2026-09-23 · **Implements** phase 8 of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md) · **Enforces** the budgets in [`../02-architecture/web-architecture.md`](../02-architecture/web-architecture.md)

## Context

`web-architecture.md` sets budgets for the map page: 400 KB of initial JavaScript, a 600 KB ceiling,
LCP 1.2 s, INP 150 ms. Nothing measured any of them. ADR-022 recorded `/explore` at 409 kB, and the
build still reported 414 kB, over target, with nothing to say so. God's Eye View measures with
harnesses that:

- record live counts beside every timing;
- keep cold and warm apart;
- repeat runs;
- compare relatively.

## Decision

**Budgets live in one module** (`apps/web/perf/budgets.ts`). Each is marked by where it comes from:

- `documented`: from `web-architecture.md`;
- `proposal`: from the adoption plan, to be ratified against baselines like the ones below.

A budget set before measurement is a guess with a decimal point.

**Bytes gate CI; runtime warns.**

- **`perf:bytes`** reads Next's build manifests, gzips the route's initial scripts, and fails over the
  ceiling. It is deterministic and needs no server or database. It runs as CI gate G7.
- **`perf:runtime`** drives a production server with Playwright:
  - two profiles: desktop at 1440 × 900; mobile at 412 × 915 with 4× CPU slowdown, 9 Mbps down and
    150 ms round trip;
  - 9 cold runs with the cache disabled, 7 warm, and 7 unit selections in a state whose districts have
    children;
  - medians and p75s, the GPU string and live counts;
  - JSON to `perf/results/` (gitignored).

  It exits 0 unless `--strict` is passed, because runtime numbers vary with the machine.

**The page marks itself** (`src/lib/perf-marks.ts`):

- `explorer:hydrated`;
- `map:init`;
- `map:load`;
- `map:boundaries-drawn`: the first frame rendered after the level's source finished loading.

The first version of the last mark used MapLibre's `idle`, which also waits for the camera's flight
and every base-map tile. It reported 2.3 s, 1.5 s of which was not boundaries. The marks stay on in
production, so a reader's own devtools show the same timeline.

**MapLibre loads after hydration.** It was 266 KB of the 405 KB. `MapCanvas` is now a `next/dynamic`
import with no server rendering, so the rail hydrates without it. The download is triggered when the
map first renders. Starting it earlier, when the module evaluates, was measured and not kept (below).

## Consequences

Measured locally against the production build, Madhya Pradesh cold/warm and Maharashtra selections.
Headless Chromium on SwiftShader, so GPU-bound numbers are pessimistic. Medians:

| Metric                              | Before (static import) | Shipped (load at render) | Not kept (load at module start) |
| ----------------------------------- | ---------------------- | ------------------------ | ------------------------------- |
| Initial JS, gzip                    | 404.9 KB (over)        | **120.5 KB**             | 120.5 KB                        |
| Rail usable, mobile                 | 847 ms                 | **725 ms**               | 744 ms                          |
| Rail usable, desktop                | 364 ms                 | 349 ms                   | 348 ms                          |
| `map:load` cold, mobile             | 2,227 ms               | 2,718 ms                 | 2,403 ms                        |
| `map:load` cold, desktop            | 843 ms                 | 910 ms                   | 1,415 ms                        |
| First boundaries after load, mobile | 710 ms                 | 732 ms                   | 779 ms                          |
| Select → boundaries drawn, mobile   | 587 ms                 | 599 ms                   | 614 ms                          |

**The trade is deliberate.** The rail is the path to every place and needs no map, and it now answers
first. The map arrives about half a second later on a throttled phone, still inside its 5 s target.
Starting the download when the module first runs recovered 300 ms on mobile but cost 500 ms on
desktop, where evaluating the renderer competed with hydration. That is one nine-run series each,
recorded here rather than acted on.

**Over budget, and not fixed here:**

- **The level endpoint takes about 580 ms against a 300 ms target**, for Madhya Pradesh's 55 districts
  and 449 units. The work is `ST_SimplifyPreserveTopology` per request. The plan's answer is
  generalising at ETL time and caching by version.
- **First boundaries draw about 800 ms after `map:load` against 500 ms.** The level is re-sent once
  the tender counts arrive, so the mark waits for the shaded version.

Every other measured budget is within target. HTML is 8.7 KB and the level payload 80.9 KB gzip.

**Not in this change:**

- a nightly CI job for `perf:runtime`, which needs a seeded ledger in CI;
- the pan frame-time and label-layout budgets;
- the heap check after ten drill-downs.

## Addendum · 2026-09-23

Both over-budget items were taken up in [ADR-065](./065-a-level-is-drawn-from-outlines-made-when-they-were-loaded.md):

- **The level endpoint is fixed:** 580 → 62 ms, by simplifying outlines once when they are loaded.
- **The first draw is not:** ~800 ms after `map:load`. Re-sending the level for tender counts turned
  out not to be the cause. The rest is worker tiling and software rendering, to be measured on a real
  GPU before anything else changes.
