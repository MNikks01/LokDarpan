"use client";

import type React from "react";
import type { DistrictSummary, StateSummary } from "@/domain/geography";
import { Select } from "@/components/ui";
import type { ExplorerActions, GeoSelection } from "@/state/useExplorerState";
import styles from "./explorer.module.css";

/**
 * Place selection, and nothing else.
 *
 * The panel previously carried department, infrastructure, stage and firm
 * filters. Every one of them narrowed a set of works, and no register of works
 * has been located for any area — so they filtered nothing, and a control that
 * appears to narrow results while doing nothing is worse than its absence.
 * They return with the data that would justify them.
 *
 * The district selector is offered because the boundaries are real, but nothing
 * in the ledger is recorded below state level yet: `admin_unit` holds states
 * only, since the directory gates district and village views behind a CAPTCHA.
 * The hint says so rather than leaving the reader to infer it from an empty
 * panel.
 */
export function FilterPanel({
  states,
  districts,
  geo,
  actions,
  loadingDistricts,
}: {
  readonly states: readonly StateSummary[];
  readonly districts: readonly DistrictSummary[];
  readonly geo: GeoSelection;
  readonly actions: ExplorerActions;
  readonly loadingDistricts: boolean;
}): React.JSX.Element {
  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>Where</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <Select
            label="State"
            placeholder="Select state"
            value={geo.stateCode}
            options={states.map((s) => ({ value: s.code, label: s.name }))}
            onChange={actions.selectState}
          />
          <Select
            label="District"
            placeholder={geo.stateCode === null ? "Select a state first" : "Select district"}
            value={geo.districtId}
            disabled={geo.stateCode === null || loadingDistricts}
            options={districts.map((d) => ({ value: d.id, label: d.name }))}
            onChange={actions.selectDistrict}
            hint="Boundaries are real. No record in the ledger is held below state level yet — the directory gates district views behind a CAPTCHA."
          />
        </div>
      </div>
    </div>
  );
}
