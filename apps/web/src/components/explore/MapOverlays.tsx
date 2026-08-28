"use client";

import type React from "react";
import { basemapStyleUrl } from "@/map/style";
import { AreaTooltip, type HoverTarget } from "./AreaTooltip";
import styles from "./explorer.module.css";

/**
 * Everything drawn on top of the map canvas: the hover card, the attribution,
 * and the live region that narrates the current view.
 *
 * Split out of `MapCanvas` so that component is the map's lifecycle and nothing
 * else. The live region is the part that matters least visually and most for
 * access: a screen-reader user gets told where the camera went and how many
 * works are in view, which is the information a sighted reader gets for free.
 */
export function MapOverlays({
  hover,
  placeName,
  stateName,
  loading,
}: {
  readonly hover: HoverTarget | null;
  readonly placeName: string | null;
  readonly stateName: string | null;
  readonly loading: boolean;
}): React.JSX.Element {
  const place = placeName ?? stateName;

  return (
    <>
      {hover !== null && <AreaTooltip target={hover} />}
      <p className={styles.attribution}>
        Boundaries: Census 2011 (states) · OpenStreetMap ODbL (below) ·{" "}
        {basemapStyleUrl() === null ? "no basemap" : "configured basemap"} · MapLibre GL
      </p>
      {loading && (
        <p className={styles.attribution} style={{ left: 12, right: "auto" }} role="status">
          Loading boundaries…
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {place === null ? "Showing India" : `Showing ${place}.`}
      </span>
    </>
  );
}

export function MapUnavailable({ reason }: { readonly reason: string }): React.JSX.Element {
  return (
    <div className={styles.mapUnavailable} role="alert">
      <div style={{ maxWidth: "46ch" }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>The map could not be drawn</p>
        <p style={{ fontSize: 13.5, color: "var(--ld-text-secondary)" }}>{reason}</p>
        <p style={{ fontSize: 13, color: "var(--ld-text-tertiary)", marginTop: 12 }}>
          Every record on this page is also reachable from the works list, which does not need the
          map.
        </p>
      </div>
    </div>
  );
}
