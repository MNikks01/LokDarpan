"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DistrictSummary, LocalBody, StateSummary } from "@/domain/geography";
import type { Company, GovernmentDepartment } from "@/domain/organisation";
import type { ProjectSummary } from "@/domain/project";
import type { SearchResult } from "@/data/repositories";
import { DEMO_DATA_NOTICE } from "@/data/demo/notice";
import { Button, controlStyles } from "@/components/ui";
import { useExplorerState, type ExplorerState } from "@/state/useExplorerState";
import { cx } from "@/ui/cx";
import { Breadcrumb } from "./Breadcrumb";
import { FilterPanel } from "./FilterPanel";
import { MapCanvas, type MapHandle } from "./MapCanvas";
import { MapControls } from "./MapControls";
import { MapLegend } from "./MapLegend";
import { ProjectDrawer } from "./ProjectDrawer";
import { ProjectList } from "./ProjectList";
import { SearchDialog } from "./SearchDialog";
import { DEFAULT_LAYERS, type LayerVisibility } from "./layer-visibility";
import { useDistricts, useLocalBodies, useWorks } from "./use-explorer-data";
import styles from "./explorer.module.css";

const DRAWER_WIDTH = 428;
/** Matches `.rail` in explorer.module.css, plus its 12px gutters. */
const RAIL_WIDTH = 320;

export interface ExploreShellProps {
  readonly states: readonly StateSummary[];
  readonly departments: readonly GovernmentDepartment[];
  readonly companies: readonly Company[];
  /** Districts and works are fetched per selection; nothing is preloaded. */
  readonly initialProjects: readonly ProjectSummary[];
  readonly initialMatchedCount: number;
  /** Parsed from the request's query string on the server, so the SSR output and
   *  the first client render agree. */
  readonly initialState: ExplorerState;
}

/** The narrowest place selected, as the works list titles itself. */
function scopeLabelFor(
  state: StateSummary | null,
  district: DistrictSummary | null,
  localBody: LocalBody | null,
): string {
  return localBody?.name ?? district?.name ?? state?.name ?? "India";
}

/**
 * A central body commissions works in every state, so it stays in scope when a
 * state is chosen. Filtering it out with the state filter would hide records
 * that genuinely belong to the place the reader is looking at.
 */
function departmentsFor(
  departments: readonly GovernmentDepartment[],
  stateCode: string | null,
): readonly GovernmentDepartment[] {
  if (stateCode === null) return departments;
  return departments.filter((d) => d.stateCode === null || d.stateCode === stateCode);
}

/**
 * The explorer.
 *
 * State is split three ways and lives in three places on purpose: geography and
 * filters in the URL-backed `useExplorerState`, transient interface state here,
 * and map camera state inside MapLibre where it belongs. Hoisting the viewport
 * into React would re-render the tree on every frame of a pan.
 */
export function ExploreShell({
  states,
  departments,
  companies,
  initialProjects,
  initialMatchedCount,
  initialState,
}: ExploreShellProps): React.JSX.Element {
  const { geo, filters, selectedProjectId, actions } = useExplorerState(initialState);

  const { districts, loading: loadingDistricts } = useDistricts(geo.stateCode);
  const localBodies = useLocalBodies(geo.districtId);
  const works = useWorks(geo, filters, {
    projects: initialProjects,
    matchedCount: initialMatchedCount,
    loading: false,
  });

  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [compact, setCompact] = useState(false);
  const mapHandle = useRef<MapHandle | null>(null);

  // One media query drives two decisions — which layout to render, and whether
  // the filter rail starts open. On a phone the rail covers the map, so it
  // starts closed; on a desktop it costs nothing and starts open.
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const apply = (): void => {
      setCompact(query.matches);
      setRailOpen(!query.matches);
    };
    apply();
    query.addEventListener("change", apply);
    return () => {
      query.removeEventListener("change", apply);
    };
  }, []);

  const state = useMemo(
    () => states.find((s) => s.code === geo.stateCode) ?? null,
    [geo.stateCode, states],
  );
  const district = useMemo(
    () => districts.find((d) => d.id === geo.districtId) ?? null,
    [districts, geo.districtId],
  );
  const localBody = useMemo(
    () => localBodies.find((b) => b.id === geo.localBodyId) ?? null,
    [geo.localBodyId, localBodies],
  );
  const selectedSummary = useMemo(
    () => works.projects.find((p) => p.id === selectedProjectId) ?? null,
    [selectedProjectId, works.projects],
  );

  const departmentsInScope = useMemo(
    () => departmentsFor(departments, geo.stateCode),
    [departments, geo.stateCode],
  );

  const onSelectLevel = useCallback(
    (level: "country" | "state" | "district") => {
      if (level === "country") actions.selectState(null);
      else if (level === "state") actions.selectDistrict(null);
      else actions.selectLocalBody(null);
    },
    [actions],
  );

  const onSearchSelect = useCallback(
    (result: SearchResult) => {
      setSearchOpen(false);
      if (result.target.type === "project") {
        actions.selectProject(result.target.projectId);
        return;
      }
      if (result.target.type === "place") {
        actions.selectPlace(result.target.stateCode, result.target.districtId);
        return;
      }
      window.location.href = result.target.href;
    },
    [actions],
  );

  const drawerInset = selectedProjectId !== null && !compact ? DRAWER_WIDTH : 0;
  const insets = useMemo(
    () => ({ left: compact ? 0 : RAIL_WIDTH, right: drawerInset }),
    [compact, drawerInset],
  );
  const scopeLabel = scopeLabelFor(state, district, localBody);

  return (
    <div
      className={styles.shell}
      style={{ ["--ld-drawer-width" as string]: `${String(DRAWER_WIDTH)}px` }}
    >
      <ExplorerHeader
        state={state}
        district={district}
        localBody={localBody}
        onSelectLevel={onSelectLevel}
        onOpenSearch={() => {
          setSearchOpen(true);
        }}
      />
      <p className={styles.notice}>
        <span aria-hidden="true">⚠</span>
        {DEMO_DATA_NOTICE}
      </p>

      <div className={styles.stage}>
        <MapCanvas
          geo={geo}
          state={state}
          district={district}
          localBody={localBody}
          states={states}
          districts={districts}
          localBodies={localBodies}
          projects={works.projects}
          selectedProjectId={selectedProjectId}
          layers={layers}
          insets={insets}
          compact={compact}
          handleRef={mapHandle}
          onSelectState={actions.selectState}
          onSelectDistrict={actions.selectDistrict}
          onSelectProject={actions.selectProject}
        />

        {compact && (
          <div style={{ position: "absolute", left: 12, bottom: 12, zIndex: 3 }}>
            <Button
              variant="accent"
              onClick={() => {
                setRailOpen((open) => !open);
              }}
              ariaExpanded={railOpen}
              ariaControls="explorer-rail"
            >
              <span aria-hidden="true">⚟</span> Filters &amp; works
            </Button>
          </div>
        )}

        <div
          id="explorer-rail"
          className={cx(styles.rail, compact && !railOpen && styles.railCollapsed)}
        >
          <FilterPanel
            states={states}
            districts={districts}
            localBodies={localBodies}
            departments={departmentsInScope}
            companies={companies}
            geo={geo}
            filters={filters}
            actions={actions}
            loadingDistricts={loadingDistricts}
          />
          <ProjectList
            projects={works.projects}
            matchedCount={works.matchedCount}
            selectedProjectId={selectedProjectId}
            onSelect={actions.selectProject}
            onResetFilters={actions.resetFilters}
            loading={works.loading}
            scopeLabel={scopeLabel}
          />
        </div>

        <div className={cx(styles.controls, drawerInset > 0 && styles.controlsShifted)}>
          <MapControls
            onZoomIn={() => mapHandle.current?.zoomIn()}
            onZoomOut={() => mapHandle.current?.zoomOut()}
            onReset={() => mapHandle.current?.reframe()}
            onBackToIndia={() => {
              actions.selectState(null);
            }}
            showBackToIndia={geo.stateCode !== null}
            layers={layers}
            layersOpen={layersOpen}
            onToggleLayersOpen={() => {
              setLayersOpen((open) => !open);
            }}
            onToggleLayer={(key) => {
              setLayers((previous) => ({ ...previous, [key]: !previous[key] }));
            }}
          />
        </div>

        {!compact && <MapLegend shifted={drawerInset > 0} />}

        {selectedProjectId !== null && (
          <ProjectDrawer
            key={selectedProjectId}
            projectId={selectedProjectId}
            summary={selectedSummary}
            onClose={() => {
              actions.selectProject(null);
            }}
            onFilterByContractor={(companyId) => {
              actions.selectProject(null);
              actions.setContractor(companyId);
            }}
            onFilterByDepartment={(departmentId) => {
              actions.selectProject(null);
              actions.setDepartment(departmentId);
            }}
          />
        )}

        <SearchDialog
          open={searchOpen}
          onClose={() => {
            setSearchOpen(false);
          }}
          onSelect={onSearchSelect}
        />
      </div>
    </div>
  );
}

/**
 * The application bar: identity, where you are, and the way into search.
 *
 * Split out because the shell's job is orchestration; a header that grows a
 * fourth control should not make the component that owns the map harder to
 * read.
 */
function ExplorerHeader({
  state,
  district,
  localBody,
  onSelectLevel,
  onOpenSearch,
}: {
  readonly state: StateSummary | null;
  readonly district: DistrictSummary | null;
  readonly localBody: LocalBody | null;
  readonly onSelectLevel: (level: "country" | "state" | "district") => void;
  readonly onOpenSearch: () => void;
}): React.JSX.Element {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        <span className={styles.wordmarkName}>LOKDARPAN</span>
        <span className={styles.wordmarkTag}>
          Public infrastructure · Procurement · Accountability
        </span>
      </Link>
      <span className={styles.headerSpacer} />
      <Breadcrumb
        state={state}
        district={district}
        localBody={localBody}
        onSelectLevel={onSelectLevel}
      />
      <span className={styles.headerSpacer} />
      <Button onClick={onOpenSearch}>
        <span aria-hidden="true">⌕</span> Search
      </Button>
      <Link href="/about" className={controlStyles.link} style={{ fontSize: 12.5 }}>
        About
      </Link>
    </header>
  );
}
