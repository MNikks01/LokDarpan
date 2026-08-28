"use client";

import type React from "react";
import { useState } from "react";
import type { DistrictSummary, LocalBody, StateSummary } from "@/domain/geography";
import { LOCAL_BODY_TYPE_LABEL } from "@/domain/geography";
import type { Company, GovernmentDepartment } from "@/domain/organisation";
import { INFRASTRUCTURE_LABEL } from "@/domain/project";
import type { InfrastructureType } from "@/domain/project";
import { Button, CheckRow, Select, controlStyles } from "@/components/ui";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/ui/status";
import type { ExplorerActions, OrgFilters, GeoSelection } from "@/state/useExplorerState";
import styles from "./explorer.module.css";

const INFRASTRUCTURE_ORDER: readonly InfrastructureType[] = [
  "road",
  "bridge",
  "flyover",
  "highway",
  "other",
];

/**
 * Progressive disclosure, in the order the journey needs it.
 *
 * Place first, because everything else is meaningless without it; then the body
 * that commissioned the work and the kind of work; then stage and firm behind a
 * disclosure. A panel that showed all nine filters at once would be a form, and
 * the brief for this surface is a map.
 *
 * A selector for a level the reader has not reached yet is disabled with a
 * reason rather than hidden, so the shape of the drill-down is visible from the
 * first screen.
 */
export function FilterPanel({
  states,
  districts,
  localBodies,
  departments,
  companies,
  geo,
  filters,
  actions,
  loadingDistricts,
}: {
  readonly states: readonly StateSummary[];
  readonly districts: readonly DistrictSummary[];
  readonly localBodies: readonly LocalBody[];
  readonly departments: readonly GovernmentDepartment[];
  readonly companies: readonly Company[];
  readonly geo: GeoSelection;
  readonly filters: OrgFilters;
  readonly actions: ExplorerActions;
  readonly loadingDistricts: boolean;
}): React.JSX.Element {
  const [showMore, setShowMore] = useState(false);
  const allStatuses = filters.statuses.length === PROJECT_STATUS_ORDER.length;

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
          />
          <Select
            label="City / local body"
            placeholder={
              geo.districtId === null
                ? "Select a district first"
                : localBodies.length === 0
                  ? "None in the records held"
                  : "Select local body"
            }
            value={geo.localBodyId}
            disabled={geo.districtId === null || localBodies.length === 0}
            options={localBodies.map((b) => ({
              value: b.id,
              label: `${b.name} · ${LOCAL_BODY_TYPE_LABEL[b.type]}`,
            }))}
            onChange={actions.selectLocalBody}
            {...(geo.localBodyId !== null
              ? { hint: "No boundary is published for local bodies; the map frames the extent." }
              : {})}
          />
        </div>
      </div>

      <div className={styles.panelBody} style={{ borderTop: "1px solid var(--ld-hair)" }}>
        <h2 className={styles.panelTitle}>What</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <Select
            label="Ministry / department"
            placeholder="All departments"
            value={filters.departmentId}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            onChange={actions.setDepartment}
          />
          <Select
            label="Infrastructure"
            placeholder="Roads"
            value={filters.infrastructureType}
            options={INFRASTRUCTURE_ORDER.map((type) => ({
              value: type,
              label: INFRASTRUCTURE_LABEL[type],
            }))}
            onChange={(value) => {
              actions.setInfrastructureType((value ?? "road") as InfrastructureType);
            }}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <Button
            variant="quiet"
            onClick={() => {
              setShowMore((open) => !open);
            }}
            ariaExpanded={showMore}
            ariaControls="more-filters"
          >
            <span aria-hidden="true">{showMore ? "▾" : "▸"}</span>
            More filters
            {!allStatuses || filters.contractorId !== null ? (
              <span style={{ color: "var(--ld-accent)" }}>· active</span>
            ) : null}
          </Button>
        </div>

        <div id="more-filters" hidden={!showMore} style={{ marginTop: 8 }}>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className={controlStyles.label} style={{ padding: 0 }}>
              Recorded stage
            </legend>
            {PROJECT_STATUS_ORDER.map((status) => (
              <CheckRow
                key={status}
                checked={filters.statuses.includes(status)}
                onChange={() => {
                  actions.toggleStatus(status);
                }}
              >
                {PROJECT_STATUS[status].label}
              </CheckRow>
            ))}
          </fieldset>
          <div style={{ marginTop: 10 }}>
            <Select
              label="Contractor"
              placeholder="Any firm"
              value={filters.contractorId}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              onChange={actions.setContractor}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <Button variant="quiet" onClick={actions.resetFilters}>
              Reset filters
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
