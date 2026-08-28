"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GeoUnit } from "@lokdarpan/domain";
import type { StateOption } from "@/data/geography";
import { Button, controlStyles } from "@/components/ui";
import { cx } from "@/ui/cx";
import { useExplorerState, type ExplorerState } from "@/state/useExplorerState";
import { Breadcrumb } from "./Breadcrumb";
import { FilterPanel } from "./FilterPanel";
import { MapCanvas, type MapHandle } from "./MapCanvas";
import { MapControls } from "./MapControls";
import { RecordDrawer } from "./RecordDrawer";
import { RecordsPanel } from "./RecordsPanel";
import { BoundarySources } from "./BoundarySources";
import { DEFAULT_LAYERS, type LayerVisibility } from "./layer-visibility";
import { useExplorerGeography, type RecordsState } from "./use-explorer-data";
import styles from "./explorer.module.css";

const DRAWER_WIDTH = 428;
/** Matches `.rail` in explorer.module.css, plus its 12px gutters. */
const RAIL_WIDTH = 320;

export interface ExploreShellProps {
  readonly states: readonly StateOption[];
  readonly initialState: ExplorerState;
}

/**
 * The explorer.
 *
 * Geography comes from the ledger below state level, so the drill-down is not a
 * fixed sequence: the shell asks what is inside the current place and renders
 * whatever levels come back. India → state uses the Census outlines, because the
 * directory publishes no boundary for a state and an outline has to come from
 * somewhere.
 *
 * Geometry never enters React state beyond the one collection being drawn. It
 * goes from `fetch` to a MapLibre source and is replaced wholesale on the next
 * selection.
 */
export function ExploreShell({ states, initialState }: ExploreShellProps): React.JSX.Element {
  const { geo, selectedDocumentId, actions } = useExplorerState(initialState);

  const {
    selectedState,
    units,
    loadingChildren,
    childBoundaries,
    activeUnit,
    activeGeometry,
    ancestors,
    records,
    scopeLabel,
  } = useExplorerGeography(states, geo.stateCode, geo.unitId);

  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [compact, setCompact] = useState(false);
  const mapHandle = useRef<MapHandle | null>(null);

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

  const onSelectLevel = useCallback(
    (unitId: number | null) => {
      if (unitId === null) actions.selectState(null);
      else actions.selectUnit(unitId);
    },
    [actions],
  );

  const drawerInset = selectedDocumentId !== null && !compact ? DRAWER_WIDTH : 0;
  const insets = useMemo(
    () => ({ left: compact ? 0 : RAIL_WIDTH, right: drawerInset }),
    [compact, drawerInset],
  );

  return (
    <div
      className={styles.shell}
      style={{ ["--ld-drawer-width" as string]: `${String(DRAWER_WIDTH)}px` }}
    >
      <ExplorerHeader
        stateName={selectedState?.name ?? null}
        ancestors={ancestors}
        onSelectLevel={onSelectLevel}
      />
      <p className={styles.notice}>
        <span aria-hidden="true">◆</span>
        Official records only. Every figure shown has been checked by a person against the page it
        was read from.
      </p>

      <div className={styles.stage}>
        <MapCanvas
          stateCode={geo.stateCode}
          stateBbox={selectedState?.bbox ?? null}
          activeUnit={activeUnit}
          activeGeometry={activeGeometry}
          childBoundaries={childBoundaries}
          states={states}
          layers={layers}
          insets={insets}
          compact={compact}
          handleRef={mapHandle}
          onSelectState={actions.selectState}
          onSelectUnit={actions.selectUnit}
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
              <span aria-hidden="true">⚟</span> Places &amp; records
            </Button>
          </div>
        )}

        <ExplorerRail
          hidden={compact && !railOpen}
          states={states}
          units={units}
          geo={geo}
          actions={actions}
          loadingChildren={loadingChildren}
          ancestors={ancestors}
          activeUnit={activeUnit}
          records={records}
          scopeLabel={scopeLabel}
          selectedDocumentId={selectedDocumentId}
        />

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

        {selectedDocumentId !== null && (
          <RecordDrawer
            key={selectedDocumentId}
            documentId={selectedDocumentId}
            onClose={() => {
              actions.selectDocument(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

/** The application bar: identity, where you are, and the way to the records index. */
function ExplorerHeader({
  stateName,
  ancestors,
  onSelectLevel,
}: {
  readonly stateName: string | null;
  readonly ancestors: readonly GeoUnit[];
  readonly onSelectLevel: (unitId: number | null) => void;
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
      <Breadcrumb stateName={stateName} ancestors={ancestors} onSelectLevel={onSelectLevel} />
      <span className={styles.headerSpacer} />
      <Link href="/documents" className={controlStyles.link} style={{ fontSize: 12.5 }}>
        All records
      </Link>
      <Link href="/about" className={controlStyles.link} style={{ fontSize: 12.5 }}>
        About
      </Link>
    </header>
  );
}

/**
 * The left rail: where you are, where the boundaries came from, what is held.
 *
 * Split from the shell because the shell's job is orchestration — the map, the
 * drawer and the URL — and a panel that grows a fourth section should not make
 * the component that owns the map harder to read.
 */
function ExplorerRail({
  hidden,
  states,
  units,
  geo,
  actions,
  loadingChildren,
  ancestors,
  activeUnit,
  records,
  scopeLabel,
  selectedDocumentId,
}: {
  readonly hidden: boolean;
  readonly states: readonly StateOption[];
  readonly units: readonly GeoUnit[];
  readonly geo: ReturnType<typeof useExplorerState>["geo"];
  readonly actions: ReturnType<typeof useExplorerState>["actions"];
  readonly loadingChildren: boolean;
  readonly ancestors: readonly GeoUnit[];
  readonly activeUnit: GeoUnit | null;
  readonly records: RecordsState;
  readonly scopeLabel: string;
  readonly selectedDocumentId: number | null;
}): React.JSX.Element {
  return (
    <div id="explorer-rail" className={cx(styles.rail, hidden && styles.railCollapsed)}>
      <FilterPanel
        states={states}
        units={units}
        geo={geo}
        actions={actions}
        loading={loadingChildren}
        ancestors={ancestors}
      />
      <BoundarySources units={units} active={activeUnit} />
      <RecordsPanel
        scopeLabel={scopeLabel}
        documents={records.documents}
        loading={records.loading}
        failed={records.failed}
        selectedDocumentId={selectedDocumentId}
        onSelect={actions.selectDocument}
        hasPlace={geo.stateCode !== null}
      />
    </div>
  );
}
