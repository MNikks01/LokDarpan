"use client";

import type React from "react";
import { PROJECT_EVENT_LABEL } from "@/domain/project";
import type { ProjectDossier } from "@/data/repositories";
import { NotRecorded, Section, formatDate } from "./primitives";
import { color } from "@/ui/tokens";

/**
 * The lifecycle of the work, in date order.
 *
 * A scheduled date and an event that occurred are drawn differently — hollow
 * marker, muted text, an explicit "scheduled" note. Rendering a planned
 * completion as though it had happened is the single most misleading thing a
 * timeline can do with government records, and it is an easy mistake to make.
 */
export function ProjectTimeline({
  dossier,
}: {
  readonly dossier: ProjectDossier;
}): React.JSX.Element {
  const { timeline } = dossier;

  if (timeline.length === 0) {
    return (
      <Section title="Timeline">
        <NotRecorded what="No dated events in the records held" expectedIn="Work order abstract" />
      </Section>
    );
  }

  return (
    <Section title="Timeline">
      <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
        {timeline.map((event, index) => (
          <li
            key={`${event.kind}-${event.date}`}
            style={{
              display: "grid",
              gridTemplateColumns: "16px minmax(0, 1fr)",
              gap: 10,
              paddingBottom: index === timeline.length - 1 ? 0 : 14,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "block",
                position: "relative",
                width: 16,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  border: `2px solid ${event.recorded ? color.accent.base : color.text.tertiary}`,
                  background: event.recorded ? color.accent.base : color.bg.surface,
                }}
              />
              {index !== timeline.length - 1 && (
                <span
                  style={{
                    position: "absolute",
                    top: 15,
                    left: 7.5,
                    bottom: -14,
                    width: 1,
                    background: color.border.hair,
                  }}
                />
              )}
            </span>
            <span>
              <span style={{ display: "block", fontSize: 12, color: "var(--ld-text-tertiary)" }}>
                {formatDate(event.date)}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 13.5,
                  fontWeight: event.recorded ? 550 : 400,
                  color: event.recorded ? "var(--ld-text)" : "var(--ld-text-secondary)",
                }}
              >
                {PROJECT_EVENT_LABEL[event.kind]}
                {!event.recorded && (
                  <span style={{ color: "var(--ld-text-tertiary)", fontWeight: 400 }}>
                    {" "}
                    · scheduled, not an event
                  </span>
                )}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}
