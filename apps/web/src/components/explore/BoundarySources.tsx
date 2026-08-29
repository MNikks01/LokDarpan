"use client";

import type React from "react";
import type { BoundarySourceKind, GeoUnit } from "@lokdarpan/domain";
import type { OutlineSource } from "./ExploreShell";
import styles from "./explorer.module.css";

/**
 * Where the lines on the map came from.
 *
 * An accountability platform that draws a boundary has to be able to say who
 * drew it. A boundary published by the body that defines it and one traced by
 * volunteers are both usable and are not the same claim, so the panel reports
 * the mix rather than letting a uniform-looking map imply uniform authority.
 */
const KIND_LABEL: Readonly<Record<BoundarySourceKind, string>> = {
  official_government: "Official — published by the defining authority",
  open_dataset: "Open dataset — usable, not authoritative",
  derived: "Derived — computed from other geometry",
};

export function BoundarySources({
  units,
  outlineSource,
}: {
  readonly units: readonly GeoUnit[];
  readonly outlineSource: OutlineSource;
}): React.JSX.Element | null {
  const drawn = units.filter((u) => u.boundary !== null);
  const withoutBoundary = units.length - drawn.length;
  // No early return any more. The country outlines are drawn at every level, so
  // their attribution has to be reachable at every level — including India,
  // where no unit has been selected and there is nothing else to report.

  const byKind = new Map<BoundarySourceKind, { count: number; source: string; licence: string }>();
  for (const unit of drawn) {
    const boundary = unit.boundary;
    if (boundary === null) continue;
    const existing = byKind.get(boundary.kind);
    if (existing === undefined) {
      byKind.set(boundary.kind, {
        count: 1,
        source: boundary.sourceName,
        licence: boundary.sourceLicence,
      });
    } else existing.count += 1;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>Boundary sources</h2>

        {byKind.size === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--ld-text-secondary)", margin: 0 }}>
            <span aria-hidden="true">▤ </span>
            No boundary is held for anything inside this place.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {[...byKind.entries()].map(([kind, info]) => (
              <li key={kind} style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>
                  {info.count} {info.count === 1 ? "boundary" : "boundaries"}
                </span>
                <span style={{ display: "block", color: "var(--ld-text-secondary)" }}>
                  {KIND_LABEL[kind]}
                </span>
                <span
                  style={{ display: "block", color: "var(--ld-text-tertiary)", fontSize: 11.5 }}
                >
                  {info.source} · {info.licence}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "10px 0 0" }}>
          <span aria-hidden="true">▤ </span>
          State and district outlines: {outlineSource.attribution} · {outlineSource.licence}
        </p>

        {withoutBoundary > 0 && (
          <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "10px 0 0" }}>
            <span aria-hidden="true">▤ </span>
            {withoutBoundary} named {withoutBoundary === 1 ? "unit has" : "units have"} no boundary
            held, so {withoutBoundary === 1 ? "it is" : "they are"} selectable but not drawn.
          </p>
        )}
      </div>
    </div>
  );
}
