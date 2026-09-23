# ADR-058 · A map layer is a definition, not an effect

**Status:** Accepted · **Date:** 2026-09-23 · **Implements** phase 6 of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md)

## Context

Each of the explorer's four map layers was spread across four places:

- its sources and style in `map/style.ts`;
- its data, filter and visibility in separate `useEffect`s in `MapCanvas.tsx`;
- its hit testing in a hard-coded list of layer ids inside the pointer handler;
- its toggle in `components/explore/layer-visibility.ts`.

Adding a layer meant editing all four and keeping them in agreement by hand. Nothing checked that a
drawn layer could say where its geometry came from, although `<Figure>` refuses a figure without
provenance. Nothing checked the style for red, although the legal and ethical rules forbid it. God's
Eye View gives each layer a module with a lifecycle and receives its services instead of importing
them. The adoption plan takes that shape, without the runtime registration or the global store.

## Decision

**A layer is a `LayerDefinition`** (`apps/web/src/map/layers/types.ts`), one file per layer. It holds:

- the sources it owns, and which `MapInput` fields its data reads;
- its style layers, each placed in a z band. The selected unit's fill sits under its siblings and its
  outline over them, so one position per file cannot express the stack;
- its filters;
- a hit spec: which style layer to test, in what order, and how a feature becomes a `Selection`
  and a tooltip;
- the reader toggle that controls it;
- a URL token, reserved for phase 7;
- **its provenance, which is mandatory,** and optionally its data state.

Definitions are pure. They import no MapLibre at runtime.

**The registry is a static array** (`map/layers/registry.ts`): state outlines, selected unit, tender
offices, child boundaries. It is safe to evaluate on the server, reviewable in one place, and cannot
differ between two renders. `map/style.ts` builds the overlay from it.

**The binder** (`map/engine/binder.ts`) is the only code that applies definitions to MapLibre. It
receives the map through `MapPort`, the six calls it makes, so its whole lifecycle is tested with a
fake. It sends data only when a field a layer reads changes identity. It sets filters and visibility
only when they change, and runs one hit test in a fixed order, skipping hidden layers.
`MapCanvas` keeps the renderer's lifecycle, the pointer, the camera and the place names, and hands
everything else to `binder.update(input)`.

**The refuse rule.** A layer draws nothing when:

- it cannot name a source, or
- its data state is `not_collected`.

Its sources are emptied, not just hidden, so no hit test or label can read geometry the map does not
show. It is the map's equivalent of `<Figure>` requiring provenance:

- **Child boundaries** name their sources from each feature's `sourceName`. A name the registry does
  not hold is passed through and described as a source with no recorded terms, not dropped.
- **Tender shading** names the portals the counts came from, which the overview already returned
  (ADR-055) and the client had discarded. It draws nothing for a state that is not collected.

**The toggles move to `map/layers/visibility.ts`**, because map code must not import from
`components/`.

## Consequences

`registry.test.ts` pins the style stack to the order the hand-written style had, so this refactor
provably changes no layering. It also checks that every id and URL token is distinct, and that every
style layer's source is owned. **It checks every colour in every paint expression for red**, with a
test proving the check catches red. The "no red" rule was prose until now; it is now enforced.

`binder.test.ts` covers:

- data sent once and resent only on change;
- filters;
- toggles;
- both refusals, and refilling after a refusal clears;
- hit order, and falling through a hidden layer.

Checked in headless Chromium against the local ledger. Hovering an Odisha district showed its name
and level, and clicking selected it. With area boundaries toggled off, the same point fell through to
the state. Madhya Pradesh shaded Katni, Jabalpur and Indore, the three MP districts with counts.

**Not in this change:**

- **Layers do not fetch their own data.** The ledger design gives each definition a resource spec.
  The explorer's reads are shared with the rail and already go through the phase 5 cache, so the
  shell still fetches and passes one `MapInput`. That moves when the first layer needs a read the
  rail does not.
- **Tender counts are still merged into the child features** by `withTenderCounts` in the shell.
  The tender layer owns no source and styles the child boundaries' source.
- **Place names stay a DOM layer** outside the registry (ADR-057). Their toggle is shared with the
  registry's.
- **`urlToken` is defined but not read** until phase 7 puts layers in the URL.
