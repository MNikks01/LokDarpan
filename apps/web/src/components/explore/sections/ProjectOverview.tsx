"use client";

import type React from "react";
import { Figure } from "@/components/Figure";
import { LOCAL_BODY_TYPE_LABEL } from "@/domain/geography";
import type { ProjectDossier } from "@/data/repositories";
import { PROJECT_STATUS } from "@/ui/status";
import { NotRecorded, Pairs, Section, formatDate } from "./primitives";

export function ProjectOverview({
  dossier,
}: {
  readonly dossier: ProjectDossier;
}): React.JSX.Element {
  const { project, district, state, localBody, timeline } = dossier;
  const event = (kind: string): string | null =>
    timeline.find((e) => e.kind === kind)?.date ?? null;

  return (
    <Section title="Work">
      <Pairs
        rows={[
          {
            label: "Record ID",
            value: <code style={{ fontSize: 12.5 }}>{project.externalId}</code>,
          },
          {
            label: "Recorded stage",
            value: (
              <>
                {PROJECT_STATUS[project.status].label}
                <span
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    color: "var(--ld-text-tertiary)",
                    marginTop: 2,
                    maxWidth: "40ch",
                  }}
                >
                  {PROJECT_STATUS[project.status].description}
                </span>
              </>
            ),
          },
          {
            label: "Location",
            value: (
              <>
                {localBody === null ? district.name : localBody.name}
                <span style={{ color: "var(--ld-text-tertiary)" }}>
                  {localBody === null ? "" : ` · ${LOCAL_BODY_TYPE_LABEL[localBody.type]}`} ·{" "}
                  {district.name}, {state.name}
                </span>
              </>
            ),
          },
          {
            label: "Length",
            value:
              project.lengthKm === null ? (
                <NotRecorded what="Not recorded" expectedIn="Work order abstract" />
              ) : (
                `${project.lengthKm.toFixed(1)} km`
              ),
          },
          { label: "Financial year", value: project.fiscalYear },
          { label: "Start date", value: formatDate(event("work_started")) },
          { label: "Expected completion", value: formatDate(event("expected_completion")) },
          { label: "Actual completion", value: formatDate(event("completed")) },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {/* <Figure> requires provenance: a value with no source cannot compile. */}
        <Figure label="Contract value" data={project.contractValue} emphasis="lg" />
      </div>
    </Section>
  );
}
