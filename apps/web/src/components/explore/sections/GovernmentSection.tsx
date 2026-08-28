"use client";

import type React from "react";
import Link from "next/link";
import { LOCAL_BODY_TYPE_LABEL } from "@/domain/geography";
import { OFFICER_ROLE_LABEL } from "@/domain/organisation";
import type { ProjectDossier } from "@/data/repositories";
import { controlStyles } from "@/components/ui";
import { NotRecorded, Section, formatDate } from "./primitives";

/**
 * Government bodies and the officers named in the record.
 *
 * WHAT THIS PANEL IS ALLOWED TO SAY
 * An officer appears here because a document names them in a role. The panel
 * states the role, the period and the document — and stops. It does not say
 * "responsible officer", does not rank officers, and does not connect an
 * officer to a work's stage. `.docs/17-legal/legal-ethical-rules.md`: a name in
 * a public record is an association, and presenting an association as anything
 * more is the failure mode this product exists to avoid.
 */
export function GovernmentSection({
  dossier,
}: {
  readonly dossier: ProjectDossier;
}): React.JSX.Element {
  const { department, officers, localBody, district, state } = dossier;

  return (
    <>
      <Section title="Government">
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{department.name}</p>
        <p style={{ fontSize: 12.5, color: "var(--ld-text-secondary)", margin: "0 0 14px" }}>
          {department.tier === "central"
            ? "Central"
            : department.tier === "state"
              ? "State"
              : "Local"}{" "}
          government body
          {department.parentMinistry !== null && ` · under ${department.parentMinistry}`}
        </p>

        <h4 style={{ fontSize: 12, margin: "0 0 8px", color: "var(--ld-text-secondary)" }}>
          Officers named in the record
        </h4>
        {officers.length === 0 ? (
          <NotRecorded
            what="No officer is named in the records held for this work"
            expectedIn="Work order abstract"
          />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {officers.map(({ officer, association }) => (
              <li
                key={`${officer.id}-${association.role}`}
                style={{
                  border: "1px solid var(--ld-hair)",
                  borderRadius: 9,
                  padding: "9px 10px",
                }}
              >
                <span style={{ fontSize: 11, color: "var(--ld-text-tertiary)", display: "block" }}>
                  {OFFICER_ROLE_LABEL[association.role]}
                </span>
                <Link className={controlStyles.link} href={`/official/${officer.id}`}>
                  {officer.name}
                </Link>
                <span style={{ display: "block", fontSize: 12, color: "var(--ld-text-secondary)" }}>
                  {officer.designation} · {officer.office}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    color: "var(--ld-text-tertiary)",
                    marginTop: 3,
                  }}
                >
                  Period in record:{" "}
                  {association.periodFrom === null
                    ? "not recorded"
                    : formatDate(association.periodFrom)}
                  {" – "}
                  {association.periodTo === null
                    ? "not recorded"
                    : formatDate(association.periodTo)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p
          style={{
            fontSize: 11.5,
            color: "var(--ld-text-tertiary)",
            margin: "10px 0 0",
            maxWidth: "46ch",
          }}
        >
          These are roles recorded in official documents. Naming an officer here states their
          function on the record and nothing beyond it.
        </p>
      </Section>

      <Section title="Local body">
        {localBody === null ? (
          <NotRecorded
            what="No local body is recorded against this work"
            expectedIn="Local Government Directory, Ministry of Panchayati Raj"
          />
        ) : (
          <>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{localBody.name}</p>
            <p style={{ fontSize: 12.5, color: "var(--ld-text-secondary)", margin: 0 }}>
              {LOCAL_BODY_TYPE_LABEL[localBody.type]} · {district.name}, {state.name}
            </p>
            <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "10px 0 0" }}>
              <span aria-hidden="true">▤ </span>
              No boundary polygon is published for this body in the registers reviewed. The map
              frames its approximate extent instead of drawing an outline.
            </p>
          </>
        )}
      </Section>
    </>
  );
}
