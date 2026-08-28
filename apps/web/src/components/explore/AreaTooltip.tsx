"use client";

import type React from "react";
import styles from "./explorer.module.css";

/**
 * The hover card for an administrative area.
 *
 * Two lines: the name, and what kind of unit it is. It previously also carried
 * a works variant showing a contract value and a firm on hover — that is gone
 * with the works, and would have been the wrong shape for a record anyway: a
 * verified fact needs its evidence sentence and its page beside it, which is a
 * panel's job, not a pointer's.
 */
export interface HoverTarget {
  readonly kind: "area";
  readonly title: string;
  readonly subtitle: string;
  readonly x: number;
  readonly y: number;
}

export function AreaTooltip({ target }: { readonly target: HoverTarget }): React.JSX.Element {
  return (
    <div
      className={styles.tooltip}
      style={{ left: target.x + 14, top: target.y + 14 }}
      role="presentation"
    >
      <div className={styles.tooltipTitle}>{target.title}</div>
      <div className={styles.tooltipRow}>{target.subtitle}</div>
    </div>
  );
}
