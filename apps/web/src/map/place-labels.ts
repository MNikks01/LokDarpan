import { Marker } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";

import {
  COOLDOWN_MS,
  LabelArbiter,
  MIN_VISIBLE_MS,
  compareKeys,
  priorityKey,
  type ScreenLabel,
} from "./labels/arbiter";

/**
 * Place names on the map.
 *
 * WHY DOM MARKERS AND NOT A SYMBOL LAYER
 * MapLibre GL JS 5.24 cannot shape Indic scripts. Its own source marks
 * U+0900–U+0DFF — Devanagari through Sinhala — as requiring complex text shaping
 * it does not perform, and its only shaping hook covers Arabic. A symbol layer
 * would draw Marathi, Hindi or Tamil names as broken glyph sequences. DOM text
 * is shaped by the browser, so names render correctly in every script, and no
 * glyph endpoint has to be hosted or borrowed.
 * `.docs/adr/057-place-names-are-placed-in-the-browser.md`.
 *
 * WHAT THIS FILE DOES AND DOES NOT DECIDE
 * It projects, measures and writes. Which names are drawn is decided by
 * `labels/arbiter.ts`, from selection, level and size only.
 *
 * COST
 * Only names whose anchor is in or near the view get a DOM node, capped at
 * MAX_NODES; new names are measured in one batch after they are attached, so a
 * level of hundreds of villages costs one layout rather than one per name; and
 * a node's style is written only when its visibility changes.
 */

export interface PlaceLabel {
  readonly id: string;
  readonly text: string;
  /** Inside the place, from PostGIS for ledger units. `[lng, lat]`. */
  readonly lngLat: readonly [number, number];
  readonly level: string;
  /** Size in one unit across this label set. Decides collisions between equal levels. */
  readonly size: number;
  /** The reader's selection: always drawn. */
  readonly selected: boolean;
  readonly tone: "primary" | "secondary";
}

/** Most name nodes kept in the DOM at once. Beyond it, lower-priority names wait. */
export const MAX_NODES = 150;
/** Anchors this far outside the view, as a fraction of its span, are kept ready. */
const VIEW_MARGIN = 0.25;
const FADE_MS = 150;

interface LabelNode {
  readonly label: PlaceLabel;
  readonly marker: Marker;
  /**
   * The text, inside the marker's own element. Visibility is written here and
   * never on the marker element: MapLibre's `Marker` resets its element's
   * `style.opacity` on every camera move (its terrain-occlusion handling), which
   * silently re-showed every name the arbiter had hidden. Found in the browser,
   * as eleven pairs of overlapping names that should not have been drawn.
   */
  readonly element: HTMLElement;
  width: number;
  height: number;
}

function styleFor(tone: PlaceLabel["tone"], animate: boolean): string {
  const size = tone === "primary" ? "12px" : "11px";
  const weight = tone === "primary" ? 650 : 550;
  const colour = tone === "primary" ? "#14181A" : "#55605F";
  return [
    `font: ${String(weight)} ${size} Inter, system-ui, sans-serif`,
    `color: ${colour}`,
    "letter-spacing: 0.01em",
    "white-space: nowrap",
    // A halo rather than a background plate: a plate would mask the boundary
    // underneath, and the boundary is the thing being labelled.
    "text-shadow: 0 0 3px #FBFBFA, 0 0 3px #FBFBFA, 0 0 3px #FBFBFA, 0 0 6px #FBFBFA",
    "pointer-events: none",
    "user-select: none",
    "display: block",
    "opacity: 0",
    animate ? `transition: opacity ${String(FADE_MS)}ms ease` : "",
  ]
    .filter((rule) => rule !== "")
    .join("; ");
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function byPriority(labels: readonly PlaceLabel[]): PlaceLabel[] {
  const keyed = labels.map((label) => ({
    label,
    key: priorityKey({
      id: label.id,
      level: label.level,
      size: label.size,
      selected: label.selected,
      focused: false,
    }),
  }));
  keyed.sort((a, b) => compareKeys(a.key, b.key));
  return keyed.map((entry) => entry.label);
}

function sameAnchor(a: PlaceLabel, b: PlaceLabel): boolean {
  return a.text === b.text && a.lngLat[0] === b.lngLat[0] && a.lngLat[1] === b.lngLat[1];
}

export interface PlaceLabelLayer {
  readonly setLabels: (labels: readonly PlaceLabel[]) => void;
  readonly setVisible: (visible: boolean) => void;
  readonly destroy: () => void;
}

export function createPlaceLabelLayer(map: MapLibreMap): PlaceLabelLayer {
  const arbiter = new LabelArbiter();
  const nodes = new Map<string, LabelNode>();
  const animate = !prefersReducedMotion();
  let ordered: PlaceLabel[] = [];
  let visible = true;
  let frame: number | null = null;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const removeNode = (id: string): void => {
    nodes.get(id)?.marker.remove();
    nodes.delete(id);
  };

  /** The names worth a node: anchored in or near the view, in priority order, capped. */
  const nearView = (): PlaceLabel[] => {
    const bounds = map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const padX = (east - west) * VIEW_MARGIN;
    const padY = (north - south) * VIEW_MARGIN;
    const near: PlaceLabel[] = [];
    for (const label of ordered) {
      const [lng, lat] = label.lngLat;
      if (lng < west - padX || lng > east + padX || lat < south - padY || lat > north + padY) {
        continue;
      }
      near.push(label);
      if (near.length === MAX_NODES) break;
    }
    return near;
  };

  /** Attach nodes for newly near names, then measure them all in one pass. */
  const attach = (near: readonly PlaceLabel[]): void => {
    const created: LabelNode[] = [];
    for (const label of near) {
      if (nodes.has(label.id)) continue;
      const wrapper = document.createElement("div");
      wrapper.setAttribute("aria-hidden", "true");
      wrapper.style.pointerEvents = "none";
      const element = document.createElement("span");
      element.textContent = label.text;
      element.style.cssText = styleFor(label.tone, animate);
      wrapper.appendChild(element);
      const marker = new Marker({ element: wrapper })
        .setLngLat([label.lngLat[0], label.lngLat[1]])
        .addTo(map);
      const node: LabelNode = { label, marker, element, width: 0, height: 0 };
      nodes.set(label.id, node);
      created.push(node);
    }
    // Reads after all writes: one layout for the batch, not one per name.
    for (const node of created) {
      node.width = node.element.offsetWidth;
      node.height = node.element.offsetHeight;
    }
  };

  const setOpacity = (ids: readonly string[], opacity: "0" | "1"): void => {
    for (const id of ids) {
      const node = nodes.get(id);
      if (node !== undefined) node.element.style.opacity = opacity;
    }
  };

  const layout = (): void => {
    frame = null;
    if (!visible) {
      for (const node of nodes.values()) node.element.style.opacity = "0";
      return;
    }

    const near = nearView();
    const nearIds = new Set(near.map((label) => label.id));
    for (const id of [...nodes.keys()]) if (!nearIds.has(id)) removeNode(id);
    attach(near);

    const screen: ScreenLabel[] = [];
    for (const label of near) {
      const node = nodes.get(label.id);
      if (node === undefined) continue;
      const point = map.project([label.lngLat[0], label.lngLat[1]]);
      screen.push({
        id: label.id,
        x: point.x,
        y: point.y,
        width: node.width,
        height: node.height,
        pinned: label.selected,
      });
    }

    const canvas = map.getCanvas();
    const placement = arbiter.solve(
      screen,
      { width: canvas.clientWidth, height: canvas.clientHeight },
      performance.now(),
    );
    setOpacity(placement.shown, "1");
    setOpacity(placement.hidden, "0");
  };

  const schedule = (): void => {
    frame ??= requestAnimationFrame(layout);
  };

  /**
   * A name held by its minimum time, or waiting out its cooldown, changes state
   * after the camera has stopped. One more pass once both windows have passed
   * lets it settle without a camera event to trigger it.
   */
  const settleAfterMove = (): void => {
    clearTimeout(settle);
    settle = setTimeout(schedule, Math.max(MIN_VISIBLE_MS, COOLDOWN_MS) + 50);
  };

  map.on("move", schedule);
  map.on("zoom", schedule);
  map.on("resize", schedule);
  map.on("moveend", settleAfterMove);

  return {
    setLabels(labels) {
      ordered = byPriority(labels);
      const next = new Map(labels.map((label) => [label.id, label]));
      // A name that is gone, or whose text or anchor changed, gets a fresh node.
      for (const [id, node] of [...nodes]) {
        const replacement = next.get(id);
        if (replacement === undefined || !sameAnchor(replacement, node.label)) removeNode(id);
      }
      schedule();
      settleAfterMove();
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      // Hiding wrote opacity directly, behind the arbiter's back. Forgetting what
      // it had shown makes the next pass show those names again.
      arbiter.reset();
      schedule();
    },
    destroy() {
      if (frame !== null) cancelAnimationFrame(frame);
      clearTimeout(settle);
      map.off("move", schedule);
      map.off("zoom", schedule);
      map.off("resize", schedule);
      map.off("moveend", settleAfterMove);
      for (const id of [...nodes.keys()]) removeNode(id);
    },
  };
}
