"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { shareCopy } from "@/copy/share";
import { useWatermark } from "@/lib/use-resource";
import { toQueryString, type ExplorerState } from "@/state/explorer-url";
import styles from "./explorer.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * "Link to this exact view": the address bar's link plus the dataset version
 * the page was drawn from.
 *
 * The address bar never carries a version. A reader who copies it shares a
 * place; one who uses this shares a place as LokDarpan held it, and whoever
 * opens it is told if the ledger has moved on since (ADR-061).
 */
export function CopyViewLink({ state }: { readonly state: ExplorerState }): React.JSX.Element {
  const watermark = useWatermark();
  const [outcome, setOutcome] = useState<{ readonly ok: boolean; readonly link: string } | null>(
    null,
  );

  const copy = (): void => {
    const query = toQueryString({ ...state, pinnedVersion: watermark > 0 ? watermark : null });
    const link = `${window.location.origin}${window.location.pathname}?${query}`;
    navigator.clipboard.writeText(link).then(
      () => {
        setOutcome({ ok: true, link });
      },
      () => {
        setOutcome({ ok: false, link });
      },
    );
  };

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <Button onClick={copy}>
        <span aria-hidden="true">⧉</span> {shareCopy.copyLink}
      </Button>
      <p role="status" className={styles.linkStatus} hidden={outcome === null}>
        {outcome?.ok === true && shareCopy.copied}
        {outcome?.ok === false && (
          <>
            {shareCopy.copyFailed}
            <input
              readOnly
              value={outcome.link}
              aria-label="Link to this view"
              onFocus={(event) => {
                event.currentTarget.select();
              }}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </>
        )}
      </p>
    </div>
  );
}

/**
 * What a pinned link's reader is told. Nothing until the page has read its
 * first response, since until then the current version is not known.
 */
export function PinNotice({
  pinnedVersion,
  pinnedAt,
}: {
  readonly pinnedVersion: number | null;
  readonly pinnedAt: string | null;
}): React.JSX.Element | null {
  const watermark = useWatermark();
  if (pinnedVersion === null || pinnedAt === null || watermark === 0) return null;
  const date = formatDate(pinnedAt);
  return (
    <p className={styles.notice} role="note">
      <span aria-hidden="true">◇</span>
      {watermark === pinnedVersion
        ? shareCopy.pinnedSame(pinnedVersion, date)
        : shareCopy.pinnedChanged(pinnedVersion, date, watermark)}
    </p>
  );
}
