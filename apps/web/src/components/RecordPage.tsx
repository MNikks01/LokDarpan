import type React from "react";
import Link from "next/link";
import { DEMO_DATA_NOTICE } from "@/data/demo/notice";
import { color } from "@/ui/tokens";

/**
 * The document-style shell used by every entity page that is not the map.
 *
 * These pages are server-rendered with no client JavaScript: they are the
 * indexable, shareable, printable form of a record, and the explorer is the
 * interactive one. Both read the same repository.
 */
export function RecordPage({
  kind,
  title,
  subtitle,
  backHref = "/explore",
  children,
}: {
  readonly kind: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly backHref?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <p style={{ fontSize: 13, margin: "0 0 16px" }}>
        <Link href={backHref} style={{ color: color.accent.base, textDecoration: "none" }}>
          ← Back to the map
        </Link>
      </p>
      <p
        style={{
          fontSize: 10.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: color.text.tertiary,
          fontWeight: 650,
          margin: "0 0 6px",
        }}
      >
        {kind}
      </p>
      <h1 style={{ fontSize: 26, margin: "0 0 6px", lineHeight: 1.2 }}>{title}</h1>
      {subtitle !== undefined && (
        <p style={{ color: color.text.secondary, margin: "0 0 16px" }}>{subtitle}</p>
      )}
      <p
        style={{
          fontSize: 12,
          background: color.band.high.bg,
          color: color.band.high.fg,
          padding: "8px 10px",
          borderRadius: 8,
          margin: "0 0 24px",
        }}
      >
        ⚠ {DEMO_DATA_NOTICE}
      </p>
      {children}
    </>
  );
}

export function RecordSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section style={{ padding: "20px 0", borderTop: `1px solid ${color.border.hair}` }}>
      <h2
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: color.text.tertiary,
          margin: "0 0 12px",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function RecordPairs({
  rows,
}: {
  readonly rows: readonly { readonly label: string; readonly value: React.ReactNode }[];
}): React.JSX.Element {
  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 12rem) minmax(0, 1fr)",
        gap: "8px 20px",
        margin: 0,
        fontSize: 14,
      }}
    >
      {rows.map((row) => (
        <div key={row.label} style={{ display: "contents" }}>
          <dt style={{ color: color.text.secondary }}>{row.label}</dt>
          <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums lining-nums" }}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
