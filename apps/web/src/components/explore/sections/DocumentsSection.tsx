"use client";

import type React from "react";
import Link from "next/link";
import { DOCUMENT_KIND_LABEL } from "@/domain/project";
import type { DocumentAvailability } from "@/domain/project";
import type { ProjectDossier } from "@/data/repositories";
import { controlStyles } from "@/components/ui";
import { Section, formatDate } from "./primitives";

/**
 * Documents behind the record.
 *
 * Availability is shown as three distinct states because they are three
 * different facts. "Held" means we have the artefact. "Referenced, not held"
 * means a document we do hold names it — the record exists, we do not have it.
 * "Not published" means it was not identified in the sources reviewed, which is
 * a statement about our review and not about the publishing body.
 */
const AVAILABILITY: Readonly<
  Record<
    DocumentAvailability,
    { readonly label: string; readonly glyph: string; readonly note: string }
  >
> = {
  held: { label: "Held", glyph: "◆", note: "The artefact is held and citable." },
  referenced_not_held: {
    label: "Referenced, not held",
    glyph: "◇",
    note: "Named by a document we hold. The artefact itself has not been collected.",
  },
  not_published: {
    label: "Not identified",
    glyph: "▤",
    note: "Not identified in the sources reviewed as of the last check. This does not mean it was not published.",
  },
};

export function DocumentsSection({
  dossier,
}: {
  readonly dossier: ProjectDossier;
}): React.JSX.Element {
  return (
    <Section title="Documents">
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {dossier.documents.map((document) => {
          const availability = AVAILABILITY[document.availability];
          return (
            <li
              key={document.id}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                border: "1px solid var(--ld-hair)",
                borderRadius: 9,
                padding: "9px 10px",
              }}
            >
              <span aria-hidden="true" style={{ color: "var(--ld-text-tertiary)", marginTop: 1 }}>
                {availability.glyph}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 550 }}>
                  {document.title}
                </span>
                <span
                  style={{ display: "block", fontSize: 11.5, color: "var(--ld-text-tertiary)" }}
                >
                  {DOCUMENT_KIND_LABEL[document.kind]} · {document.format.toUpperCase()} ·{" "}
                  {document.issuedBy}
                </span>
                <span
                  style={{ display: "block", fontSize: 11.5, color: "var(--ld-text-tertiary)" }}
                >
                  {document.documentDate === null
                    ? "Undated in record"
                    : formatDate(document.documentDate)}{" "}
                  · {availability.label}
                </span>
                {document.sourceDocumentId === null ? (
                  <span
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      color: "var(--ld-text-secondary)",
                      marginTop: 4,
                    }}
                  >
                    {availability.note}
                  </span>
                ) : (
                  <Link
                    className={controlStyles.link}
                    style={{ marginTop: 4 }}
                    href={`/source/${String(document.sourceDocumentId)}`}
                  >
                    Open source record <span aria-hidden="true">→</span>
                  </Link>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
