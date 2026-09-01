"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
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

export interface TenderOverview {
  readonly districts: readonly DistrictTenderCount[];
  readonly departments: readonly { readonly name: string; readonly tenderCount: number }[];
  readonly windows: readonly {
    readonly portalCode: string;
    readonly collectingSince: string;
    readonly lastSuccessAt: string | null;
  }[];
  readonly unplacedCount: number;
}

const EMPTY: TenderOverview = { districts: [], departments: [], windows: [], unplacedCount: 0 };

export function useTenderOverview(department: string | null): {
  readonly overview: TenderOverview;
  readonly failed: boolean;
} {
  const [overview, setOverview] = useState<TenderOverview>(EMPTY);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = department === null ? "" : `?department=${encodeURIComponent(department)}`;
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
  }, [department]);

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

export function TendersPanel({
  overview,
  failed,
  department,
  onSelectDepartment,
}: {
  readonly overview: TenderOverview;
  readonly failed: boolean;
  readonly department: string | null;
  readonly onSelectDepartment: (department: string | null) => void;
}): React.JSX.Element {
  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onSelectDepartment(event.target.value === "" ? null : event.target.value);
    },
    [onSelectDepartment],
  );

  const shaded = overview.districts.reduce((sum, d) => sum + d.tenderCount, 0);
  const collected = overview.windows[0];

  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>Open tenders</h2>

        {failed ? (
          <p style={{ fontSize: 12.5, color: "var(--ld-text-secondary)", margin: 0 }}>
            <span aria-hidden="true">▤ </span>
            Tender information is unavailable right now.
          </p>
        ) : (
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
              <strong>{shaded}</strong> open {shaded === 1 ? "tender" : "tenders"} across{" "}
              {overview.districts.length}{" "}
              {overview.districts.length === 1 ? "district" : "districts"}.
            </p>

            {overview.unplacedCount > 0 && (
              <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "6px 0 0" }}>
                <span aria-hidden="true">▤ </span>
                {overview.unplacedCount} further{" "}
                {overview.unplacedCount === 1 ? "tender names" : "tenders name"} no district we
                hold, so {overview.unplacedCount === 1 ? "it is" : "they are"} not shaded here.
              </p>
            )}

            {collected !== undefined && (
              <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "6px 0 0" }}>
                <span aria-hidden="true">▤ </span>
                Collected since {formatDate(collected.collectingSince)}. Tenders advertised before
                that date were published but are not held.
              </p>
            )}
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

export function useTendersFor(
  unitId: number | null,
  department: string | null,
): {
  readonly tenders: readonly TenderSummary[];
  readonly loading: boolean;
} {
  const [tenders, setTenders] = useState<readonly TenderSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (unitId === null) {
      setTenders([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const query = new URLSearchParams({ unit: String(unitId) });
    if (department !== null) query.set("department", department);

    fetch(`/api/v1/tenders?${query.toString()}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((body: { data: { tenders: readonly TenderSummary[] } }) => {
        setTenders(body.data.tenders);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setTenders([]);
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [unitId, department]);

  return { tenders, loading };
}

/** How the district was arrived at, in words a reader can weigh. */
const PLACEMENT_NOTE: Readonly<Record<string, string>> = {
  chain_unit: "The issuing office names this district.",
  office_code: "Read from an office name, which may cover more than one district.",
};

export function TenderList({
  districtName,
  tenders,
  loading,
}: {
  readonly districtName: string;
  readonly tenders: readonly TenderSummary[];
  readonly loading: boolean;
}): React.JSX.Element {
  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>Tenders from offices in {districtName}</h2>

        {loading && <p style={{ fontSize: 12.5, margin: 0 }}>Loading…</p>}

        {!loading && tenders.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--ld-text-secondary)", margin: 0 }}>
            <span aria-hidden="true">▤ </span>
            No open tender from an office in this district is held. Collection began recently, so
            this is a statement about what we hold, not about what was advertised.
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
