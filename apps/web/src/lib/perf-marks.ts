/**
 * The marks the performance harness reads (ADR-062). Named here, once, so the
 * page and the harness cannot drift apart. Marks cost almost nothing and are
 * left on in production: a reader's own devtools can then show the same
 * timeline the harness records.
 */
export const MARK = {
  /** The explorer's client island has hydrated: the rail answers input. */
  hydrated: "explorer:hydrated",
  /** The map object is about to be built. */
  mapInit: "map:init",
  /** MapLibre's `load`: style and sources ready. */
  mapLoad: "map:load",
  /** A level's boundaries were handed to the map and it went idle having drawn them. */
  boundariesDrawn: "map:boundaries-drawn",
} as const;

export function mark(name: string, detail?: Readonly<Record<string, unknown>>): void {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return;
  performance.mark(name, detail === undefined ? undefined : { detail });
}
