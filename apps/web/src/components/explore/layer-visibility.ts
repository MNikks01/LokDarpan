/**
 * Which map layers are drawn.
 *
 * Deliberately four toggles, not a checklist of every layer id: a reader
 * choosing what to see thinks in terms of "boundaries" and "works", and a
 * control that mirrors the renderer's internals is a control nobody uses.
 */
export interface LayerVisibility {
  readonly states: boolean;
  readonly districts: boolean;
  readonly localBodies: boolean;
  readonly works: boolean;
  readonly placeNames: boolean;
}

export const DEFAULT_LAYERS: LayerVisibility = {
  states: true,
  districts: true,
  localBodies: true,
  works: true,
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
    key: "localBodies",
    label: "Local body extent",
    note: "Approximate extent — no boundary is published for these bodies",
  },
  { key: "works", label: "Works", note: "Roads and structures matching the current filters" },
  {
    key: "placeNames",
    label: "Place names",
    note: "States, districts, and the towns and villages held for the selected district",
  },
];
