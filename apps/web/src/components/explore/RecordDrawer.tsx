"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { byPage, type DocumentFactsView } from "@lokdarpan/domain";
import { FactCard, Scope } from "@/components/PublishedFacts";
import { Button, Skeleton, controlStyles } from "@/components/ui";
import { cx } from "@/ui/cx";
import styles from "./explorer.module.css";

/**
 * One source document, and the facts a person has verified in it.
 *
 * It renders `FactCard` and `Scope` — the same components the standalone
 * document page uses — rather than a second presentation of the same facts.
 * The wording on those cards is the part most worth keeping identical: two
 * surfaces describing the same verified fact differently is how a caveat gets
 * lost.
 */
export function RecordDrawer({
  documentId,
  onClose,
}: {
  readonly documentId: number;
  readonly onClose: () => void;
}): React.JSX.Element {
  const [view, setView] = useState<DocumentFactsView | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [entering, setEntering] = useState(true);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusTo.current = document.activeElement;
    const frame = requestAnimationFrame(() => {
      setEntering(false);
      headingRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      const target = returnFocusTo.current;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    setView(null);
    setFailure(null);

    fetch(`/api/v1/documents/${String(documentId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("This record could not be loaded.");
        return (await response.json()) as { data: DocumentFactsView };
      })
      .then((body) => {
        setView(body.data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailure(error instanceof Error ? error.message : "This record could not be loaded.");
      });

    return () => {
      controller.abort();
    };
  }, [documentId]);

  return (
    <aside
      className={cx(styles.drawer, entering && styles.drawerEntering)}
      role="dialog"
      aria-modal="false"
      aria-label={view?.title ?? "Record"}
    >
      <div className={styles.drawerHeader}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontSize: 10.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ld-text-tertiary)",
              margin: "0 0 4px",
              fontWeight: 650,
            }}
          >
            Source document
          </p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            style={{ fontSize: 18, lineHeight: 1.25, margin: 0, outline: "none" }}
          >
            {view?.title ?? "Loading…"}
          </h2>
          {view !== null && (
            <p style={{ fontSize: 12.5, color: "var(--ld-text-secondary)", margin: "6px 0 0" }}>
              {view.provenance.issuingAuthority}
            </p>
          )}
        </div>
        <Button variant="quiet" onClick={onClose} ariaLabel="Close record">
          <span aria-hidden="true">✕</span>
        </Button>
      </div>

      <div className={styles.drawerScroll}>
        <RecordBody view={view} failure={failure} />
        {view !== null && (
          <p style={{ margin: "18px 0 0" }}>
            <Link className={controlStyles.link} href={`/documents/${String(documentId)}`}>
              Open the full record <span aria-hidden="true">→</span>
            </Link>
          </p>
        )}
      </div>
    </aside>
  );
}

function RecordBody({
  view,
  failure,
}: {
  readonly view: DocumentFactsView | null;
  readonly failure: string | null;
}): React.JSX.Element {
  if (failure !== null) {
    return (
      <p role="alert" style={{ padding: "20px 0", fontSize: 13.5 }}>
        {failure}
      </p>
    );
  }

  if (view === null) {
    return (
      <div style={{ display: "grid", gap: 10, padding: "20px 0" }} role="status">
        <span className="sr-only">Loading record</span>
        <Skeleton height={14} width="60%" />
        <Skeleton height={14} width="90%" />
        <Skeleton height={14} width="75%" />
      </div>
    );
  }

  const pages = byPage(view.facts);

  return (
    <>
      <div style={{ marginTop: 14 }}>
        <Scope view={view} />
      </div>

      {pages.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--ld-text-secondary)", marginTop: 18 }}>
          <span aria-hidden="true">▤ </span>
          Nothing in this document has been verified yet, so nothing from it is shown. Its
          candidates are extracted and awaiting review.
        </p>
      ) : (
        pages.map((page) => (
          <section key={page.pageNumber} style={{ marginTop: 18 }}>
            <h3 className={styles.sectionTitle}>Page {page.pageNumber}</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {page.facts.map((fact) => (
                <FactCard key={fact.id} fact={fact} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
