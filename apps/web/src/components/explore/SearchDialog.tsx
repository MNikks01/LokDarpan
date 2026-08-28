"use client";

import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchResult, SearchResultKind } from "@lokdarpan/domain";
import { Skeleton, controlStyles } from "@/components/ui";
import styles from "./explorer.module.css";

const GROUP_ORDER: readonly SearchResultKind[] = ["place", "record"];
const GROUP_LABEL: Readonly<Record<SearchResultKind, string>> = {
  place: "Places",
  record: "Records",
};

/**
 * Search across places and records.
 *
 * Runs against `/api/v1/search`, not against what the page has already loaded.
 * Filtering a loaded array would work today and stop working at the first real
 * dataset — the explorer holds one level of one place at a time by design — and
 * the shape of the call is what the endpoint needs anyway. The request is
 * debounced and the previous one aborted, so a fast typist makes one query
 * rather than eight.
 *
 * Results are grouped by kind rather than merged, because "Nagpur" legitimately
 * means the district, the municipal body, or the audit report named after the
 * office there. Offering all three and saying which is which lets the reader
 * choose; ranking them into one list would be guessing on their behalf.
 */
export function SearchDialog({
  open,
  onClose,
  onSelectPlace,
  onSelectRecord,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSelectPlace: (result: SearchResult) => void;
  readonly onSelectRecord: (documentId: number) => void;
}): React.JSX.Element | null {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("search failed");
          return (await response.json()) as { data: { results: SearchResult[] } };
        })
        .then((body) => {
          setResults(body.data.results);
          setFailed(false);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setFailed(true);
          setLoading(false);
        });
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, term]);

  if (!open) return null;

  const grouped = GROUP_ORDER.map((kind) => ({
    kind,
    items: results.filter((r) => r.kind === kind),
  })).filter((group) => group.items.length > 0);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgb(20 24 26 / 28%)",
        zIndex: 20,
        display: "grid",
        justifyItems: "center",
        alignItems: "start",
        paddingTop: "8vh",
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search places and records"
        className={styles.panel}
        style={{ width: "min(560px, calc(100vw - 32px))", overflow: "hidden" }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid var(--ld-hair)" }}>
          <label htmlFor={`${listId}-input`} className={controlStyles.label}>
            Search places and records
          </label>
          <input
            id={`${listId}-input`}
            ref={inputRef}
            type="search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
            }}
            placeholder="A district, a municipal body, an audit report…"
            autoComplete="off"
            aria-controls={listId}
            style={{
              width: "100%",
              font: "inherit",
              fontSize: 15,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--ld-border-strong)",
              background: "var(--ld-surface)",
              color: "var(--ld-text)",
            }}
          />
        </div>

        <div id={listId} style={{ maxHeight: "52vh", overflowY: "auto", padding: 8 }}>
          {loading && (
            <div style={{ display: "grid", gap: 6, padding: 6 }} aria-hidden="true">
              <Skeleton height={16} width="60%" />
              <Skeleton height={16} width="80%" />
            </div>
          )}
          {failed && (
            <p style={{ fontSize: 13, padding: 10, margin: 0 }} role="alert">
              Search is unavailable. The place selectors still work.
            </p>
          )}
          {!loading && !failed && term.trim().length >= 2 && grouped.length === 0 && (
            <p style={{ fontSize: 13, padding: 10, margin: 0, color: "var(--ld-text-secondary)" }}>
              Nothing held matches “{term.trim()}”. Only places and records already ingested are
              searchable.
            </p>
          )}
          {!loading &&
            grouped.map((group) => (
              <section key={group.kind} style={{ marginBottom: 6 }}>
                <h3 className={styles.panelTitle} style={{ padding: "6px 8px 2px", margin: 0 }}>
                  {GROUP_LABEL[group.kind]}
                </h3>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {group.items.map((result) => (
                    <li key={`${result.kind}-${String(result.id)}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (result.kind === "record") onSelectRecord(result.id);
                          else onSelectPlace(result);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          font: "inherit",
                          cursor: "pointer",
                          border: 0,
                          background: "transparent",
                          padding: "7px 9px",
                          borderRadius: 7,
                        }}
                      >
                        <span style={{ display: "block", fontSize: 13.5 }}>{result.title}</span>
                        <span style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)" }}>
                          {result.subtitle}
                          {result.context !== null && ` · ${result.context}`}
                          {result.kind === "place" && !result.hasBoundary && " · no boundary held"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}
