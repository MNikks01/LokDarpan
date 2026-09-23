/**
 * Which place names are drawn, and which give way.
 *
 * Pure: no map, no DOM, no clock of its own. The renderer projects labels to
 * screen rectangles and passes the time in; this decides. That is what lets the
 * rules below be tested exactly.
 *
 * THE RULE THIS MODULE MUST NEVER BREAK
 * A name wins a collision for reasons about the map, never about the place's
 * records. Priority is built from four fields only — explicit selection, focus,
 * administrative level, and size — and the input type admits nothing else.
 * Spend, tender counts, audit findings or any score must not reach this file.
 * `.docs/adr/057-place-names-are-placed-in-the-browser.md`,
 * `.docs/decisions/gods-eye-view-adoption.md` ("what is drawn is not what is ranked").
 *
 * WHY THERE IS MEMORY
 * Without it, a name at the edge of a collision appears and disappears as the
 * map moves by a pixel. Two short rules stop that: a name just shown stays for a
 * moment even if a stronger one now overlaps it, and a name just hidden waits a
 * moment before it may return. Both are short, because nothing on this map moves
 * by itself and a reader panning a state wants names to follow promptly.
 *
 * Adapted from God's Eye View's label arbiter (spatial grid, minimum lifetime,
 * cooldown). Its per-layer quotas and weights are deliberately not taken: a
 * weight is a ranking.
 */

/** How long a newly shown name holds its place against a stronger one. */
export const MIN_VISIBLE_MS = 600;
/** How long a hidden name waits before it may be shown again. */
export const COOLDOWN_MS = 400;
/** Grid cell for collision tests: about twice a label's height at 12px type. */
export const CELL_PX = 32;
/** Breathing room around each label, in CSS pixels. */
export const GUTTER_PX = 4;

/**
 * Administrative tiers, coarser first. A municipal body and a taluka share a
 * tier: neither is "above" the other, so size decides between them.
 */
const LEVEL_TIER: Readonly<Record<string, number>> = {
  country: 0,
  state: 1,
  district: 2,
  sub_district: 3,
  urban_local_body: 3,
  block: 4,
  gram_panchayat: 5,
  ward: 5,
  village: 6,
};
const UNKNOWN_TIER = 7;

/** Everything priority may depend on. Nothing else is accepted. */
export interface PriorityInput {
  readonly id: string;
  readonly level: string;
  /**
   * The place's size, in one unit across a label set (m² for areas from the
   * ledger). Bucketed by powers of two, so near-equal places tie and the id
   * decides rather than a rounding difference.
   */
  readonly size: number;
  readonly selected: boolean;
  readonly focused: boolean;
}

export type PriorityKey = readonly [number, number, number, number, string];

export function priorityKey(input: PriorityInput): PriorityKey {
  const bucket = input.size > 0 ? Math.floor(Math.log2(input.size)) : Number.NEGATIVE_INFINITY;
  return [
    input.selected ? 0 : 1,
    input.focused ? 0 : 1,
    LEVEL_TIER[input.level] ?? UNKNOWN_TIER,
    -bucket,
    input.id,
  ];
}

/** Lower sorts first. A total order: the id breaks every tie. */
export function compareKeys(a: PriorityKey, b: PriorityKey): number {
  for (let i = 0; i < 4; i++) {
    const d = (a[i] as number) - (b[i] as number);
    if (d !== 0) return d;
  }
  return a[4] < b[4] ? -1 : a[4] > b[4] ? 1 : 0;
}

export interface ScreenLabel {
  readonly id: string;
  /** Centre of the label on screen. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Always drawn, even over another name: the reader asked for this place. */
  readonly pinned: boolean;
}

interface Box {
  readonly l: number;
  readonly t: number;
  readonly r: number;
  readonly b: number;
}

function boxOf(label: ScreenLabel): Box {
  const hw = label.width / 2 + GUTTER_PX;
  const hh = label.height / 2 + GUTTER_PX;
  return { l: label.x - hw, t: label.y - hh, r: label.x + hw, b: label.y + hh };
}

/** A uniform grid of placed boxes, so each test touches only nearby labels. */
class Grid {
  private readonly cells = new Map<number, Box[]>();

  private static key(cx: number, cy: number): number {
    // Screen coordinates stay far inside ±2^14 cells, so the pair packs into one number.
    return (cx + 16_384) * 32_768 + (cy + 16_384);
  }

  private static span(box: Box): readonly [number, number, number, number] {
    return [
      Math.floor(box.l / CELL_PX),
      Math.floor(box.t / CELL_PX),
      Math.floor(box.r / CELL_PX),
      Math.floor(box.b / CELL_PX),
    ];
  }

  collides(box: Box): boolean {
    const [x0, y0, x1, y1] = Grid.span(box);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.cells.get(Grid.key(cx, cy));
        if (bucket?.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t)) {
          return true;
        }
      }
    }
    return false;
  }

  add(box: Box): void {
    const [x0, y0, x1, y1] = Grid.span(box);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const key = Grid.key(cx, cy);
        const bucket = this.cells.get(key);
        if (bucket === undefined) this.cells.set(key, [box]);
        else bucket.push(box);
      }
    }
  }
}

interface LabelMemory {
  visibleSince: number | null;
  hiddenAt: number | null;
}

export interface Placement {
  readonly visible: ReadonlySet<string>;
  readonly shown: readonly string[];
  readonly hidden: readonly string[];
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export class LabelArbiter {
  private readonly memory = new Map<string, LabelMemory>();

  /**
   * Decide which labels are drawn.
   *
   * `ordered` must already be in priority order: sort with `compareKeys` when
   * the label set changes, not on every frame. Labels are placed in three
   * passes: pinned by the reader; shown recently enough to hold their place;
   * then everything else by priority, skipping any still cooling down.
   */
  solve(ordered: readonly ScreenLabel[], viewport: Viewport, now: number): Placement {
    const grid = new Grid();
    const visible = new Set<string>();

    const onScreen = (box: Box): boolean =>
      box.r >= 0 && box.l <= viewport.width && box.b >= 0 && box.t <= viewport.height;

    const place = (label: ScreenLabel, allowOverlap: boolean): void => {
      if (visible.has(label.id)) return;
      const box = boxOf(label);
      if (!onScreen(box)) return;
      if (!allowOverlap && grid.collides(box)) return;
      grid.add(box);
      visible.add(label.id);
    };

    for (const label of ordered) if (label.pinned) place(label, true);

    for (const label of ordered) if (this.holdsPlace(label.id, now)) place(label, true);

    for (const label of ordered) if (!this.coolingDown(label.id, now)) place(label, false);

    return this.remember(ordered, visible, now);
  }

  /** Shown so recently that a stronger overlapping name may not displace it yet. */
  private holdsPlace(id: string, now: number): boolean {
    const since = this.memory.get(id)?.visibleSince ?? null;
    return since !== null && now - since < MIN_VISIBLE_MS;
  }

  /** Hidden so recently that it may not return yet. */
  private coolingDown(id: string, now: number): boolean {
    const hiddenAt = this.memory.get(id)?.hiddenAt ?? null;
    return hiddenAt !== null && now - hiddenAt < COOLDOWN_MS;
  }

  private remember(
    ordered: readonly ScreenLabel[],
    visible: ReadonlySet<string>,
    now: number,
  ): Placement {
    const shown: string[] = [];
    const hidden: string[] = [];
    const present = new Set<string>();

    for (const { id } of ordered) {
      present.add(id);
      const entry = this.memory.get(id) ?? { visibleSince: null, hiddenAt: null };
      const wasVisible = entry.visibleSince !== null;
      if (visible.has(id) && !wasVisible) {
        entry.visibleSince = now;
        entry.hiddenAt = null;
        shown.push(id);
      } else if (!visible.has(id) && wasVisible) {
        entry.visibleSince = null;
        entry.hiddenAt = now;
        hidden.push(id);
      }
      this.memory.set(id, entry);
    }

    // A label no longer offered is forgotten; if it returns, it starts fresh.
    for (const id of [...this.memory.keys()]) if (!present.has(id)) this.memory.delete(id);

    return { visible, shown, hidden };
  }

  /** Forget everything, for a wholly new label set. */
  reset(): void {
    this.memory.clear();
  }
}
