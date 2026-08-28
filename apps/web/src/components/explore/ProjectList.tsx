"use client";

import type React from "react";
import { Money } from "@lokdarpan/money";
import type { ProjectSummary } from "@/domain/project";
import { Badge, Button, controlStyles } from "@/components/ui";
import { PROJECT_STATUS } from "@/ui/status";
import styles from "./explorer.module.css";

/**
 * The works list is not a convenience — it is the non-map route to every record
 * on this screen. `.docs/12-accessibility` and the brief both require that map
 * interaction is never the only way to reach information, and a list of buttons
 * is what a screen reader, a keyboard and a narrow phone can all drive.
 */
export function ProjectList({
  projects,
  matchedCount,
  selectedProjectId,
  onSelect,
  onResetFilters,
  loading,
  scopeLabel,
}: {
  readonly projects: readonly ProjectSummary[];
  readonly matchedCount: number;
  readonly selectedProjectId: string | null;
  readonly onSelect: (projectId: string) => void;
  readonly onResetFilters: () => void;
  readonly loading: boolean;
  readonly scopeLabel: string;
}): React.JSX.Element {
  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle} id="works-heading">
          Works in {scopeLabel}
        </h2>

        {loading ? (
          <p style={{ fontSize: 13, color: "var(--ld-text-secondary)", margin: 0 }} role="status">
            Loading works…
          </p>
        ) : projects.length === 0 ? (
          <div className={controlStyles.emptyState}>
            <p style={{ margin: "0 0 4px", fontWeight: 600 }}>No works match these filters</p>
            <p style={{ margin: 0 }}>
              The records held for this area may not cover this combination. Try changing:
            </p>
            <ul>
              <li>Department</li>
              <li>Infrastructure type</li>
              <li>District or local body</li>
              <li>Recorded stage</li>
            </ul>
            <Button onClick={onResetFilters}>Reset filters</Button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "0 0 8px" }}>
              {projects.length === matchedCount
                ? `${String(matchedCount)} in the records held`
                : `Showing ${String(projects.length)} of ${String(matchedCount)} in the records held`}
            </p>
            <ul
              aria-labelledby="works-heading"
              style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}
            >
              {projects.map((project) => {
                const presentation = PROJECT_STATUS[project.status];
                const selected = project.id === selectedProjectId;
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(project.id);
                      }}
                      aria-current={selected ? "true" : undefined}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        font: "inherit",
                        cursor: "pointer",
                        padding: "8px 9px",
                        borderRadius: 8,
                        border: "1px solid transparent",
                        background: selected ? "var(--ld-accent-soft)" : "transparent",
                        borderColor: selected ? "var(--ld-accent)" : "transparent",
                      }}
                    >
                      <span
                        style={{ display: "block", fontSize: 13, fontWeight: 550, lineHeight: 1.3 }}
                      >
                        {project.name}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          marginTop: 5,
                          flexWrap: "wrap",
                        }}
                      >
                        <Badge
                          glyph={presentation.glyph}
                          label={presentation.label}
                          background={presentation.badgeBg}
                          foreground={presentation.badgeFg}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--ld-text-secondary)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {project.contractValue.present
                            ? Money.fromDecimalString(project.contractValue.amountInr).format()
                            : "Value not in records"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
