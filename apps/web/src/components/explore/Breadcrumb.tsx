"use client";

import type React from "react";
import type { GeoUnit } from "@lokdarpan/domain";
import { LEVEL_LABEL } from "@lokdarpan/domain";
import { controlStyles } from "@/components/ui";
import { cx } from "@/ui/cx";

/**
 * The context indicator, and the way back out.
 *
 * Built from the unit's actual ancestor chain rather than a fixed
 * country/state/district sequence, so a descent through a taluka into a village
 * reads correctly without the component knowing those levels exist.
 *
 * Each level is a button, not a link: activating one moves the camera in place,
 * and a link would navigate away from the view the reader has built up. The
 * current level carries `aria-current` and is not focusable, so a keyboard
 * reader is not offered a control that does nothing.
 */
export function Breadcrumb({
  stateName,
  ancestors,
  onSelectLevel,
}: {
  readonly stateName: string | null;
  readonly ancestors: readonly GeoUnit[];
  readonly onSelectLevel: (unitId: number | null) => void;
}): React.JSX.Element {
  // The chain includes the state itself; it is rendered from `stateName` so a
  // state with no ledger unit still shows.
  const below = ancestors.filter((unit) => unit.level !== "state" && unit.level !== "country");

  const crumbs: readonly {
    readonly key: string;
    readonly label: string;
    readonly detail: string | null;
    readonly target: number | null;
    readonly current: boolean;
  }[] = [
    {
      key: "country",
      label: "India",
      detail: null,
      target: null,
      current: stateName === null,
    },
    ...(stateName === null
      ? []
      : [
          {
            key: "state",
            label: stateName,
            detail: null,
            target: null as number | null,
            current: below.length === 0,
          },
        ]),
    ...below.map((unit, index) => ({
      key: `unit-${String(unit.id)}`,
      label: unit.name,
      detail: LEVEL_LABEL[unit.level],
      target: unit.id,
      current: index === below.length - 1,
    })),
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
        {crumbs.map((crumb, index) => (
          <li key={crumb.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {index > 0 && (
              <span aria-hidden="true" style={{ color: "var(--ld-text-tertiary)" }}>
                ›
              </span>
            )}
            {crumb.current ? (
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
                  onSelectLevel(crumb.target);
                }}
              >
                {crumb.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
