# 27 — What LokDarpan takes from God's Eye View

**Status:** Accepted as a plan · 2026-09-17 · Implementation tracked below, one ADR per decision as each lands

## Why this document exists

[God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) (GEV, MIT, commit `0d41b6b`) is an
open-source real-time globe — live aircraft, ships, satellites and CCTV on CesiumJS. It was reviewed
for engineering ideas LokDarpan's map and data pipeline could use. It is a **reference, not a
direction**: its renderer, data and presentation are rejected, and eight of its mechanisms are worth
reimplementing.

The review read the code of both repositories rather than their documentation, and surfaced four
facts about LokDarpan that reorder the work. They are recorded here because each is a place where
the docs and the implementation disagree.

## What the review found in LokDarpan

1. **No explorer API carries a real `datasetVersion`.** All 11 explorer, geo, tender, search and
   document-list route handlers return `datasetVersion: 0`, although
   `admin_unit_boundary.dataset_version_id` exists. `meta.asOf` in `apps/web/src/server/respond.ts`
   is the time of the response, not the vintage of the data. Every route is `force-dynamic`; the
   cache-tag ISR described in `.docs/02-architecture/web-architecture.md` is not implemented.
2. **There is no point layer.** The explorer draws boundaries and a tender choropleth. The
   400-feature cap exists only in `.docs/wireframes/04-explore-map.md`. ADR-022's works layer and
   20 px hit rule are no longer in `MapCanvas.tsx`.
3. **Ingestion downloads are unbounded.** CAG, LGD and BEAMS read whole bodies with
   `arrayBuffer()`, GePNIC and Overpass with `text()`. None has a byte cap, and only the OCR client
   has a timeout. CAG downloads a whole body before checking that it is a PDF.
4. **Architecture rules are prose.** Nothing enforces import direction, and no web component uses
   the `ServerText` brand from `packages/neutrality`.

## What is taken, and what is not

| Mechanism from GEV                                                     | Verdict     | Problem it solves here                                                     |
| ---------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| Byte-capped streaming reads, timeouts, retry ladder, typed failures    | Reimplement | Finding 3                                                                  |
| Fetched time, contact time and completeness kept apart                 | Adapt       | Three partial state vocabularies become one; missing never renders as zero |
| Label arbitration: spatial grid, incumbency, lifetime, cooldown, fades | Reimplement | O(n·k) per-frame placement, flicker, anchors outside polygons              |
| Import-direction checks with negative fixtures                         | Adapt       | Finding 4                                                                  |
| Single-flight coalescing that evicts only the exact promise            | Adapt       | Duplicate and version-mixed client reads                                   |
| Layer module contract                                                  | Adapt       | Map layer logic spread across four files                                   |
| LOD budget with hysteresis                                             | Adapt       | Future point layers — aggregate instead of sample                          |
| Performance method: counts recorded, cold vs warm, repeated runs       | Borrow      | `/explore` is 409 kB against a 400 KB target, with no harness              |

**Never taken:** CesiumJS, Google Photorealistic 3D Tiles, Esri imagery, every live-tracking layer,
CCTV, licence-plate readers, military installations, sensor shaders and HUD styling, the voice
agent, motion interpolation, per-IP rate limiting, and proximity-based association between records.
GEV's value is watching; LokDarpan's is citing.

### The rule that governs every map change

**What is drawn is not what is ranked.** Choosing which features or labels fit on screen may use
only neutral inputs: id, geometry kind, administrative level, zoom, whether it is in view, explicit
selection, focus, incumbency and area. It may never use value, variance, Verification Priority,
observation counts, contractor identity, or whether a place has a name. When features exceed the
budget, the map aggregates by administrative unit and says so. It never picks a subset.

## Implementation plan

Order matters: phases 1 and 2 come first because later phases key on what they produce.

| Phase | Change                                                                                               | ADR      | Status                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| 0     | This document; ADR-022 addendum for the drift in finding 2                                           | 022 add. | Done                                                                             |
| 1     | `fetchWithLimits` in `services/ingestion/src/net/`, used by every collector                          | 052      | Limits done; retries, conditional GET, disk streaming, redirect policy to follow |
| 2     | Real `datasetVersion` on every explorer route; `asOf` is when that version was opened                | 053      | Done — see ADR-053 for the open question on unit views                           |
| 3     | Label arbitration; `label_point` and `area_m2` stored per boundary                                   | 057      | Done                                                                             |
| 4     | `DataState` model and reviewed panel wording (done); `SourceDescriptor` built on `source-licence.ts` | 054, 055 | Source descriptors next                                                          |
| 5     | One level endpoint; browser resource cache keyed by version                                          | —        | Planned                                                                          |
| 6     | Layer registry and binder                                                                            | 058      | Planned                                                                          |
| 7     | URL carries layers, filters, selection and an optional version pin                                   | 061      | Planned                                                                          |
| 8     | Performance harness and enforced budgets                                                             | 062      | Planned                                                                          |
| 9     | Records layers with an aggregate-first budget — waits on a licensed coordinate source                | 056, 060 | Blocked                                                                          |
| —     | Import-direction rules A–F, after phase 2                                                            | 059      | Planned                                                                          |

Small, independent fixes that can land at any point: stop `MapCanvas` reframing the camera when its
container resizes; load MapLibre after hydration; update the hover tooltip at most once per frame.

### Import rules to enforce (ADR-059)

- **A.** Client code performs no financial arithmetic.
- **B.** Reader-facing sentences are not written inside components.
- **C.** Rendering code never calls external providers.
- **D.** Source adapters never depend on UI modules.
- **E.** Domain and contracts never depend on presentation or I/O.
- **F.** Map code consumes view models from `@lokdarpan/contracts`, never repository rows.

## Open items

- **GePNIC and Overpass response sizes are unmeasured.** The local raw store holds CAG, BEAMS and
  LGD only (largest: CAG 28.8 MB, BEAMS 1.0 MB, LGD 135 KB), and the ledger was not reachable from
  the review environment. Their caps start as generous ceilings and are revisited from the sizes
  the new fetch layer logs.
- **Indic text shaping in MapLibre** — resolved: 5.24 cannot shape U+0900–U+0DFF, so labels stay
  in the DOM (ADR-057).
- **Unit views and the single-version rule.** `UnitService` refuses a payload whose rows come from
  more than one load, and geography is loaded per district, so `/api/v1/units` fails as soon as
  units span loads. Decide whether unit views keep strict row versions or report the watermark
  (ADR-053).
- **Pinned links cannot reconstruct old boundaries.** `admin_unit_boundary` is keyed by unit, so an
  old geometry is overwritten. Phase 7 either versions boundary rows or says so on the page.
