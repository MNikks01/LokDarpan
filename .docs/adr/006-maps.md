# ADR-006 — Maps: MapLibre React Native, self-hosted vector tiles

**Status:** Accepted · 2026-08-21 · **Review gate: Phase 5 (India roads)** · **Deferred 2026-08-24** — mobile delivery postponed until after web launch (see [`.docs/decisions/web-first-pivot.md`](../decisions/web-first-pivot.md)). This decision stands for when the mobile client is built; revalidate the toolchain at that point.

## Context

Maps are core (`.docs/03-domain/gis-intelligence.md`, `.docs/10-mobile/gis-mobile-architecture.md`). Requirements:

- Consume the **MVT tile pyramid the GIS service already builds** (`.docs/03-domain/gis-intelligence.md`) — this is decided infrastructure, not a choice.
- **Data-driven choropleths** (fill colour from a feature property) — the precomputed per-unit metric is baked into the tile.
- Clustering, offline tile packs, boundary polygons at national scale, ≥50 fps on a 4 GB Android phone.
- `.docs/15-scalability/scalability-plan.md` projects growth to ~10⁶ admin units and a potential ~10⁶ concurrent users.
- `.docs/02-architecture/tech-stack.md`: the stack must be **cheap to run, open-source, and auditable**. `.docs/01-product/prd.md`: grant-funded, no revenue model that could compromise neutrality.

## Decision

**`@maplibre/maplibre-react-native`** with **self-hosted vector tiles and a self-hosted, bundled basemap style**. All SDK usage is confined to `platform/maps/MapAdapter`; no feature imports the map library directly.

## Alternatives considered

**`react-native-maps` (Google Maps / Apple Maps).** Rejected on capability, not preference: it cannot consume MVT tile pyramids, and it cannot do data-driven choropleth fills. Both are core requirements. Rendering thousands of React-component markers is also the classic mobile-map performance failure. Google Maps additionally carries per-load pricing at national scale.

**`@rnmapbox/maps` (Mapbox GL Native).** The strongest technical option: most mature RN map SDK, excellent New Architecture support, first-class offline region packs, battle-tested. **Rejected primarily on cost and independence.** Mapbox prices by monthly active users; at `.docs/15-scalability/scalability-plan.md`'s Phase-8 scale that is a recurring bill a grant-funded public-interest platform cannot underwrite, and a dependency whose pricing could change would sit on the product's core surface. Since we self-host the tiles anyway (`.docs/03-domain/gis-intelligence.md`), Mapbox's real value-add — its basemap and its data — is not what we would be paying for. There is also a fit argument: a platform whose credibility rests on auditability should not have a proprietary black box rendering its primary public surface.

**Leaflet/MapLibre GL JS in a WebView.** Rejected: poor gesture fidelity, high memory, weak offline story, and unacceptable performance on the reference device.

**Custom SVG/Skia renderer.** Rejected: we would rebuild tile loading, projection, culling, labelling, and gesture handling — months of work to reach a worse result.

## Honest assessment of the risk

**`@maplibre/maplibre-react-native` is less mature than `@rnmapbox/maps`.** It is a community fork of the Mapbox RN SDK, with a smaller maintainer base, slower New Architecture adoption historically, and thinner documentation. This is a real risk, not a footnote.

Mitigations, all of which are commitments rather than intentions:

1. **A spike in week 1 of Phase 1** — before any map UI is written — validating: New Architecture compatibility, offline pack APIs, symbol-layer clustering, data-driven styling, and performance on a physical reference device. If the spike fails, this ADR is superseded before it has cost anything.
2. **`MapAdapter` boundary.** One module imports the SDK. Swapping to `@rnmapbox/maps` is a contained change, not a rewrite.
3. **MapLibre-compatible style spec.** The style JSON works with both SDKs, so a switch does not invalidate the cartography.
4. **Lazy route segment.** The map is not in the initial bundle; a map problem never blocks the rest of the app.
5. **Formal review gate at Phase 5** (India roads), when scale and cost assumptions are re-examined with real numbers.

## Basemap

Self-hosted, from an open dataset (OpenMapTiles schema; **Protomaps/PMTiles is the preferred delivery** — a single archive on the CDN, no tile server, and it works offline). Two bundled style variants (light/dark) matching the theme. The style ships in the binary rather than being fetched, so the map renders offline and cannot be altered in transit.

## Trade-offs

- Less mature SDK (mitigated above).
- We operate the tile infrastructure — but `.docs/03-domain/gis-intelligence.md` already commits to generating and serving the MVT pyramid, so this is not new work.
- Basemap cartographic quality is below Google/Mapbox. Acceptable and arguably desirable: a deliberately muted basemap keeps all colour for the data layers (`.docs/01-product/design-system.md`).

## Consequences

- **No per-MAU cost**, at any scale. The map surface cannot become financially unsustainable as the platform reaches national coverage.
- Fully open-source rendering path, consistent with `.docs/02-architecture/tech-stack.md`'s auditability commitment.
- Offline packs are a first-class capability (`.docs/10-mobile/offline-strategy.md`).
- Server-side clustering and precomputed metrics mean the client never computes a map value — so a map and a table can never disagree (`.docs/03-domain/gis-intelligence.md`).
