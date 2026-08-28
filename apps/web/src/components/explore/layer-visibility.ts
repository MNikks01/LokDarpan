/**
 * Which map layers are drawn.
 *
 * Three toggles, not a checklist of every layer id: a reader choosing what to
 * see thinks in terms of "boundaries" and "names", and a control that mirrors
 * the renderer's internals is a control nobody uses.
 */
export interface LayerVisibility {
  readonly states: boolean;
  readonly districts: boolean;
  readonly placeNames: boolean;
}

export const DEFAULT_LAYERS: LayerVisibility = {
  states: true,
  districts: true,
  placeNames: true,
};

export const LAYER_LABELS: readonly {
  readonly key: keyof LayerVisibility;
  readonly label: string;
  readonly note: string;
}[] = [
  { key: "states", label: "State boundaries", note: "Census 2011 administrative units" },
  { key: "districts", label: "District boundaries", note: "Shown once a state is selected" },
  {
    key: "placeNames",
    label: "Place names",
    note: "State and district names, placed to avoid overlapping",
  },
];
