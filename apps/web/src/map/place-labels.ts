import { Marker } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * Place names on the map.
 *
 * WHY DOM MARKERS AND NOT A SYMBOL LAYER
 * A MapLibre `symbol` layer needs a `glyphs` endpoint serving font PBFs. We host
 * none, and pointing at a public one would put a third-party request on every
 * reader's browser — the thing `map/style.ts` deliberately avoids. DOM labels
 * cost nothing extra to serve and stay legible at any zoom.
 *
 * What a symbol layer WOULD give us for free is collision handling, so that is
 * implemented here: labels are placed greedily in priority order and any that
 * would overlap an already-placed one is hidden. Without it a state view is 36
 * names stacked into an unreadable smear.
 */

export interface PlaceLabel {
  readonly id: string;
  readonly text: string;
  readonly lngLat: readonly [number, number];
  /** Higher wins a collision. Bigger places and denser bodies rank first. */
  readonly priority: number;
  readonly tone: "primary" | "secondary";
}

interface Placed {
  readonly marker: Marker;
  readonly element: HTMLElement;
  readonly label: PlaceLabel;
  width: number;
  height: number;
}

/** Breathing room around each label, in CSS pixels. */
const GUTTER = 4;

function styleFor(tone: PlaceLabel["tone"]): string {
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
  ].join("; ");
}

export interface PlaceLabelLayer {
  readonly setLabels: (labels: readonly PlaceLabel[]) => void;
  readonly setVisible: (visible: boolean) => void;
  readonly destroy: () => void;
}

export function createPlaceLabelLayer(map: MapLibreMap): PlaceLabelLayer {
  let placed: Placed[] = [];
  let visible = true;
  let frame: number | null = null;

  const clear = (): void => {
    for (const item of placed) item.marker.remove();
    placed = [];
  };

  /**
   * Decide which labels survive. Runs on every camera change, so it does only
   * projection and rectangle tests — no DOM measurement, which is why width and
   * height are captured once when the marker is created.
   */
  const layout = (): void => {
    frame = null;
    if (!visible) {
      for (const item of placed) item.element.style.visibility = "hidden";
      return;
    }

    const canvas = map.getCanvas();
    const viewWidth = canvas.clientWidth;
    const viewHeight = canvas.clientHeight;
    const taken: { l: number; t: number; r: number; b: number }[] = [];

    for (const item of [...placed].sort((a, b) => b.label.priority - a.label.priority)) {
      const point = map.project([item.label.lngLat[0], item.label.lngLat[1]]);
      const half = item.width / 2;
      const box = {
        l: point.x - half - GUTTER,
        t: point.y - item.height / 2 - GUTTER,
        r: point.x + half + GUTTER,
        b: point.y + item.height / 2 + GUTTER,
      };

      const offscreen = box.r < 0 || box.l > viewWidth || box.b < 0 || box.t > viewHeight;
      const collides = taken.some(
        (other) => box.l < other.r && box.r > other.l && box.t < other.b && box.b > other.t,
      );

      if (offscreen || collides) {
        item.element.style.visibility = "hidden";
        continue;
      }
      item.element.style.visibility = "visible";
      taken.push(box);
    }
  };

  const schedule = (): void => {
    frame ??= requestAnimationFrame(layout);
  };

  map.on("move", schedule);
  map.on("zoom", schedule);
  map.on("resize", schedule);

  return {
    setLabels(labels) {
      clear();
      for (const label of labels) {
        const element = document.createElement("span");
        element.textContent = label.text;
        element.setAttribute("aria-hidden", "true");
        element.style.cssText = styleFor(label.tone);
        const marker = new Marker({ element })
          .setLngLat([label.lngLat[0], label.lngLat[1]])
          .addTo(map);
        // Measured once, while the element is in the document and unrotated.
        placed.push({
          marker,
          element,
          label,
          width: element.offsetWidth,
          height: element.offsetHeight,
        });
      }
      schedule();
    },
    setVisible(next) {
      visible = next;
      schedule();
    },
    destroy() {
      if (frame !== null) cancelAnimationFrame(frame);
      map.off("move", schedule);
      map.off("zoom", schedule);
      map.off("resize", schedule);
      clear();
    },
  };
}
