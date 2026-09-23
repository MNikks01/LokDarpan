"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FeatureCollection } from "geojson";
import type { GeoUnit, SearchResult } from "@lokdarpan/domain";
import type { StateOption } from "@/data/geography";
import { Button, controlStyles } from "@/components/ui";
import { cx } from "@/ui/cx";
import { useExplorerState, type ExplorerState } from "@/state/useExplorerState";
import { Breadcrumb } from "./Breadcrumb";
import { FilterPanel } from "./FilterPanel";
import { CopyViewLink, PinNotice } from "./ViewLink";
import { MARK, mark } from "@/lib/perf-marks";
import dynamic from "next/dynamic";
import type { MapCanvasProps, MapHandle } from "./MapCanvas";
import { MapControls } from "./MapControls";
import { RecordDrawer } from "./RecordDrawer";
import { RecordsPanel } from "./RecordsPanel";
import { SearchDialog } from "./SearchDialog";
import { BoundarySources } from "./BoundarySources";
import {
  TenderList,
  TendersPanel,
  useTenderOverview,
  useTendersFor,
  withTenderCounts,
} from "./tenders";
import { useExplorerGeography, type LevelCoverage, type RecordsState } from "./use-explorer-data";
import styles from "./explorer.module.css";

/**
 * The map, loaded after the page is interactive (ADR-062).
 *
 * MapLibre was 266 KB of the explorer's ~405 KB of initial JavaScript, and the
 * rail — the list-first path to every place, which needs no map — waited for
 * all of it before it would answer a tap. Split out, the rail hydrates first
 * and the renderer arrives behind it. Never server-rendered: it needs WebGL.
 *
 * Starting the download when this module runs, instead of at render, was
 * measured and not kept: it saved ~300 ms on a throttled phone and cost ~500 ms
 * on a desktop, where evaluating the renderer competed with hydration (ADR-062).
 */
const MapCanvas = dynamic(() => import("./MapCanvas").then((module) => module.MapCanvas), {
  ssr: false,
  loading: () => <div className={styles.map} aria-busy="true" />,
});

const DRAWER_WIDTH = 428;
/** Matches `.rail` in explorer.module.css, plus its 12px gutters. */
const RAIL_WIDTH = 320;

export interface OutlineSource {
  readonly name: string;
  readonly attribution: string;
  readonly licence: string;
}

export interface ExploreShellProps {
  readonly states: readonly StateOption[];
  readonly initialState: ExplorerState;
  /** When the dataset version a pinned link names was opened. Null without a pin. */
  readonly pinnedAt: string | null;
  /** Credit for the country-view outlines. ODbL requires it be shown. */
  readonly outlineSource: OutlineSource;
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
interface TenderLayer {
  readonly overview: ReturnType<typeof useTenderOverview>["overview"];
  readonly failed: boolean;
  readonly department: string | null;
  readonly setDepartment: (department: string | null) => void;
  readonly shadedBoundaries: FeatureCollection | null;
  /** What the map's tender layer needs to decide whether it may draw. */
  readonly mapTenders: MapCanvasProps["tenders"];
  readonly unitTenders: ReturnType<typeof useTendersFor>;
  readonly showingUnplaced: boolean;
  readonly toggleUnplaced: () => void;
  readonly unplacedTenders: ReturnType<typeof useTendersFor>["tenders"];
}

/**
 * The tender layer's state, gathered so the shell keeps orchestrating rather
 * than accumulating one feature's bookkeeping.
 *
 * The counts ride along inside the boundary features the map already draws, so
 * there is no second source and no feature-state to keep in step. Selecting a
 * unit lists its tenders through the explorer's existing click routing, which
 * means a shaded district is clickable without a separate target to discover.
 */
function useTenderLayer(
  unitId: number | null,
  childBoundaries: FeatureCollection | null,
  stateLgdCode: string | null,
  // In the URL (ADR-061), so a shared link keeps the narrowing.
  {
    department,
    setDepartment,
  }: {
    readonly department: string | null;
    readonly setDepartment: (department: string | null) => void;
  },
): TenderLayer {
  const [showingUnplaced, setShowingUnplaced] = useState(false);
  // The state travels with the request so the panel can say whether tenders are
  // collected for it at all. Without it the only available answer was a count,
  // and a count cannot distinguish "none held" from "none advertised".
  const { overview, failed } = useTenderOverview(department, stateLgdCode);
  const unitTenders = useTendersFor(unitId, department);
  // Fetched only once asked for: the panel states the count from the overview,
  // so the list itself is a second question the reader may never put.
  const { tenders: unplacedTenders } = useTendersFor(
    null,
    department,
    showingUnplaced,
    stateLgdCode,
  );
  const toggleUnplaced = useCallback(() => {
    setShowingUnplaced((showing) => !showing);
  }, []);

  const shadedBoundaries = useMemo(
    () => withTenderCounts(childBoundaries, overview.districts),
    [childBoundaries, overview.districts],
  );

  const { sources, collectionState } = overview;
  const mapTenders = useMemo(
    () => (failed ? null : { sources, state: collectionState }),
    [collectionState, failed, sources],
  );

  return {
    overview,
    failed,
    mapTenders,
    department,
    setDepartment,
    shadedBoundaries,
    unitTenders,
    showingUnplaced,
    toggleUnplaced,
    unplacedTenders,
  };
}

export function ExploreShell({
  states,
  initialState,
  pinnedAt,
  outlineSource,
}: ExploreShellProps): React.JSX.Element {
  const explorer = useExplorerState(initialState);

  useEffect(() => {
    mark(MARK.hydrated);
  }, []);
  const { geo, selectedDocumentId, layers, department, pinnedVersion, actions } = explorer;

  const {
    selectedState,
    units,
    coverage,
    loadingChildren,
    childBoundaries,
    activeUnit,
    activeGeometry,
    ancestors,
    records,
    scopeLabel,
  } = useExplorerGeography(states, geo.stateCode, geo.unitId);

  const tenderState = useTenderLayer(geo.unitId, childBoundaries, geo.stateCode, {
    department,
    setDepartment: actions.selectDepartment,
  });

  const [layersOpen, setLayersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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

  /**
   * A search result becomes a geographic selection.
   *
   * Both the state and the unit are set together: a unit id alone would leave
   * the state selector empty and the records panel scoped to nowhere, so the
   * reader would arrive at the right place with the wrong context around it.
   */
  const onSelectPlace = useCallback(
    (result: SearchResult) => {
      setSearchOpen(false);
      actions.selectPlace(result.stateCode, result.hasBoundary ? result.id : null);
    },
    [actions],
  );

  const onSelectRecord = useCallback(
    (documentId: number) => {
      setSearchOpen(false);
      actions.selectDocument(documentId);
    },
    [actions],
  );

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
        onOpenSearch={() => {
          setSearchOpen(true);
        }}
      />
      <div>
        <p className={styles.notice}>
          <span aria-hidden="true">◆</span>
          Official records only. Every figure shown has been checked by a person against the page it
          was read from.
        </p>
        <PinNotice pinnedVersion={pinnedVersion} pinnedAt={pinnedAt} />
      </div>

      <div className={styles.stage}>
        <MapCanvas
          stateCode={geo.stateCode}
          stateBbox={selectedState?.bbox ?? null}
          activeUnit={activeUnit}
          activeGeometry={activeGeometry}
          childBoundaries={tenderState.shadedBoundaries}
          tenders={tenderState.mapTenders}
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
          records={records}
          scopeLabel={scopeLabel}
          selectedDocumentId={selectedDocumentId}
          outlineSource={outlineSource}
          tenderState={tenderState}
          selectedState={selectedState}
          coverage={coverage}
          activeUnit={activeUnit}
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
            onToggleLayer={actions.toggleLayer}
          />
          <CopyViewLink state={explorer} />
        </div>

        <SearchDialog
          open={searchOpen}
          onClose={() => {
            setSearchOpen(false);
          }}
          onSelectPlace={onSelectPlace}
          onSelectRecord={onSelectRecord}
        />

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
  onOpenSearch,
}: {
  readonly stateName: string | null;
  readonly ancestors: readonly GeoUnit[];
  readonly onSelectLevel: (unitId: number | null) => void;
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
      <Breadcrumb stateName={stateName} ancestors={ancestors} onSelectLevel={onSelectLevel} />
      <span className={styles.headerSpacer} />
      <Button onClick={onOpenSearch}>
        <span aria-hidden="true">⌕</span> Search
      </Button>
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
  records,
  scopeLabel,
  selectedDocumentId,
  outlineSource,
  tenderState,
  activeUnit,
  selectedState,
  coverage,
}: {
  readonly hidden: boolean;
  readonly states: readonly StateOption[];
  readonly units: readonly GeoUnit[];
  readonly geo: ReturnType<typeof useExplorerState>["geo"];
  readonly actions: ReturnType<typeof useExplorerState>["actions"];
  readonly loadingChildren: boolean;
  readonly ancestors: readonly GeoUnit[];
  readonly records: RecordsState;
  readonly scopeLabel: string;
  readonly selectedDocumentId: number | null;
  readonly outlineSource: OutlineSource;
  readonly tenderState: TenderLayer;
  readonly activeUnit: GeoUnit | null;
  readonly selectedState: StateOption | null;
  readonly coverage: readonly LevelCoverage[];
}): React.JSX.Element {
  return (
    <div id="explorer-rail" className={cx(styles.rail, hidden && styles.railCollapsed)}>
      <FilterPanel
        states={states}
        units={units}
        coverage={coverage}
        geo={geo}
        actions={actions}
        loading={loadingChildren}
        ancestors={ancestors}
      />
      <TendersPanel
        overview={tenderState.overview}
        failed={tenderState.failed}
        department={tenderState.department}
        onSelectDepartment={tenderState.setDepartment}
        showingUnplaced={tenderState.showingUnplaced}
        onToggleUnplaced={tenderState.toggleUnplaced}
        stateName={selectedState === null ? null : selectedState.name}
      />
      {tenderState.showingUnplaced && (
        <TenderList
          heading="Tenders we could not place"
          tenders={tenderState.unplacedTenders}
          loading={false}
        />
      )}
      {activeUnit !== null && (
        <TenderList
          heading={`Tenders from offices in ${activeUnit.name}`}
          tenders={tenderState.unitTenders.tenders}
          loading={tenderState.unitTenders.loading}
          detailsWithheld={tenderState.unitTenders.detailsWithheld}
          heldCount={tenderState.unitTenders.heldCount}
          portalUrl={tenderState.unitTenders.portalUrl}
          collectingSince={tenderState.overview.collectionState?.collectingSince ?? null}
        />
      )}
      <BoundarySources units={units} outlineSource={outlineSource} />
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
