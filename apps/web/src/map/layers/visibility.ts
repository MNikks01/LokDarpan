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

/**
 * Each toggle's token in a shared link's `?layers=`. Stable: a token is never
 * reused for a different toggle, or old links would open showing something
 * their author did not choose. The registry's `urlToken`s agree with these.
 */
export const TOGGLE_TOKEN: Readonly<Record<keyof LayerVisibility, string>> = {
  states: "so",
  areas: "cb",
  placeNames: "pn",
};

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
  {
    key: "states",
    label: "State boundaries",
    note: "OpenStreetMap, identified against the directory",
  },
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
