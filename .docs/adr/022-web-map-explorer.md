# ADR-022 — The web map explorer: MapLibre GL JS, geometry fetched at setup, state in the query string

**Status:** Accepted · 2026-08-28 · Applies `adr/006` to the web client; does not revisit its rejected alternatives

## Context

`apps/web` needed its first genuinely interactive surface: a map-first explorer that drills India → state → district → local body → department → work, and opens the full record chain behind a single road (contract, procurement, officers named in the record, timeline, documents).

`adr/006` already chose MapLibre for mobile, on grounds — self-hosted tiles, no per-load pricing, no proprietary renderer on the product's primary public surface — that are about the _project_, not about React Native. Those grounds carry over unchanged, so the renderer was not reopened. Three decisions were genuinely open, and this ADR records them.

## Decision 1 — MapLibre GL JS, pinned to the v5 line

**`maplibre-gl@5`, not `@6`.** The pin is deliberate and load-bearing.

v6 was tried first and **fails silently under the Next.js webpack build**: its worker is never constructed, so GeoJSON sources never finish loading, `load` never fires, and no `error` event is emitted. The result is a blank map with an empty console — the worst available failure mode for this product, because a reader cannot distinguish "the renderer is broken" from "this area has no records". Downgrading to v5 resolved it completely.

Two consequences of that debugging are permanent code, not scaffolding:

- `MapCanvas` attaches an `error` handler and **surfaces renderer failures to the reader**, rather than letting the map fail blank.
- The wait for `load` is **bounded**. An unbounded await is what turned a broken worker into a silent hang; a timeout turns it into a sentence.

Revisit v6 when the worker/bundler interaction is fixed upstream. Do not un-pin without confirming that a state boundary actually draws.

## Decision 2 — Boundary geometry is fetched at setup, never committed

Administrative boundaries come from a Census-2011-derived dataset that **declares no licence**. `.docs/17-legal/legal-ethical-rules.md` and the source-registry rule both forbid republishing material whose terms we have not established, so the geometry is **not in the repository**.

`apps/web/scripts/fetch-boundaries.ts` downloads it from a pinned commit, simplifies it at two resolutions (national and per-state), dissolves state outlines where the source publishes none, and writes a gitignored `apps/web/public/geo/` plus a manifest recording the source, the commit and the retrieval date.

- **Cost of this choice:** a fresh clone has no map until `pnpm --filter @lokdarpan/web geo:fetch` runs. The explorer detects that specific condition and prints the command, rather than rendering an empty map.
- **Benefit:** we do not republish material we have no established right to republish, and what is on disk is traceable to a pinned source — the standard the ingestion pipeline already applies to government sources.

**Local-body boundaries are absent entirely.** No register reviewed publishes municipal or panchayat polygons in usable form (`.docs/06-government-sources/SOURCE-DISCOVERY-REPORT.md`). The map frames a local body's **extent** with a dashed rectangle and labels it as such. Drawing a plausible municipal boundary would be a fabricated fact in cartographic disguise, which is worse than an admitted gap because it does not look like one.

## Decision 3 — Explorer state lives in the query string, not in a path hierarchy

The obvious design is `/lokdarpan/maharashtra/nagpur/nagpur-municipal-corporation`. **Rejected**, because CLAUDE.md's `admin_unit` invariant is explicit that `/units/:id` is the one canonical address for a place, and a parallel path hierarchy would give every entity **two indexable URLs** — the exact failure that invariant exists to prevent, and a real cost on a product whose acquisition channel is search.

The explorer is a _view over_ places, not a second naming scheme for them, so its state is `?state=&district=&body=&dept=&type=&status=&firm=&project=` on `/explore`. It stays fully shareable and deep-linkable; entity pages keep their canonical paths.

State is mirrored with `history.replaceState`, **not** `router.replace`: the content is already in the browser, and a router navigation would round-trip the whole selection to the server to re-render identical markup, turning a drill-down into a page load.

## Consequences

- The renderer's cost is isolated to one route: `/explore` is ~291 kB first-load JS, every other page stays at ~105 kB. The document pages are unaffected.
- `<Figure>`'s provenance requirement is enforced on the map surface too — the drawer renders contract and tender values through it, so a figure without a source cannot be shown.
- Status presentation is guarded by a test (`apps/web/src/ui/status.test.ts`): no red at any stage, and every stage carries a distinct dash pattern as well as a colour, so the map survives monochrome and colour-vision deficiency.
- Pointer events hit an invisible 20 px line layer rather than the 3.4 px drawn line, and one hit test resolves works above districts above states. A per-layer handler arrangement let the district polygon overwrite the road's own hover, so the reader saw the district name while pointing at a work.
- The works list is not a convenience: it is the non-map route to every record on screen, required because map interaction must never be the only way to reach information.
