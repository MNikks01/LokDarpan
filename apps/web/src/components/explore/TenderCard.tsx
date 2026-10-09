"use client";

import type React from "react";

import type { TenderRecord } from "@lokdarpan/domain";

import { TenderPanel, TenderWithheld } from "@/components/TenderPanel";
import { tenderCopy, tenderExploreCopy } from "@/copy/tender";
import { useResource } from "@/lib/use-resource";
import styles from "./explorer.module.css";

type Loaded =
  | { readonly withheld: true; readonly portalUrl: string | null }
  | { readonly withheld: false; readonly record: TenderRecord };

/**
 * One tender's record inside the side panel, like a place card on a map app,
 * with a way back to the list it was opened from (ADR-079).
 */
export function TenderCard({
  tenderId,
  onBack,
}: {
  readonly tenderId: number;
  readonly onBack: () => void;
}): React.JSX.Element {
  const { data, failed } = useResource<Loaded>(`/api/v1/tenders/${String(tenderId)}`);
  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
              border: 0,
              padding: 0,
              cursor: "pointer",
              color: "var(--ld-text)",
              textDecoration: "underline",
            }}
          >
            ← {tenderExploreCopy.back}
          </button>
          <a href={`/tenders/${String(tenderId)}`}>{tenderExploreCopy.fullPage}</a>
        </div>
        {failed && <p style={{ fontSize: 13, margin: 0 }}>{tenderCopy.unavailable}</p>}
        {!failed && data === null && (
          <p style={{ fontSize: 13, margin: 0 }}>{tenderExploreCopy.loading}</p>
        )}
        {data?.withheld === true && <TenderWithheld portalUrl={data.portalUrl} />}
        {data?.withheld === false && <TenderPanel record={data.record} />}
      </div>
    </div>
  );
}
