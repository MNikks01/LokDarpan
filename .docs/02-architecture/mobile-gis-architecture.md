# 07 — GIS / Map Experience (Mobile)

The map is how a citizen answers _"what was built near me, and does its cost look normal?"_ It is also the fastest way to make a phone unusable. This document defines the mobile GIS architecture so that it does neither.

**Inherited unchanged from `.docs/03-domain/gis-intelligence.md`:** PostGIS as the spatial store, EPSG:4326 geometries, the MVT tile pyramid keyed by `datasetVersion`, precomputed per-unit choropleth metrics, and the honesty rules (approximate coordinates marked, missing geometry listed, legend states that colour encodes a measurement).

---

## 1 · The scale problem, stated plainly

`.docs/15-scalability/scalability-plan.md` Phase 8 targets ~10⁶ admin units and ~10⁷ assets. A district can contain thousands of road segments. The reference device is a 4 GB Android phone. Three constraints follow:

1. Geometry **never** travels as GeoJSON in an entity payload (`00-document-audit` C5 — `.docs/11-api/api-documentation.md`'s district payload with an inline `MultiPolygon` would be megabytes).
2. The client **never** computes a metric, a cluster, or a simplification. All three are precomputed server-side and baked into tile properties, so a map and a table can never disagree (`.docs/03-domain/gis-intelligence.md`).
3. There is a **hard cap on rendered features**, and exceeding it is announced, never silent.

---

## 2 · Rendering stack

```text
PostGIS  →  tile builder (ST_AsMVT, per zoom, per datasetVersion, ST_SimplifyPreserveTopology)
         →  object store  →  CDN  →  device HTTP cache  →  MapLibre GL Native
                                  ↘  offline pack (explicit download)
GeoJSON (small, detail only: one project's geometry)  →  API  →  MapLibre source
```

Map SDK: **MapLibre React Native**, self-hosted vector tiles, self-hosted basemap style. Rationale, trade-offs, and the maturity mitigation are in `adr/006-maps.md`. All SDK usage is confined to `platform/maps/MapAdapter` — no feature imports the map library directly, so the vendor is replaceable without touching a screen.

**Basemap.** A muted, self-hosted style (OpenMapTiles schema): roads and labels legible, everything else desaturated so the data layers carry all the colour. Two variants (light/dark) matching the theme. No third-party basemap tile service — a public-interest platform cannot make its core surface depend on a per-view commercial meter, and `.docs/02-architecture/tech-stack.md` requires the stack be cheap to run and auditable.

---

## 3 · Zoom ladder

The single most important design decision for map performance: **what is even queryable is a function of zoom.**

| Zoom  | Boundary layer       | Data shown                                   | Interaction                | Query                             |
| ----- | -------------------- | -------------------------------------------- | -------------------------- | --------------------------------- |
| 3–5   | State                | State choropleth                             | Tap → S-23 (state)         | none — tiles only                 |
| 6–7   | District             | District choropleth                          | Tap → S-23 (district)      | none — tiles only                 |
| 8–10  | Taluka / block       | Taluka choropleth **+ server-side clusters** | Tap cluster → zoom or S-20 | cluster tiles                     |
| 11–13 | Local body / village | Individual **projects and assets**           | Tap → S-19 preview         | `GET /mobile/map/features?bbox&z` |
| 14–18 | Ward                 | Assets + road geometry + parcel context      | Tap → S-19 → entity        | same, tighter bbox                |

**Individual assets do not exist below z11.** A user at national zoom sees choropleths, not a million pins — which is both the only way it performs and the more truthful representation (an individual ₹40 lakh road is not meaningful at national scale).

---

## 4 · Clustering and the feature cap

Clustering is **server-side**, computed into the tile pyramid, for three reasons: it is deterministic (the same view produces the same clusters for every user), it costs the device nothing, and the cluster's aggregate figures (count, total utilized) are computed by the analytics tier — so a cluster label is a source-linked figure, not a client-side sum.

```text
Map (z<11)  →  Cluster (count + Σ utilized)  →  ▸ S-20 Cluster contents (cursor-paged list)
                                              →  ▸ Project preview (S-19)
                                              →  ▸ Project detail (S-27)
```

**Hard cap: 400 rendered features per viewport.** On exceeding it:

```text
┌──────────────────────────────────────────────┐
│ Showing 400 of 3,182 projects in this view.  │
│ Zoom in, or filter, to see the rest.    ▸    │
└──────────────────────────────────────────────┘
```

Silent truncation is forbidden. A map that shows 400 of 3,182 projects without saying so misrepresents public spending, which is a `.docs/17-legal/legal-ethical-rules.md` violation, not a performance detail.

---

## 5 · Map ⇄ List: co-equal, not a fallback

The toggle in S-18 is a first-class control, and the **list is the canonical accessible equivalent** of the map (`.docs/01-product/accessibility.md`): a map is not meaningfully usable with a screen reader, and MapLibre is the heaviest thing in the app on a low-end device.

The list shows the **same query, same filters, same viewport** — sorted by distance when location is available, otherwise by utilized amount. Toggling never re-queries; both views render from one feature payload.

`Settings → Accessibility → Prefer list over map` makes List the default landing state for Explore, permanently.

---

## 6 · Layers and the legend

| Layer                          | Geometry   | Default             | Source                                    |
| ------------------------------ | ---------- | ------------------- | ----------------------------------------- |
| Administrative boundaries      | polygon    | on                  | MVT                                       |
| Choropleth fill                | polygon    | on                  | MVT feature property (precomputed metric) |
| Roads                          | line       | on (z≥11)           | MVT                                       |
| Projects / assets              | point      | on (z≥11)           | MVT + feature API                         |
| Facilities (school, hospital…) | point      | off                 | MVT                                       |
| Utility networks               | line       | off                 | MVT                                       |
| This project's geometry        | line/point | context-only (S-39) | GeoJSON, small                            |

Choropleth metrics (from `.docs/03-domain/gis-intelligence.md`): utilization %, per-capita expenditure, project count, median cost/km, verification-priority band distribution.

**The legend is mandatory and always visible when a choropleth is on**, and it states, in words, on the map: _"Colour shows <metric>. It is a measurement, not an assessment."_ (`.docs/17-legal/legal-ethical-rules.md`, `.docs/03-domain/gis-intelligence.md`). It also names the FY and the `datasetVersion`.

**No heat map in Phase 1.** `.docs/03-domain/gis-intelligence.md` defines kernel-density heat maps; on a phone, a red-hot blob over a district is the single most accusatory visual the product could produce, and its meaning (density of ₹ or of assets) is not readable without a legend most users will not open. Deferred, and if it ships it uses the sequential teal ramp, never a thermal palette.

---

## 7 · Location

```text
Permission:  WhenInUse only.  Never Always.  Never background location.
Accuracy:    Balanced (~100 m) — sufficient for "near me", cheaper on battery,
             and less precise about the user than the alternative.
Storage:     Coordinates are held in memory for the request only.
             Never written to disk. Never sent to analytics.
             Server-side, coordinates are used to resolve a bbox and are
             not logged with any identifier (.docs/12-security/security.md, .docs/12-security/mobile-security.md).
Denied:      S-05 "Choose your area" is a permanent, equally prominent alternative.
             A denied permission never blocks any feature except the "locate me" button.
```

The primer (S-04) states the retention rule before the OS dialog appears. For an RTI activist standing outside a panchayat office, "we do not store where you are" is a meaningful commitment, not boilerplate.

---

## 8 · Offline maps

Two tiers:

| Tier              | What                                                     | Trigger           | Size                                                   |
| ----------------- | -------------------------------------------------------- | ----------------- | ------------------------------------------------------ |
| **Implicit**      | Tiles the OS/SDK cached while panning                    | automatic         | LRU, 60 MB cap                                         |
| **Explicit pack** | A district's tiles z6–13 + its unit tree + project index | user action, S-64 | stated before download; typically 8–40 MB per district |

Un-cached area offline renders as a **neutral hatch with a label** ("Map data not downloaded for this area"), never as a blank white void that reads as "there is nothing here." Packs are pinned to a `datasetVersion` and refreshed by delta (`?since=`), not re-downloaded.

---

## 9 · Performance budgets (reference device: Android 11, 4 GB, Snapdragon 6-series)

| Metric                        | Budget                                                         |
| ----------------------------- | -------------------------------------------------------------- |
| Basemap first paint           | ≤ 1.5 s from Explore mount                                     |
| Data layer paint              | ≤ 2.5 s                                                        |
| Pan/zoom                      | ≥ 50 fps sustained; no frame >32 ms during a fling             |
| Camera-settle → feature query | 300 ms debounce, previous request aborted                      |
| Features rendered             | ≤ 400 (hard)                                                   |
| Map memory                    | ≤ 180 MB incremental over the app baseline                     |
| Tile cache                    | 60 MB implicit; packs unbounded but user-visible and deletable |

Mitigations: the map screen is a **lazy route segment** (the SDK is not in the initial bundle); the map instance is destroyed on tab blur after 60 s; symbol layers are used rather than React-rendered markers (a React marker per feature is the classic mobile-map performance failure); annotations are capped; the style is a static bundled JSON, not fetched.

---

## 10 · Honesty on the map (inherited from `.docs/03-domain/gis-intelligence.md`, made concrete)

- **Approximate coordinates** — assets geocoded or OCR-derived render with a hollow marker and a "approximate location" note in the preview. Exact and approximate must be visually distinguishable.
- **Missing geometry** — units and projects with no geometry are _not silently dropped_. The map surface shows a persistent count: _"18 projects in this view have no published location."_ → tap opens them as a list. This is the spatial equivalent of a missing-data warning and it matters: a map that quietly omits unmapped projects understates spending in exactly the places with the weakest publication.
- **Version pinning** — the map always renders one `datasetVersion`; tiles and feature data can never be from two different versions on the same screen.
