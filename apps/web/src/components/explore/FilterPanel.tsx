"use client";

import type React from "react";
import { useMemo } from "react";
import { LEVEL_LABEL, type AdminUnitLevel, type GeoUnit } from "@lokdarpan/domain";
import type { StateOption } from "@/data/geography";
import { Button, Select } from "@/components/ui";
import type { ExplorerActions, GeoSelection } from "@/state/useExplorerState";
import type { LevelCoverage } from "./use-explorer-data";
import styles from "./explorer.module.css";

/**
 * Where the reader is.
 *
 * The second selector is not "District" and not "Local body". It is whatever
 * the selected place actually contains, labelled by level — because a district
 * contains several kinds of thing at once. Nagpur holds fourteen talukas, three
 * municipal bodies and its villages, and a municipal corporation is beside a
 * taluka rather than beneath it. Naming the control after one of those levels
 * would make the others look like a mistake.
 *
 * That also means the drill-down is not a fixed sequence. The same control
 * serves state → district, district → taluka or municipal body, and taluka →
 * village, because each step asks one question: what is inside this?
 */
/**
 * What our holdings at a level do not cover.
 *
 * Pune district holds 14 talukas and no municipal body, and Pune Municipal
 * Corporation plainly exists. Without this the selector shows fourteen areas and
 * a reader takes that for the whole of Pune's local government.
 *
 * Only shortfalls are stated. Announcing that a complete level is complete would
 * bury the one line that matters among two that do not.
 */
function CoverageNote({
  coverage,
}: {
  readonly coverage: readonly LevelCoverage[];
}): React.JSX.Element | null {
  const short = coverage.filter((c) => c.status !== "complete");
  if (short.length === 0) return null;

  return (
    <div style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", display: "grid", gap: 6 }}>
      {short.map((c) => (
        <p key={c.level} style={{ margin: 0 }}>
          <span aria-hidden="true">▤ </span>
          {c.status === "not_collected"
            ? `${LEVEL_LABEL[c.level as AdminUnitLevel]} boundaries have not been collected.`
            : `${LEVEL_LABEL[c.level as AdminUnitLevel]} coverage is incomplete.`}{" "}
          {c.note ?? ""}
        </p>
      ))}
    </div>
  );
}

export function FilterPanel({
  states,
  units,
  coverage,
  geo,
  actions,
  loading,
  ancestors,
}: {
  readonly states: readonly StateOption[];
  readonly units: readonly GeoUnit[];
  readonly coverage: readonly LevelCoverage[];
  readonly geo: GeoSelection;
  readonly actions: ExplorerActions;
  readonly loading: boolean;
  readonly ancestors: readonly GeoUnit[];
}): React.JSX.Element {
  const selectedState = states.find((s) => s.code === geo.stateCode) ?? null;

  // Sorted by level so a reader scanning for a municipal corporation is not
  // reading past forty villages to find it. The repository already returns them
  // in level order; this keeps the label beside each name.
  const options = useMemo(
    () =>
      units.map((unit) => ({
        value: String(unit.id),
        label: `${unit.name} · ${LEVEL_LABEL[unit.level]}`,
      })),
    [units],
  );

  const innermost = ancestors[ancestors.length - 1];
  const insideLabel = innermost?.name ?? selectedState?.name ?? "here";
  const parent = ancestors[ancestors.length - 2];

  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>Where</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <Select
            label="State"
            placeholder="Select state"
            value={geo.stateCode}
            options={states.map((s) => ({
              value: s.code,
              label: s.unitId === null ? `${s.name} — not in the directory` : s.name,
              disabled: s.unitId === null,
            }))}
            onChange={actions.selectState}
          />

          <Select
            label={`Inside ${insideLabel}`}
            placeholder={placeholderFor(geo.stateCode, loading, options.length)}
            value={geo.unitId === null ? null : String(geo.unitId)}
            disabled={geo.stateCode === null || options.length === 0}
            options={options}
            onChange={(value) => {
              actions.selectUnit(value === null ? null : Number(value));
            }}
          />

          <CoverageNote coverage={coverage} />

          {geo.unitId !== null && (
            <div style={{ justifySelf: "start" }}>
              <Button
                variant="quiet"
                onClick={() => {
                  // Step out one level rather than back to the state, so a
                  // reader deep in a taluka does not lose the whole descent.
                  actions.selectUnit(parent?.id ?? null);
                }}
              >
                <span aria-hidden="true">←</span> Up one level
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Why the area selector is empty, in the selector itself.
 *
 * "No units are held inside this one" is a statement about our holdings, not
 * about the place — most states have nothing below them ingested yet, and a
 * blank dropdown would read as a fault.
 */
function placeholderFor(stateCode: string | null, loading: boolean, count: number): string {
  if (stateCode === null) return "Select a state first";
  if (loading) return "Loading…";
  if (count === 0) return "No areas are held inside this one";
  return "Select an area";
}
