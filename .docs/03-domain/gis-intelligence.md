# 20 — GIS Intelligence

Geography is a first-class dimension of the platform: every administrative unit has a boundary, every asset has a location, and every rupee can be rendered on a map. GIS turns the ledger into something a citizen can *see* — "what was built near me, and does its cost look normal?" This document covers the spatial data model, map layers, tiling/serving, heat/expenditure maps, and the asset-GIS architecture for each infrastructure type.

**Stack:** PostgreSQL + **PostGIS** (spatial store & queries), vector tiles (Mapbox Vector Tiles / MVT), Mapbox GL on the frontend, with GeoJSON for small/detail queries ([12](../02-architecture/tech-stack.md)).

## Spatial data model

All geometries are stored in **EPSG:4326 (WGS84)**; area/length computations use a projected CRS (e.g. India-appropriate UTM zones / EPSG:7755) via `ST_Transform` to get metres.

| Layer | Geometry | Source |
|---|---|---|
| Country / State / Division / District / Taluka / Block / Village / Ward boundaries | `MultiPolygon` | Survey of India / LGD / Census / state GIS (e.g. MRSAC) |
| Survey number (parcel) | `Polygon` | State land records / GIS |
| Roads / highways | `MultiLineString` | PWD / MoRTH / NHAI / MRSAC |
| Railways / metro | `MultiLineString` | Railways / metro authorities |
| Pipelines / sewage / gas | `MultiLineString` | Water/utility departments |
| Bridges / tunnels / flyovers | `Point` or `LineString` | PWD / MoRTH |
| Hospitals / schools / anganwadis / colleges | `Point` | Health / Education / WCD dept registries |
| Buildings / public assets | `Point` / `Polygon` | Asset registers (e.g. MARS) |

Every geometry row carries the same **provenance + confidence + version** columns as the rest of the ledger ([04](../05-data-model/database-design.md)); geo-coordinates from OCR/geocoding carry a positional confidence and are labeled approximate.

### PostGIS essentials

```sql
-- boundaries
ALTER TABLE district ADD COLUMN geom GEOMETRY(MultiPolygon, 4326);
CREATE INDEX idx_district_geom ON district USING GIST (geom);

-- assets (examples; see doc 04 for full tables)
CREATE INDEX idx_road_geom   ON road   USING GIST (geom);
CREATE INDEX idx_bridge_geom ON bridge USING GIST (geom);

-- point-in-polygon: which district is this asset in?
SELECT d.id FROM district d
WHERE ST_Contains(d.geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326));

-- length in metres (projected)
SELECT ST_Length(ST_Transform(geom, 7755)) AS length_m FROM road WHERE id = :id;
```

`ST_Contains` / `ST_Intersects` are how assets are **spatially assigned** to admin units when a source gives coordinates but not a clean code — a key reconciliation tool ([19](./administrative-hierarchy.md)).

## Map layers

Rendered as toggleable layers over a neutral base map:

1. **Administrative boundaries** — switch level (state→ward); selected unit highlighted; click drills into the matching dashboard ([09](../01-product/dashboard-design-legacy.md)).
2. **Choropleth (thematic fill)** — units shaded by a chosen neutral metric: utilization %, per-capita expenditure, project count, median cost/km, verification-priority band.
3. **Asset layers** — roads (lines), bridges/tunnels/flyovers, hospitals, schools, railways, pipelines, etc., each independently toggleable; clustered at low zoom.
4. **Heat map** — density/intensity of expenditure or asset count.
5. **Expenditure map** — proportional symbols or graduated fills tied to ₹ spent per unit/asset.

Every layer's legend states **what the color/size encodes is a measurement, not a judgment** ([15](../17-legal/legal-ethical-rules.md)).

## Serving strategy (performance at national scale)

- **Vector tiles (MVT):** boundaries and dense asset layers are pre-generated into tile pyramids (e.g. via `ST_AsMVT`) keyed by `dataset_version`, cached at the CDN. National-scale polygons are simplified per zoom (`ST_SimplifyPreserveTopology`) so low zoom stays light.
- **GeoJSON on demand:** detail views (one project, one ward) fetch small GeoJSON directly from the API.
- **Aggregation by zoom:** at country/state zoom, show unit-level aggregates; only load individual assets at high zoom / within viewport (bbox queries).
- **Precomputed choropleth values:** metric-per-unit is materialized by the analytics cron so the map reads cached values, never computes on request.

```text
PostGIS (geom + metrics)
   → tile builder (ST_AsMVT, per zoom, per dataset_version)  → object store / CDN  → Mapbox GL
   → GeoJSON API (bbox + detail)                              → Redis cache        → Mapbox GL
```

## Heat maps & expenditure maps (definitions)

```text
Choropleth value(unit)      = chosen metric (e.g. utilized_inr / population)   [per-capita expenditure]
Expenditure symbol size     ∝ Σ utilized_inr of assets in unit
Heat intensity(point)       = kernel density of assets OR of ₹ spent, within radius r
Per-capita expenditure      = Σ utilized_inr(unit) / population(unit)
Asset density               = count(assets in unit) / area_km²(unit)
```

All map metrics are the same figures shown in tables — one source of truth — so a map and a dashboard never disagree.

## Asset-GIS architecture by category

Each infrastructure type gets a spatial representation and category-specific attributes; the **domain-intelligence pattern** (like roads in [08](./road-infrastructure-intelligence.md)) attaches expected-cost/quantity models per type.

**Transportation** — highways/roads (`MultiLineString`, length/width/surface), bridges/tunnels/flyovers (point/line, span/type), metro/railways (`MultiLineString`, stations as points), airports/ports (polygon/point).

**Utilities** — electricity (lines + substations), water & sewage & gas (`MultiLineString` networks + nodes), internet/OFC (lines). Networks support connectivity/coverage analysis.

**Social infrastructure** — schools, hospitals, colleges, anganwadis (points with capacity attributes: classrooms, beds, seats), parks/sports complexes (polygons). These feed cost-per-school / cost-per-hospital-bed comparisons ([06](../07-analytics/analytics-engine.md)).

## Spatial analytics enabled

- **Proximity / access:** distance from villages to nearest hospital/school (`ST_Distance`, nearest-neighbour) — a coverage statistic, never a judgment.
- **Overlap/dedup:** detect the same asset reported by two sources at nearly the same location (`ST_DWithin`) → dedup candidate ([03](../04-data-engineering/data-collection-architecture.md)).
- **Containment:** auto-assign assets to admin units when only coordinates are given.
- **Corridor analysis:** assets/expenditure along a highway buffer (`ST_Buffer` + `ST_Intersects`).
- **Per-unit rollups:** spatially aggregate expenditure/assets to any hierarchy level for choropleths.

## Data quality & honesty on the map

- Coordinates from geocoding/OCR are marked **approximate** with a positional-confidence indicator; exact vs approximate assets are visually distinguished.
- Units with **missing geometry** are listed explicitly (not silently dropped) so the map's coverage gaps are visible.
- Boundary changes over time are versioned; the map lets the user pin a `dataset_version` so historical expenditure renders on the geography of that period.

GIS is a presentation and reconciliation layer over the same source-linked ledger — it never introduces facts that aren't traceable, and it inherits every neutrality rule in [15](../17-legal/legal-ethical-rules.md).
