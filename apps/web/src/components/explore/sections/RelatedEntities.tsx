"use client";

import type React from "react";
import Link from "next/link";
import type { ProjectDossier } from "@/data/repositories";
import { controlStyles } from "@/components/ui";
import { Section } from "./primitives";

/**
 * Where the reader goes next.
 *
 * Deliberately a list of links rather than a relationship graph. The underlying
 * model is a graph — government › department › work › contract › firm ›
 * documents — but a force-directed diagram of eight nodes teaches nobody
 * anything and costs a rendering library. The links carry the same structure and
 * are navigable by keyboard.
 */
export function RelatedEntities({
  dossier,
  onFilterByContractor,
  onFilterByDepartment,
}: {
  readonly dossier: ProjectDossier;
  readonly onFilterByContractor: (companyId: string) => void;
  readonly onFilterByDepartment: (departmentId: string) => void;
}): React.JSX.Element {
  const { contractor, department, localBody, tender } = dossier;

  return (
    <Section title="Follow the record">
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 7 }}>
        {contractor !== null && (
          <li>
            <button
              type="button"
              className={controlStyles.link}
              style={{
                border: 0,
                background: "none",
                cursor: "pointer",
                font: "inherit",
                fontWeight: 550,
              }}
              onClick={() => {
                onFilterByContractor(contractor.id);
              }}
            >
              Show other works held for {contractor.name} <span aria-hidden="true">→</span>
            </button>
          </li>
        )}
        <li>
          <button
            type="button"
            className={controlStyles.link}
            style={{
              border: 0,
              background: "none",
              cursor: "pointer",
              font: "inherit",
              fontWeight: 550,
            }}
            onClick={() => {
              onFilterByDepartment(department.id);
            }}
          >
            Show other works by {department.shortName} <span aria-hidden="true">→</span>
          </button>
        </li>
        {contractor !== null && (
          <li>
            <Link className={controlStyles.link} href={`/company/${contractor.id}`}>
              Firm profile <span aria-hidden="true">→</span>
            </Link>
          </li>
        )}
        <li>
          <Link className={controlStyles.link} href={`/department/${department.id}`}>
            Department profile <span aria-hidden="true">→</span>
          </Link>
        </li>
        {localBody !== null && (
          <li>
            <Link className={controlStyles.link} href={`/local-body/${localBody.id}`}>
              Local body profile <span aria-hidden="true">→</span>
            </Link>
          </li>
        )}
        {tender !== null && (
          <li>
            <Link className={controlStyles.link} href={`/tender/${encodeURIComponent(tender.id)}`}>
              Tender record <span aria-hidden="true">→</span>
            </Link>
          </li>
        )}
      </ul>
    </Section>
  );
}
