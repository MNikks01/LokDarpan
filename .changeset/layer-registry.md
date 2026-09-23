---
"@lokdarpan/web": minor
---

Define each map layer in one file and apply them through one binder (ADR-058).

State outlines, the selected unit, tender shading and child boundaries are now `LayerDefinition`s in
`map/layers/`, listed in a static registry that `map/style.ts` builds its overlay from. The binder in
`map/engine/binder.ts` applies their data, filters and visibility to MapLibre only when they change,
and runs the one hit test in a fixed order.

A layer that cannot name the source of what it draws, or whose data is not collected, draws nothing.
A test now fails if any map layer uses red.
