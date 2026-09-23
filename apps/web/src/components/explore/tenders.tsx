"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { displayStateOf, type DataState } from "@lokdarpan/domain";
import { notChecked, tenderCopy } from "@/copy/data-state";
import styles from "./explorer.module.css";

/**
 * Tenders on the map.
 *
 * THE CLAIM THIS SURFACE MAKES, AND THE ONE IT MUST NOT
 * A tender is an advertisement of intent to buy — not an award, and not a
 * statement of who was paid. The district is the district of the OFFICE THAT
 * ISSUED it, not the work site: a Chief Engineer's circle office tenders across
 * several districts. Every label here says "offices located in", never "in".
 *
 * WHY THERE ARE NO PINS
 * The portals publish a district, a village name and a pincode. They publish no
 * coordinates. A pin would be an invented point, and a district centroid is an
 * invented point with extra steps — it would drop a road tender in an empty
 * field and look authoritative doing it. Shading the district says exactly what
 * is known and nothing more.
 */

export interface DistrictTenderCount {
  readonly adminUnitId: number;
  readonly districtName: string;
  readonly tenderCount: number;
  readonly departments: readonly string[];
}

/**
 * Whether tenders are collected for a state, which no count can answer.
 *
 * `not_collected` exists so that "we hold none" can never be rendered as "none
 * were advertised". Those are different claims about a government, and only one
 * of them is ours to make.
 */
export type CollectionStatus = "not_collected" | "collected" | "stale" | "failing";

export interface StateCollection {
  readonly stateLgdCode: string;
  readonly status: CollectionStatus;
  readonly portalCode: string | null;
  readonly collectingSince: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastCheckedAt: string | null;
}

export interface TenderOverview {
  readonly districts: readonly DistrictTenderCount[];
  readonly departments: readonly { readonly name: string; readonly tenderCount: number }[];
  readonly windows: readonly {
    readonly portalCode: string;
    readonly collectingSince: string;
    readonly lastSuccessAt: string | null;
    readonly lastCheckedAt: string | null;
    readonly stateLgdCode: string | null;
  }[];
  readonly unplacedCount: number;
  /** Present only when a state is selected. Null means the question was not asked. */
  readonly collection: StateCollection | null;
  /** The same facts in the shared data-state model (ADR-054). What the panel reads. */
  readonly collectionState: DataState | null;
  /** True while the portals' terms keep tender details off the page (ADR-056). */
  readonly detailsWithheld: boolean;
}

const EMPTY: TenderOverview = {
  districts: [],
  departments: [],
  windows: [],
  unplacedCount: 0,
  collection: null,
  collectionState: null,
  detailsWithheld: true,
};

export function useTenderOverview(
  department: string | null,
  stateLgdCode: string | null = null,
): {
  readonly overview: TenderOverview;
  readonly failed: boolean;
} {
  const [overview, setOverview] = useState<TenderOverview>(EMPTY);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (department !== null) params.set("department", department);
    if (stateLgdCode !== null) params.set("state", stateLgdCode);
    const query = params.size === 0 ? "" : `?${params.toString()}`;
    fetch(`/api/v1/tenders/overview${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((body: { data: TenderOverview }) => {
        setOverview(body.data);
        setFailed(false);
      })
      .catch((error: unknown) => {
        // An aborted request is this component moving on, not a failure to
        // report — saying "unavailable" for it would be false.
        if (error instanceof Error && error.name === "AbortError") return;
        setOverview(EMPTY);
        setFailed(true);
      });
    return () => {
      controller.abort();
    };
  }, [department, stateLgdCode]);

  return { overview, failed };
}

/**
 * Put the counts into the boundary features the map already draws.
 *
 * A district with no tenders is left WITHOUT the property rather than given a
 * zero, so the style's `["has", "tenderCount"]` filter leaves it unshaded. A
 * zero would be shaded the palest colour and read as "we looked and found
 * none", which forward-only collection cannot support.
 */
export function withTenderCounts(
  boundaries: FeatureCollection | null,
  districts: readonly DistrictTenderCount[],
): FeatureCollection | null {
  if (boundaries === null) return null;
  if (districts.length === 0) return boundaries;

  const byUnit = new Map(districts.map((d) => [d.adminUnitId, d.tenderCount]));
  return {
    ...boundaries,
    features: boundaries.features.map((feature) => {
      const count = byUnit.get(Number(feature.properties?.["unitId"]));
      if (count === undefined) return feature;
      return { ...feature, properties: { ...feature.properties, tenderCount: count } };
    }),
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * What the panel says when nothing is collected for the selected state.
 *
 * Its own component so the count cannot be rendered beside it. "0 tenders" and
 * this sentence are answers to different questions, and showing both would let
 * a reader take the number as the finding and this as a footnote.
 */
function NotCollected({ stateName }: { readonly stateName: string }): React.JSX.Element {
  return (
    <>
      <p style={{ fontSize: 12.5, margin: 0 }}>
        <span aria-hidden="true">▤ </span>
        {tenderCopy.notCollected(stateName)}
      </p>
      <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "6px 0 0" }}>
        {tenderCopy.notCollectedMeaning(stateName)}
      </p>
    </>
  );
}

/**
 * How many open tenders the shading accounts for.
 *
 * Only ever rendered for a state that is collected. For one that is not, the
 * sum is zero and means nothing about the state, which is why it is computed
 * inside the branch that may show it rather than beside the branch that must
 * not.
 */
function shadedCount(overview: TenderOverview): number {
  return overview.districts.reduce((sum, d) => sum + d.tenderCount, 0);
}

/**
 * Tenders held whose issuing district could not be established.
 *
 * Stated rather than hidden: an unplaced tender is a real advertisement by a
 * real government office, and dropping it because the map has nowhere to draw
 * it would quietly shrink the total a reader is shown.
 */
function Unplaced({
  count,
  showing,
  onToggle,
  canShow,
}: {
  readonly count: number;
  readonly showing: boolean;
  readonly onToggle: () => void;
  /** False while tender details are withheld: there is no list to show. */
  readonly canShow: boolean;
}): React.JSX.Element | null {
  if (count === 0) return null;
  return (
    <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "6px 0 0" }}>
      <span aria-hidden="true">▤ </span>
      {count} further {count === 1 ? "tender names" : "tenders name"} no district we hold, so{" "}
      {count === 1 ? "it is" : "they are"} not shaded here.{" "}
      {canShow ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={showing}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            font: "inherit",
            color: "var(--ld-accent)",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {showing ? "Hide them" : "Show them"}
        </button>
      ) : (
        tenderCopy.unplacedWithheld
      )}
    </p>
  );
}

/**
 * How out of date a collected state's figures are.
 *
 * Only `failing` and `stale` say anything. A stale state that has never once
 * succeeded is not stale data — there is none — and the panel says it has no
 * record of checking instead.
 */
function Freshness({ state }: { readonly state: DataState }): React.JSX.Element | null {
  const style = { fontSize: 11.5, color: "var(--ld-text-secondary)", margin: "6px 0 0" };
  if (state.freshness === "failing") {
    return (
      <p style={style}>
        <span aria-hidden="true">▤ </span>
        {tenderCopy.failing}
        {state.lastSuccessAt !== null && tenderCopy.lastSuccess(formatDate(state.lastSuccessAt))}
      </p>
    );
  }
  if (state.freshness === "stale" && state.lastSuccessAt !== null) {
    return (
      <p style={style}>
        <span aria-hidden="true">▤ </span>
        {tenderCopy.stale(formatDate(state.lastSuccessAt))}
      </p>
    );
  }
  return null;
}

/** A collected portal with no successful collection on record, or a state with no record at all. */
function neverChecked(state: DataState | null): boolean {
  if (state === null) return false;
  return (
    displayStateOf(state, "ok") === "unknown" ||
    (state.freshness === "stale" && state.lastSuccessAt === null)
  );
}

/**
 * What the panel says instead of any count, when a count would be untrue or
 * unavailable. Null when counts may be shown.
 */
function withheldNotice(
  failed: boolean,
  state: DataState | null,
  stateName: string | null,
): React.JSX.Element | null {
  if (failed) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--ld-text-secondary)", margin: 0 }} role="alert">
        <span aria-hidden="true">▤ </span>
        {tenderCopy.unavailable}
      </p>
    );
  }
  if (state?.collection === "not_collected") {
    return <NotCollected stateName={stateName ?? "this state"} />;
  }
  if (stateName !== null && neverChecked(state)) {
    return (
      <p style={{ fontSize: 12.5, margin: 0 }}>
        <span aria-hidden="true">▤ </span>
        {notChecked("its e-procurement portal", stateName)}
      </p>
    );
  }
  return null;
}

/** How current the held tenders are, and the date collection began. */
function CollectionFooter({
  state,
}: {
  readonly state: DataState | null;
}): React.JSX.Element | null {
  if (state === null) return null;
  return (
    <>
      <Freshness state={state} />
      {state.collectingSince !== null && (
        <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "6px 0 0" }}>
          <span aria-hidden="true">▤ </span>
          {tenderCopy.window(formatDate(state.collectingSince))}
        </p>
      )}
    </>
  );
}

export function TendersPanel({
  overview,
  failed,
  department,
  onSelectDepartment,
  showingUnplaced,
  onToggleUnplaced,
  stateName,
}: {
  readonly overview: TenderOverview;
  readonly failed: boolean;
  readonly department: string | null;
  readonly onSelectDepartment: (department: string | null) => void;
  readonly showingUnplaced: boolean;
  readonly onToggleUnplaced: () => void;
  /** The selected state, for a sentence that names it. Null before one is chosen. */
  readonly stateName: string | null;
}): React.JSX.Element {
  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onSelectDepartment(event.target.value === "" ? null : event.target.value);
    },
    [onSelectDepartment],
  );

  // The collection window comes from the state on screen's own collection
  // state — never whichever window row came back first, which once dated every
  // state's figures by one arbitrary portal.
  const { collectionState } = overview;
  const notice = withheldNotice(failed, collectionState, stateName);

  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>Open tenders</h2>

        {notice ?? (
          <>
            <p style={{ fontSize: 12, color: "var(--ld-text-secondary)", margin: "0 0 10px" }}>
              Shading counts tenders advertised by government offices <strong>located in</strong>{" "}
              each district. It does not say where the work will be done — an office often tenders
              for work across several districts.
            </p>

            <label
              htmlFor="tender-department"
              style={{ display: "block", fontSize: 11.5, marginBottom: 4 }}
            >
              Department
            </label>
            <select
              id="tender-department"
              value={department ?? ""}
              onChange={onChange}
              style={{ width: "100%", fontSize: 12.5, padding: "6px 8px" }}
            >
              <option value="">All departments</option>
              {overview.departments.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.tenderCount})
                </option>
              ))}
            </select>

            <p style={{ fontSize: 12, margin: "10px 0 0" }}>
              <strong>{shadedCount(overview)}</strong> open{" "}
              {shadedCount(overview) === 1 ? "tender" : "tenders"} across{" "}
              {overview.districts.length}{" "}
              {overview.districts.length === 1 ? "district" : "districts"}.
            </p>

            <Unplaced
              count={overview.unplacedCount}
              showing={showingUnplaced}
              onToggle={onToggleUnplaced}
              canShow={!overview.detailsWithheld}
            />

            <CollectionFooter state={collectionState} />
          </>
        )}
      </div>
    </div>
  );
}

export interface TenderSummary {
  readonly id: number;
  readonly title: string;
  readonly tenderReference: string;
  readonly department: string | null;
  readonly closingAt: string | null;
  readonly tenderCategory: string | null;
  readonly productCategory: string | null;
  readonly tenderType: string | null;
  readonly location: string | null;
  readonly pincode: string | null;
  readonly tenderValueInr: string | null;
  readonly emdInr: string | null;
  readonly organisationChain: string | null;
  readonly districtName: string | null;
  readonly districtSource: string | null;
  readonly sourceUrl: string;
}

/**
 * Group a rupee figure the Indian way, without ever making it a number.
 *
 * `Intl.NumberFormat` would need a float, and a float loses precision on a
 * large figure silently — behind a correct-looking source link, which is the
 * worst way for a government number to be wrong. The digits arrive as a string
 * from the server and stay one all the way to the screen.
 */
export function groupRupees(value: string): string {
  const [whole = "", fraction] = value.split(".");
  const head = whole.slice(0, -3);
  const tail = whole.slice(-3);
  const grouped = head === "" ? tail : `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
  // Whole rupees are shown whole. ".00" on every figure is noise, not precision.
  return fraction === undefined || fraction === "00" ? grouped : `${grouped}.${fraction}`;
}

export interface TendersFor {
  readonly tenders: readonly TenderSummary[];
  /** How many open tenders are held, whether or not their details may be shown. */
  readonly heldCount: number;
  readonly detailsWithheld: boolean;
  /** The state's portal, which may always be linked to. Null for tenders with no state. */
  readonly portalUrl: string | null;
  readonly loading: boolean;
}

const NO_TENDERS: Omit<TendersFor, "loading"> = {
  tenders: [],
  heldCount: 0,
  detailsWithheld: true,
  portalUrl: null,
};

export function useTendersFor(
  unitId: number | null,
  department: string | null,
  unplaced = false,
): TendersFor {
  const [result, setResult] = useState<Omit<TendersFor, "loading">>(NO_TENDERS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (unitId === null && !unplaced) {
      setResult(NO_TENDERS);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const query = new URLSearchParams();
    if (unitId !== null) query.set("unit", String(unitId));
    if (unplaced) query.set("unplaced", "true");
    if (department !== null) query.set("department", department);

    fetch(`/api/v1/tenders?${query.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((body: { data: Omit<TendersFor, "loading"> }) => {
        setResult(body.data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setResult(NO_TENDERS);
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [unitId, department, unplaced]);

  return { ...result, loading };
}

/** How the district was arrived at, in words a reader can weigh. */
const PLACEMENT_NOTE: Readonly<Record<string, string>> = {
  chain_unit: "The issuing office names this district.",
  office_code: "Read from an office name, which may cover more than one district.",
};

/**
 * What stands in for the list while tender details are withheld: how many are
 * held, why nothing more is shown, and where to read them. Linking to a portal
 * needs no permission under its terms; reproducing its tenders does (ADR-056).
 */
function WithheldTenders({
  heldCount,
  portalUrl,
}: {
  readonly heldCount: number;
  readonly portalUrl: string | null;
}): React.JSX.Element {
  return (
    <>
      <p style={{ fontSize: 12.5, margin: 0 }}>
        <span aria-hidden="true">▤ </span>
        {tenderCopy.heldHere(heldCount)}
      </p>
      <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "6px 0 0" }}>
        {tenderCopy.detailsWithheld}
      </p>
      {portalUrl !== null && (
        <a
          href={portalUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{ display: "inline-block", fontSize: 12, marginTop: 8 }}
        >
          {tenderCopy.portalLink}
        </a>
      )}
    </>
  );
}

export function TenderList({
  heading,
  tenders,
  loading,
  collectingSince = null,
  detailsWithheld = false,
  heldCount = tenders.length,
  portalUrl = null,
}: {
  /** Stated by the caller, because a placed list and an unplaced one are
   *  different claims and neither should be phrased as the other. */
  readonly heading: string;
  readonly tenders: readonly TenderSummary[];
  readonly loading: boolean;
  /** When collection began for the state on screen, so an empty list can say what it cannot cover. */
  readonly collectingSince?: string | null;
  readonly detailsWithheld?: boolean;
  readonly heldCount?: number;
  readonly portalUrl?: string | null;
}): React.JSX.Element {
  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>{heading}</h2>

        {loading && <p style={{ fontSize: 12.5, margin: 0 }}>Loading…</p>}

        {!loading && detailsWithheld && heldCount > 0 && (
          <WithheldTenders heldCount={heldCount} portalUrl={portalUrl} />
        )}

        {!loading && heldCount === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--ld-text-secondary)", margin: 0 }}>
            <span aria-hidden="true">▤ </span>
            {tenderCopy.emptyHere}
            {collectingSince !== null && tenderCopy.notHeldBefore(formatDate(collectingSince))}
          </p>
        )}

        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {tenders.map((tender) => (
            <li key={tender.id} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600 }}>{tender.title}</span>
              <span style={{ display: "block", color: "var(--ld-text-secondary)" }}>
                {tender.department ?? "Department not stated"}
                {tender.tenderCategory !== null && ` · ${tender.tenderCategory}`}
              </span>
              <span style={{ display: "block", color: "var(--ld-text-tertiary)", fontSize: 11.5 }}>
                Ref {tender.tenderReference}
                {tender.closingAt !== null &&
                  ` · closes ${new Date(tender.closingAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}`}
              </span>
              {tender.tenderValueInr !== null && (
                <span style={{ display: "block", fontSize: 12 }}>
                  Value ₹{groupRupees(tender.tenderValueInr)}
                </span>
              )}
              {tender.tenderValueInr === null && (
                <span
                  style={{ display: "block", color: "var(--ld-text-tertiary)", fontSize: 11.5 }}
                >
                  <span aria-hidden="true">▤ </span>
                  No value published for this tender.
                </span>
              )}
              {tender.location !== null && (
                <span
                  style={{ display: "block", color: "var(--ld-text-tertiary)", fontSize: 11.5 }}
                >
                  {tender.location}
                  {tender.pincode !== null && ` · ${tender.pincode}`}
                </span>
              )}
              {tender.districtSource !== null && (
                <span style={{ display: "block", color: "var(--ld-text-tertiary)", fontSize: 11 }}>
                  {PLACEMENT_NOTE[tender.districtSource] ?? ""}
                </span>
              )}
              <a
                href={tender.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                style={{ fontSize: 11.5 }}
              >
                Source: the portal this was read from
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
