"use client";

import type React from "react";
import type { DocumentSummary } from "@lokdarpan/domain";
import { Button, controlStyles } from "@/components/ui";
import styles from "./explorer.module.css";

/**
 * What LokDarpan actually holds for the selected place.
 *
 * Two statements, and the second is the one that matters. First: the records
 * held, each with how many of its facts a person has verified. Second: that no
 * works register exists for this area — stated as a fact about the published
 * sources, with the source named, rather than left as an empty map the reader
 * has to interpret.
 *
 * An empty map and an unpublished register look identical until something says
 * which one this is.
 */
export function RecordsPanel({
  scopeLabel,
  documents,
  loading,
  failed,
  selectedDocumentId,
  onSelect,
  hasPlace,
}: {
  readonly scopeLabel: string;
  readonly documents: readonly DocumentSummary[];
  readonly loading: boolean;
  readonly failed: boolean;
  readonly selectedDocumentId: number | null;
  readonly onSelect: (documentId: number) => void;
  readonly hasPlace: boolean;
}): React.JSX.Element {
  return (
    <>
      <div className={styles.panel}>
        <div className={styles.panelBody}>
          <h2 className={styles.panelTitle} id="records-heading">
            Records held for {scopeLabel}
          </h2>

          {!hasPlace ? (
            <p style={{ fontSize: 13, color: "var(--ld-text-secondary)", margin: 0 }}>
              Select a state to see the records held for it.
            </p>
          ) : loading ? (
            <p style={{ fontSize: 13, color: "var(--ld-text-secondary)", margin: 0 }} role="status">
              Loading records…
            </p>
          ) : failed ? (
            <p style={{ fontSize: 13, margin: 0 }} role="alert">
              Records could not be loaded. This is a fault here, not an absence of records.
            </p>
          ) : documents.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ld-text-secondary)", margin: 0 }}>
              <span aria-hidden="true">▤ </span>
              No document is recorded against this unit.
            </p>
          ) : (
            <ul
              aria-labelledby="records-heading"
              style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}
            >
              {documents.map((document) => {
                const selected = document.documentId === selectedDocumentId;
                return (
                  <li key={document.documentId}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(document.documentId);
                      }}
                      aria-current={selected ? "true" : undefined}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        font: "inherit",
                        cursor: "pointer",
                        padding: "9px 9px",
                        borderRadius: 8,
                        border: `1px solid ${selected ? "var(--ld-accent)" : "transparent"}`,
                        background: selected ? "var(--ld-accent-soft)" : "transparent",
                      }}
                    >
                      <span
                        style={{ display: "block", fontSize: 13, fontWeight: 550, lineHeight: 1.3 }}
                      >
                        {document.title}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 11.5,
                          color: "var(--ld-text-tertiary)",
                          marginTop: 3,
                        }}
                      >
                        {document.issuingAuthority}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "var(--ld-text-secondary)",
                          marginTop: 4,
                        }}
                      >
                        {document.publishedFacts === 0
                          ? "No facts verified yet"
                          : `${String(document.publishedFacts)} verified fact${document.publishedFacts === 1 ? "" : "s"}`}
                        {document.awaitingReview > 0 &&
                          ` · ${String(document.awaitingReview)} awaiting review`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {hasPlace && <NoWorksRegister />}
    </>
  );
}

/**
 * Why there are no works on the map.
 *
 * This is the honest counterpart to a blank map. Each line names the source
 * checked and what it turned out to hold, so a reader can tell "nobody
 * publishes this" from "LokDarpan has not got to it yet" — and can go and check
 * the claim themselves.
 */
function NoWorksRegister(): React.JSX.Element {
  return (
    <div className={styles.panel}>
      <div className={styles.panelBody}>
        <h2 className={styles.panelTitle}>Works on the map</h2>
        <p style={{ fontSize: 13, color: "var(--ld-text-secondary)", margin: "0 0 10px" }}>
          <span aria-hidden="true">▤ </span>
          None. No register of individual works has been located for this area, so there is nothing
          to draw.
        </p>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: 6,
            fontSize: 11.5,
            color: "var(--ld-text-tertiary)",
          }}
        >
          <li>
            <strong>Works register</strong> — the state PWD site publishes none; its “Projects”
            section is a photo gallery.
          </li>
          <li>
            <strong>Tenders and awards</strong> — the procurement portals gate search and bid awards
            behind a CAPTCHA.
          </li>
          <li>
            <strong>Road geometry</strong> — no government source located.
          </li>
          <li>
            <strong>PMGSY rural roads</strong> — located, but its terms forbid republication.
          </li>
        </ul>
        <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "10px 0 0" }}>
          Recorded in{" "}
          <a
            className={controlStyles.link}
            style={{ fontSize: 11.5 }}
            href="https://github.com/MNikks01/LokDarpan/blob/main/.docs/06-government-sources/data-availability-matrix.md"
            rel="noreferrer noopener"
          >
            the data availability matrix
          </a>
          , with the date each source was checked.
        </p>
      </div>
    </div>
  );
}

export function ResetView({ onReset }: { readonly onReset: () => void }): React.JSX.Element {
  return (
    <Button variant="quiet" onClick={onReset}>
      Back to India
    </Button>
  );
}
