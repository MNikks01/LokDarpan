/**
 * How a project status is shown.
 *
 * TWO RULES FROM `.docs/17-legal/legal-ethical-rules.md` SHAPE THIS TABLE:
 *
 * 1. No red. Not in any status, not at any severity. A red road on a map reads
 *    as an accusation before the reader has seen a single figure. Red is
 *    reserved for destructive user actions (`ui/tokens.ts`).
 * 2. Colour is never the only channel. Each status also carries a line style, a
 *    glyph and a label, so the map is readable with any colour vision and in a
 *    monochrome print.
 *
 * `description` is the neutral sentence shown beside the badge. Each states what
 * the record says; none states why.
 */
import type { ProjectStatus } from "@/domain/project";

export interface StatusPresentation {
  readonly label: string;
  readonly description: string;
  readonly line: string;
  readonly badgeBg: string;
  readonly badgeFg: string;
  readonly glyph: string;
  /** MapLibre dash pattern in line-widths; null draws a solid line. */
  readonly dash: readonly number[] | null;
  readonly width: number;
}

export const PROJECT_STATUS: Readonly<Record<ProjectStatus, StatusPresentation>> = {
  completed: {
    label: "Completed",
    description: "A completion date is recorded against this work.",
    line: "#0F766E",
    badgeBg: "#E6F2F0",
    badgeFg: "#0B4F49",
    glyph: "●",
    dash: null,
    width: 3.4,
  },
  in_progress: {
    label: "Under construction",
    description: "Work has a recorded start date and no recorded completion date.",
    line: "#B07A18",
    badgeBg: "#EFE3CB",
    badgeFg: "#6B4E14",
    glyph: "◑",
    dash: [2.4, 1.4],
    width: 3.4,
  },
  behind_recorded_schedule: {
    label: "Behind recorded schedule",
    description:
      "The expected completion date in the record has passed and no completion date is recorded. This compares two dates in the record and states nothing about why they differ.",
    line: "#7A5A0E",
    badgeBg: "#E5D2AE",
    badgeFg: "#4A360C",
    glyph: "◕",
    dash: [4, 1.4, 1, 1.4],
    width: 3.8,
  },
  proposed: {
    label: "Proposed",
    description: "Listed in a works programme. No contract award is recorded.",
    line: "#55605F",
    badgeBg: "#E8EDEC",
    badgeFg: "#2F4F4C",
    glyph: "○",
    dash: [1.2, 1.6],
    width: 2.6,
  },
  records_incomplete: {
    label: "Records incomplete",
    description:
      "The work appears in a register, but the records held do not carry enough detail to state its stage. This describes our holdings, not the publishing body.",
    line: "#8B9594",
    badgeBg: "#F0F1F0",
    badgeFg: "#55605F",
    glyph: "▤",
    dash: [1, 2],
    width: 2.4,
  },
};

export const PROJECT_STATUS_ORDER: readonly ProjectStatus[] = [
  "completed",
  "in_progress",
  "behind_recorded_schedule",
  "proposed",
  "records_incomplete",
];
