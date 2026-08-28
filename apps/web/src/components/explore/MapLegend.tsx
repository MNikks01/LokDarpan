"use client";

import type React from "react";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/ui/status";
import { cx } from "@/ui/cx";
import styles from "./explorer.module.css";

/**
 * The legend carries the line pattern as well as the colour, because the map
 * does. A reader who cannot separate the teal from the amber can still tell a
 * solid line from a dash-dot one, and the label settles it either way.
 */
export function MapLegend({ shifted }: { readonly shifted: boolean }): React.JSX.Element {
  return (
    <div className={cx(styles.panel, styles.legend, shifted && styles.legendShifted)}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>Recorded stage</h2>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {PROJECT_STATUS_ORDER.map((status) => {
            const presentation = PROJECT_STATUS[status];
            return (
              <li
                key={status}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
              >
                <svg width="26" height="8" aria-hidden="true" style={{ flex: "none" }}>
                  <line
                    x1="1"
                    y1="4"
                    x2="25"
                    y2="4"
                    stroke={presentation.line}
                    strokeWidth={presentation.width}
                    strokeLinecap={presentation.dash === null ? "round" : "butt"}
                    strokeDasharray={
                      presentation.dash === null
                        ? undefined
                        : presentation.dash.map((d) => d * presentation.width).join(" ")
                    }
                  />
                </svg>
                <span>{presentation.label}</span>
              </li>
            );
          })}
        </ul>
        <p style={{ fontSize: 11, color: "var(--ld-text-tertiary)", margin: "10px 0 0" }}>
          Stage is read from the record. It is a statement about dates in a document, never about
          the parties named in it.
        </p>
      </div>
    </div>
  );
}
