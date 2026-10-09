"use client";

import type React from "react";

import { tenderExploreCopy } from "@/copy/tender";

/**
 * Departments as chips above the map, the way a map app offers "Restaurants ·
 * Hotels · ATMs": one tap shows only that department's tenders.
 *
 * Alphabetical, never by count: an order by size would rank departments, and
 * the map does not rank (`gods-eye-view-adoption.md`). The count sits in each
 * chip so a reader still sees how many each has.
 */
export function DepartmentChips({
  departments,
  selected,
  onSelect,
}: {
  readonly departments: readonly { readonly name: string; readonly tenderCount: number }[];
  readonly selected: string | null;
  readonly onSelect: (department: string | null) => void;
}): React.JSX.Element | null {
  if (departments.length === 0) return null;
  const sorted = [...departments].sort((a, b) => a.name.localeCompare(b.name));
  const chip = (active: boolean): React.CSSProperties => ({
    flex: "0 0 auto",
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--ld-text)" : "var(--ld-hair)"}`,
    background: active ? "var(--ld-text)" : "var(--ld-surface)",
    color: active ? "var(--ld-surface)" : "var(--ld-text)",
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });
  return (
    <div
      role="group"
      aria-label={tenderExploreCopy.chipsLabel}
      style={{ display: "flex", gap: 8, overflowX: "auto", padding: "8px 0" }}
    >
      <button
        type="button"
        aria-pressed={selected === null}
        style={chip(selected === null)}
        onClick={() => {
          onSelect(null);
        }}
      >
        {tenderExploreCopy.allDepartments}
      </button>
      {sorted.map((d) => (
        <button
          key={d.name}
          type="button"
          aria-pressed={selected === d.name}
          style={chip(selected === d.name)}
          onClick={() => {
            onSelect(selected === d.name ? null : d.name);
          }}
        >
          {tenderExploreCopy.chip(d.name, d.tenderCount)}
        </button>
      ))}
    </div>
  );
}
