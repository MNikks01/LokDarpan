# GIS Sources

> Geometry for boundaries and assets (`docs/20`).
>
> Verified 21 August 2026. Every URL fetched; none written from memory.

| Source | URL | Status | Relevance | Page title (as fetched) |
|---|---|---|---|---|
| **Bhuvan — Indian Geo-Platform of ISRO** | `https://bhuvan.nrsc.gov.in/` | ✅ VERIFIED | CRITICAL | Bhuvan-Indian Geoportal of ISRO |
| **Maharashtra Remote Sensing Application Centre (MRSAC)** | `https://mrsac.gov.in` | ✅ VERIFIED | CRITICAL | Home Maharashtra Remote Sensing Application Centre |
| **Bharat Maps (NIC national basemap)** | `https://bharatmaps.gov.in/` | ✅ VERIFIED | HIGH | Bharat Maps |
| **National Remote Sensing Centre (NRSC)** | `https://www.nrsc.gov.in/` | ✅ VERIFIED | HIGH | NRSC | NRSC Website |

## What was found

| Source | Role | Status |
|---|---|---|
| **Bhuvan** (NRSC/ISRO) | National geoportal | ✅ verified |
| **Bharat Maps** (NIC) | National multi-layer basemap | ✅ verified |
| NRSC | Satellite/geospatial datasets | ✅ verified |
| **MRSAC** | Maharashtra state GIS — named in `docs/20` | ✅ verified |

## What was NOT determined

**No service endpoint was enumerated for any GIS source.** §15 asks specifically for WMS / WMTS / WFS / ArcGIS / GeoJSON / shapefile availability. None was tested.

This matters directly for `.docs/07-gis-mobile-architecture.md`, which assumes the platform generates its own MVT tile pyramid from PostGIS. That design is sound **provided boundary and road geometry can actually be obtained**. Confirming that is a priority:

- Administrative boundaries at state → ward level
- Road centrelines by class
- Licensing terms for each

**Boundary geometry is not in LGD** — LGD gives codes and hierarchy, not shapes. The two must be joined, and the join key (LGD code present in the geometry attributes?) is **unverified**.

## Cadastral data

§15 mentions cadastral/land-parcel data "where legally/publicly available". Land records are state subjects with varying access rules and frequently contain personal information. `docs/15` forbids re-identification and requires PII minimisation. **Recommend excluding cadastral data from scope until a specific, legally-reviewed need exists.**
