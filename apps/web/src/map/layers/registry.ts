import { childBoundaries } from "./child-boundaries";
import { selectedUnit } from "./selected-unit";
import { stateOutlines } from "./state-outlines";
import { tenderOffices } from "./tender-offices";
import type { LayerDefinition, StyleContext, StyleLayer } from "./types";

/**
 * Every layer the explorer can draw, as a static array.
 *
 * Not runtime registration: a fixed list is safe to evaluate on the server,
 * reviewable in one place, and cannot differ between two renders. What is not
 * here is deliberate — contractors and audit observations are not layers
 * (`.docs/decisions/gods-eye-view-adoption.md`), and there is no works layer
 * because no register of works with coordinates is held.
 */
export const LAYERS: readonly LayerDefinition[] = [
  stateOutlines,
  selectedUnit,
  tenderOffices,
  childBoundaries,
];

/** Every style layer, lowest band first; within a band, in registry order. */
export function orderedStyleLayers(
  context: StyleContext,
  layers: readonly LayerDefinition[] = LAYERS,
): readonly StyleLayer[] {
  return layers
    .flatMap((layer) => layer.styleLayers(context))
    .map((styleLayer, index) => ({ styleLayer, index }))
    .sort((a, b) => a.styleLayer.z - b.styleLayer.z || a.index - b.index)
    .map(({ styleLayer }) => styleLayer);
}
