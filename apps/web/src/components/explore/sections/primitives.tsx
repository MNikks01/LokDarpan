"use client";

import type React from "react";
import styles from "../explorer.module.css";

export function Section({
  title,
  children,
  action,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className={styles.section}>
      <div
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}
      >
        <h3 className={styles.sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A definition list, not a table. Each row is one labelled fact about one
 * record, which is what `<dl>` means; a table would claim a relationship
 * between rows that does not exist.
 */
export function Pairs({
  rows,
}: {
  readonly rows: readonly { readonly label: string; readonly value: React.ReactNode }[];
}): React.JSX.Element {
  return (
    <dl className={styles.pairs}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: "contents" }}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The single approved way to render an absent value.
 *
 * `.docs/17-legal/legal-ethical-rules.md` rule 8: missing is never zero, never
 * blank, and never a dash. It names what is absent and, where known, which
 * record would carry it — because "we do not hold this" and "this does not
 * exist" are different claims, and only the first one is ours to make.
 */
export function NotRecorded({
  what,
  expectedIn,
}: {
  readonly what: string;
  readonly expectedIn?: string;
}): React.JSX.Element {
  return (
    <span style={{ color: "var(--ld-text-secondary)" }}>
      <span aria-hidden="true">▤ </span>
      {what}
      {expectedIn !== undefined && (
        <span style={{ display: "block", fontSize: 11.5, color: "var(--ld-text-tertiary)" }}>
          Expected in: {expectedIn}
        </span>
      )}
    </span>
  );
}

export function formatDate(iso: string | null): React.ReactNode {
  if (iso === null) return <NotRecorded what="Not recorded" />;
  const date = new Date(`${iso}T00:00:00Z`);
  return (
    <time dateTime={iso}>
      {date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}
    </time>
  );
}
