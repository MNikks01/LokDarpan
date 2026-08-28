/**
 * Which map layers are drawn.
 *
 * Three toggles, not a checklist of every layer id: a reader choosing what to
 * see thinks in terms of "boundaries" and "names", and a control that mirrors
 * the renderer's internals is a control nobody uses.
 */
export interface LayerVisibility {
  readonly states: boolean;
  /** Boundaries of whatever level is being drilled into. */
  readonly areas: boolean;
  readonly placeNames: boolean;
}

export const DEFAULT_LAYERS: LayerVisibility = {
  states: true,
  areas: true,
  placeNames: true,
};

export const LAYER_LABELS: readonly {
  readonly key: keyof LayerVisibility;
  readonly label: string;
  readonly note: string;
}[] = [
  { key: "states", label: "State boundaries", note: "Census 2011 administrative units" },
  {
    key: "areas",
    label: "Area boundaries",
    note: "Districts, talukas, municipal bodies — whichever level is in view",
  },
  {
    key: "placeNames",
    label: "Place names",
    note: "State and district names, placed to avoid overlapping",
  },
];
