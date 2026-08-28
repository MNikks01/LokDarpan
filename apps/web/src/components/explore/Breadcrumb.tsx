"use client";

import type React from "react";
import type { DistrictSummary, StateSummary } from "@/domain/geography";
import { controlStyles } from "@/components/ui";
import { cx } from "@/ui/cx";

/**
 * The context indicator, and the way back out.
 *
 * Each level is a button rather than a link: activating one moves the camera in
 * place, and a link would navigate away from a view the reader has built up.
 * The current level is `aria-current="page"` and not focusable, so a keyboard
 * reader is not offered a control that does nothing.
 */
export function Breadcrumb({
  state,
  district,
  onSelectLevel,
}: {
  readonly state: StateSummary | null;
  readonly district: DistrictSummary | null;
  readonly onSelectLevel: (level: "country" | "state" | "district") => void;
}): React.JSX.Element {
  const crumbs: readonly {
    readonly key: string;
    readonly label: string;
    readonly detail: string | null;
    readonly level: "country" | "state" | "district" | null;
  }[] = [
    { key: "country", label: "India", detail: null, level: state === null ? null : "country" },
    ...(state === null
      ? []
      : [
          {
            key: "state",
            label: state.name,
            detail: null,
            level: district === null ? null : ("state" as const),
          },
        ]),
    ...(district === null
      ? []
      : [
          {
            key: "district",
            label: district.name,
            detail: null,
            level: null,
          },
        ]),
  ];

  return (
    <nav aria-label="Location" style={{ minWidth: 0 }}>
      <ol
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          listStyle: "none",
          margin: 0,
          padding: 0,
          fontSize: 13,
          flexWrap: "wrap",
        }}
      >
        {crumbs.map((crumb, index) => {
          const level = crumb.level;
          return (
            <li key={crumb.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {index > 0 && (
                <span aria-hidden="true" style={{ color: "var(--ld-text-tertiary)" }}>
                  ›
                </span>
              )}
              {level === null ? (
                <span aria-current="page" style={{ fontWeight: 600 }}>
                  {crumb.label}
                  {crumb.detail !== null && (
                    <span style={{ color: "var(--ld-text-tertiary)", fontWeight: 400 }}>
                      {" "}
                      · {crumb.detail}
                    </span>
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  className={cx(controlStyles.button, controlStyles.buttonQuiet)}
                  style={{ padding: "2px 6px" }}
                  onClick={() => {
                    onSelectLevel(level);
                  }}
                >
                  {crumb.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
