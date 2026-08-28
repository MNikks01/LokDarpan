"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DistrictSummary, StateSummary } from "@/domain/geography";
import { Button, controlStyles } from "@/components/ui";
import { cx } from "@/ui/cx";
import { useExplorerState, type ExplorerState } from "@/state/useExplorerState";
import { Breadcrumb } from "./Breadcrumb";
import { FilterPanel } from "./FilterPanel";
import { MapCanvas, type MapHandle } from "./MapCanvas";
import { MapControls } from "./MapControls";
import { RecordDrawer } from "./RecordDrawer";
import { RecordsPanel } from "./RecordsPanel";
import { DEFAULT_LAYERS, type LayerVisibility } from "./layer-visibility";
import { useDistricts, useRecords } from "./use-explorer-data";
import styles from "./explorer.module.css";

const DRAWER_WIDTH = 428;
/** Matches `.rail` in explorer.module.css, plus its 12px gutters. */
const RAIL_WIDTH = 320;

export interface ExploreShellProps {
  readonly states: readonly StateSummary[];
  readonly initialState: ExplorerState;
}

/**
 * The explorer.
 *
 * Everything on this surface is a real record or a real boundary. There is no
 * works layer, because no register of works has been located for any area — the
 * map shows administrative geography, and the panel shows the documents the
 * ledger holds for the selected unit, with the absence of works stated rather
 * than left as an empty map to interpret.
 */
export function ExploreShell({ states, initialState }: ExploreShellProps): React.JSX.Element {
  const { geo, selectedDocumentId, actions } = useExplorerState(initialState);

  const { districts, loading: loadingDistricts } = useDistricts(geo.stateCode);
  // The map's state codes ARE LGD codes, so the selection addresses the ledger
  // directly with no name matching in between.
  const records = useRecords(geo.stateCode);

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

  const state = useMemo(
    () => states.find((s) => s.code === geo.stateCode) ?? null,
    [geo.stateCode, states],
  );
  const district = useMemo(
    () => districts.find((d) => d.id === geo.districtId) ?? null,
    [districts, geo.districtId],
  );

  const onSelectLevel = useCallback(
    (level: "country" | "state" | "district") => {
      if (level === "country") actions.selectState(null);
      else if (level === "state") actions.selectDistrict(null);
    },
    [actions],
  );

  const drawerInset = selectedDocumentId !== null && !compact ? DRAWER_WIDTH : 0;
  const insets = useMemo(
    () => ({ left: compact ? 0 : RAIL_WIDTH, right: drawerInset }),
    [compact, drawerInset],
  );
  const scopeLabel = district?.name ?? state?.name ?? "India";

  return (
    <div
      className={styles.shell}
      style={{ ["--ld-drawer-width" as string]: `${String(DRAWER_WIDTH)}px` }}
    >
      <ExplorerHeader state={state} district={district} onSelectLevel={onSelectLevel} />

      <p className={styles.notice}>
        <span aria-hidden="true">◆</span>
        Official records only. Every figure shown has been checked by a person against the page it
        was read from.
      </p>

      <div className={styles.stage}>
        <MapCanvas
          geo={geo}
          state={state}
          district={district}
          states={states}
          districts={districts}
          layers={layers}
          insets={insets}
          compact={compact}
          handleRef={mapHandle}
          onSelectState={actions.selectState}
          onSelectDistrict={actions.selectDistrict}
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

        <div
          id="explorer-rail"
          className={cx(styles.rail, compact && !railOpen && styles.railCollapsed)}
        >
          <FilterPanel
            states={states}
            districts={districts}
            geo={geo}
            actions={actions}
            loadingDistricts={loadingDistricts}
          />
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

/**
 * The application bar: identity, where you are, and the way out to the records
 * index. Split out because the shell's job is orchestration.
 */
function ExplorerHeader({
  state,
  district,
  onSelectLevel,
}: {
  readonly state: StateSummary | null;
  readonly district: DistrictSummary | null;
  readonly onSelectLevel: (level: "country" | "state" | "district") => void;
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
      <Breadcrumb state={state} district={district} onSelectLevel={onSelectLevel} />
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
