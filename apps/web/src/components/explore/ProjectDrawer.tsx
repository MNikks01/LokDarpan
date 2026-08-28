"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { ProjectDossier } from "@/data/repositories";
import type { ProjectSummary } from "@/domain/project";
import { Badge, Button, Skeleton } from "@/components/ui";
import { PROJECT_STATUS } from "@/ui/status";
import { cx } from "@/ui/cx";
import { DEMO_DATA_NOTICE } from "@/data/demo/notice";
import { ContractorSection } from "./sections/ContractorSection";
import { DocumentsSection } from "./sections/DocumentsSection";
import { GovernmentSection } from "./sections/GovernmentSection";
import { ProcurementSection } from "./sections/ProcurementSection";
import { ProjectOverview } from "./sections/ProjectOverview";
import { ProjectTimeline } from "./sections/ProjectTimeline";
import { RelatedEntities } from "./sections/RelatedEntities";
import { SourcesSection } from "./sections/SourcesSection";
import styles from "./explorer.module.css";

/**
 * The detail panel.
 *
 * Sections, not tabs. The brief allows tabs when the content grows, but the
 * whole point of this screen is that a reader can follow one record from what
 * was built to who was named in it without deciding which tab hides the next
 * fact. Tabs would also break Ctrl-F and printing.
 *
 * The panel loads its own payload so the map stays live while it does — a
 * spinner over the whole application for one record would throw away the
 * geographic context the reader just built.
 */
export function ProjectDrawer({
  projectId,
  summary,
  onClose,
  onFilterByContractor,
  onFilterByDepartment,
}: {
  readonly projectId: string;
  readonly summary: ProjectSummary | null;
  readonly onClose: () => void;
  readonly onFilterByContractor: (companyId: string) => void;
  readonly onFilterByDepartment: (departmentId: string) => void;
}): React.JSX.Element {
  const [dossier, setDossier] = useState<ProjectDossier | null>(null);
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
    setDossier(null);
    setFailure(null);

    fetch(`/api/v1/projects/${encodeURIComponent(projectId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) throw new Error("This work is not in the records held.");
        if (!response.ok) throw new Error("The record could not be loaded.");
        return (await response.json()) as { data: ProjectDossier };
      })
      .then((body) => {
        setDossier(body.data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailure(error instanceof Error ? error.message : "The record could not be loaded.");
      });

    return () => {
      controller.abort();
    };
  }, [projectId]);

  const presentation = summary === null ? null : PROJECT_STATUS[summary.status];

  return (
    <aside
      className={cx(styles.drawer, entering && styles.drawerEntering)}
      role="dialog"
      aria-modal="false"
      aria-label={summary?.name ?? "Work details"}
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
            Work details
          </p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            style={{ fontSize: 18, lineHeight: 1.25, margin: "0 0 8px", outline: "none" }}
          >
            {summary?.name ?? dossier?.project.name ?? "Loading…"}
          </h2>
          {presentation !== null && (
            <Badge
              glyph={presentation.glyph}
              label={presentation.label}
              background={presentation.badgeBg}
              foreground={presentation.badgeFg}
            />
          )}
        </div>
        <Button variant="quiet" onClick={onClose} ariaLabel="Close work details">
          <span aria-hidden="true">✕</span>
        </Button>
      </div>

      <div className={styles.drawerScroll}>
        <p
          style={{
            fontSize: 11.5,
            background: "var(--ld-band-high-bg)",
            color: "var(--ld-band-high-fg)",
            padding: "7px 9px",
            borderRadius: 8,
            margin: "12px 0 0",
          }}
        >
          {DEMO_DATA_NOTICE}
        </p>
        <DrawerBody
          dossier={dossier}
          failure={failure}
          onFilterByContractor={onFilterByContractor}
          onFilterByDepartment={onFilterByDepartment}
        />
      </div>
    </aside>
  );
}

/**
 * The panel's contents in their three states: failed, loading, loaded.
 *
 * Separated from the drawer chrome so the shell owns focus, the escape key and
 * the animation, and this owns what the reader came for. It also keeps each
 * function small enough to read in one screen.
 */
function DrawerBody({
  dossier,
  failure,
  onFilterByContractor,
  onFilterByDepartment,
}: {
  readonly dossier: ProjectDossier | null;
  readonly failure: string | null;
  readonly onFilterByContractor: (companyId: string) => void;
  readonly onFilterByDepartment: (departmentId: string) => void;
}): React.JSX.Element {
  if (failure !== null) {
    return (
      <p role="alert" style={{ padding: "20px 0", fontSize: 13.5 }}>
        {failure}
      </p>
    );
  }

  if (dossier === null) {
    return (
      <div style={{ display: "grid", gap: 10, padding: "20px 0" }} role="status">
        <span className="sr-only">Loading work details</span>
        <Skeleton height={14} width="40%" />
        <Skeleton height={14} width="85%" />
        <Skeleton height={14} width="70%" />
        <Skeleton height={38} width="55%" />
        <Skeleton height={14} width="60%" />
        <Skeleton height={14} width="80%" />
      </div>
    );
  }

  return (
    <>
      <ProjectOverview dossier={dossier} />
      <ContractorSection dossier={dossier} />
      <GovernmentSection dossier={dossier} />
      <ProcurementSection dossier={dossier} />
      <ProjectTimeline dossier={dossier} />
      <DocumentsSection dossier={dossier} />
      <RelatedEntities
        dossier={dossier}
        onFilterByContractor={onFilterByContractor}
        onFilterByDepartment={onFilterByDepartment}
      />
      <SourcesSection dossier={dossier} />
    </>
  );
}
