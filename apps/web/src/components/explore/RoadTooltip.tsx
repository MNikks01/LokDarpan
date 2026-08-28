"use client";

import type React from "react";
import { Money } from "@lokdarpan/money";
import type { ProjectSummary } from "@/domain/project";
import { PROJECT_STATUS } from "@/ui/status";
import styles from "./explorer.module.css";

export type HoverTarget =
  | { readonly kind: "project"; readonly projectId: string; readonly x: number; readonly y: number }
  | {
      readonly kind: "area";
      readonly title: string;
      readonly subtitle: string;
      readonly x: number;
      readonly y: number;
    };

/**
 * The hover card is a teaser, not a record. Four lines at most: what it is,
 * what stage the record says it is at, what it was awarded for, and who holds
 * the contract. Everything else waits for a click, so a pointer sweeping the
 * map does not fire a wall of text at the reader.
 */
export function RoadTooltip({
  target,
  project,
}: {
  readonly target: HoverTarget;
  readonly project: ProjectSummary | null;
}): React.JSX.Element | null {
  const style = { left: target.x + 14, top: target.y + 14 } as const;

  if (target.kind === "area") {
    return (
      <div className={styles.tooltip} style={style} role="presentation">
        <div className={styles.tooltipTitle}>{target.title}</div>
        <div className={styles.tooltipRow}>{target.subtitle}</div>
      </div>
    );
  }

  if (project === null) return null;
  const presentation = PROJECT_STATUS[project.status];

  return (
    <div className={styles.tooltip} style={style} role="presentation">
      <div className={styles.tooltipTitle}>{project.name}</div>
      <div className={styles.tooltipRow}>
        <span aria-hidden="true">{presentation.glyph}</span>
        <span>{presentation.label}</span>
      </div>
      <div className={styles.tooltipRow}>
        <span>Contract value</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {project.contractValue.present
            ? Money.fromDecimalString(project.contractValue.amountInr).format()
            : "Not in the records held"}
        </span>
      </div>
      <div className={styles.tooltipRow}>
        <span>{project.externalId}</span>
      </div>
    </div>
  );
}
