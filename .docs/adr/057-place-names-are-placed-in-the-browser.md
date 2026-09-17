# ADR-057 · Place names are placed in the browser

**Status:** Accepted · **Date:** 2026-09-17 · **Implements** phase 3 of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md) · **Extends** [`022-web-map-explorer.md`](./022-web-map-explorer.md)

## Context

The explorer drew place names as DOM markers and resolved overlaps greedily: every frame it sorted
all names and tested each against every name already placed. Three things were wrong with it.

- **Names could sit outside their place.** The anchor was the middle of the unit's bounding box.
  For a coastal district, a crescent-shaped taluka or a unit in several pieces, that point can be
  in the sea or in a neighbouring unit.
- **Collisions were decided by the wrong size.** Priority was bounding-box area in square degrees,
  which inflates units spread across islands and shrinks northern ones.
- **It did not scale and it flickered.** Collision testing was O(n·k) on every frame, each name
  forced its own layout when measured, and a name at the edge of a collision appeared and vanished
  as the map moved by a pixel. At state and district level that was tolerable; village level will
  put hundreds of names in one view.

The obvious alternative is a MapLibre `symbol` layer, which has collision handling built in. **It
was checked against the installed renderer and rejected.** `maplibre-gl` 5.24.0's
`codePointRequiresComplexTextShaping` marks U+0900–U+0DFF (Devanagari, Bengali, Gurmukhi,
Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam, Sinhala) as needing shaping it does not do, and
its only shaping hook, `charInComplexShapingScript`, covers Arabic. Local-script names would render
as broken glyph sequences. DOM text is shaped by the browser.

## Decision

**Names stay in the DOM, and placement follows God's Eye View's label arbiter, adapted.**

- **Anchors and sizes come from PostGIS.** Migration 0032 adds generated columns to
  `admin_unit_boundary`: `label_point`, the centre of the largest inscribed circle, which lies
  inside the unit, and `area_m2`, the ellipsoidal area. Every path that writes a boundary gets
  them, and a changed geometry cannot keep a stale anchor.
- **Priority is neutral by construction.** `apps/web/src/map/labels/arbiter.ts` builds a key from
  explicit selection, focus, administrative tier (coarser first; a municipal body and a taluka
  share a tier) and size bucketed by powers of two, with the unit id breaking ties. Its input type
  admits nothing else. A test asserts that adding record-derived properties changes nothing.
- **Placement has short memory.** A name just shown holds its place for 600 ms against a stronger
  overlapping one, and a name just hidden waits 400 ms before returning. God's Eye View uses
  2.5 s and 1.2 s for objects that move by themselves; nothing on this map does.
- **Collision tests use a 32 px grid**, so each test touches only nearby names.
- **The renderer does less.** Only names anchored in or near the view get a node, capped at 150.
  New names are measured in one batch, so there is one layout instead of one per name. Styles are
  written only when a name's visibility changes, with a 150 ms fade that is disabled under
  `prefers-reduced-motion`.
- **Not taken from God's Eye View:** per-layer label quotas, semantic layer weights and the
  farthest-point spreading queue. A weight is a ranking, and administrative units are already
  spread out.

## Consequences

Checked in a headless browser against the running explorer. On the India view, 23 of 36 state names
are drawn with no overlaps. A 1 px pan repeated 40 times changed the visible set 0 times. Names
return after being turned off and on. A concave test district's name was drawn inside its shape,
where the bounding-box centre would have fallen in its cut-out.

**The browser found a defect no unit test could.** MapLibre's `Marker` resets its element's
`style.opacity` on every camera move, as part of its terrain-occlusion handling. Names hidden on
that element came back on the first move, leaving eleven overlapping pairs on the India view.
Visibility is now written to a span inside the marker, and `e2e/explore.spec.ts` asserts that no
two visible names overlap once the map settles.

A solve for 2,000 densely packed names takes a few milliseconds in the unit test. State label points
still come from the boundary manifest (the centroid of each state's largest ring), not from
PostGIS.

**Revisit** if MapLibre gains complex text shaping for Indic scripts. Symbol layers would then
provide collision and fading natively, and this module could be removed.
