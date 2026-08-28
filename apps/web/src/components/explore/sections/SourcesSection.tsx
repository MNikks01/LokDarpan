"use client";

import type React from "react";
import Link from "next/link";
import type { ProjectDossier } from "@/data/repositories";
import { controlStyles } from "@/components/ui";
import { Section, formatDate } from "./primitives";

/**
 * The bibliography for this panel: every document a figure or a date on this
 * screen was read from. The claim "every number links to its source" is only
 * true if the reader can see the list, so it is a section and not a footnote.
 */
export function SourcesSection({
  dossier,
}: {
  readonly dossier: ProjectDossier;
}): React.JSX.Element {
  return (
    <Section title="Sources">
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {dossier.sources.map((source) => (
          <li key={source.id} style={{ fontSize: 12.5 }}>
            <Link className={controlStyles.link} href={`/source/${String(source.id)}`}>
              {source.title}
            </Link>
            <span style={{ display: "block", color: "var(--ld-text-secondary)" }}>
              {source.authority}
            </span>
            <span style={{ display: "block", color: "var(--ld-text-tertiary)", fontSize: 11.5 }}>
              {source.publishedOn === null ? (
                "Publication date not stated"
              ) : (
                <>Published {formatDate(source.publishedOn)}</>
              )}
              {" · retrieved "}
              {source.retrievedAt.slice(0, 10)}
              {" · "}
              {source.provenance.extractionMethod}
            </span>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 11.5, color: "var(--ld-text-tertiary)", margin: "12px 0 0" }}>
        Data as of {dossier.sources[0]?.retrievedAt.slice(0, 10) ?? "unknown"} · dataset version{" "}
        {dossier.datasetVersion}
      </p>
    </Section>
  );
}
