import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";

import type { DocumentSummary } from "@lokdarpan/domain";

import { getJson } from "@/lib/api";
import { color, radius, space } from "@/ui/tokens";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Source documents | LokDarpan",
  description:
    "Official documents held by LokDarpan, and how much of each has been verified against its pages.",
};

/**
 * The documents themselves, listed with how far review has got.
 *
 * The counts are stated on the index rather than only inside each document,
 * because "4 verified" and "257 awaiting review" together are what tell a
 * reader how much of a report this site can currently speak to. An index
 * showing only what is published would imply the rest had been examined and
 * found to hold nothing.
 */
export default async function DocumentsPage(): Promise<React.JSX.Element> {
  const { data } = await getJson("/api/v1/documents");
  const { documents } = data as { documents: readonly DocumentSummary[] };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: space[7] }}>
      <h1 style={{ fontSize: 26, margin: 0, color: color.text.primary }}>Source documents</h1>
      <p style={{ color: color.text.secondary, fontSize: 14, lineHeight: 1.6 }}>
        Documents published by government bodies and held here in full. A figure appears on this
        site only after a person has checked it against the page it was read from.
      </p>

      {documents.length === 0 ? (
        <p style={{ color: color.text.secondary }}>No documents have been collected yet.</p>
      ) : (
        <ul style={{ padding: 0, margin: `${String(space[4])}px 0 0` }}>
          {documents.map((doc) => (
            <li
              key={doc.documentId}
              style={{
                listStyle: "none",
                border: `1px solid ${color.border.hair}`,
                borderRadius: radius.md,
                padding: space[4],
                marginBottom: space[2],
                background: color.bg.surface,
              }}
            >
              <Link
                href={`/documents/${String(doc.documentId)}`}
                style={{ color: color.text.primary, fontWeight: 600, textDecoration: "none" }}
              >
                {doc.title}
              </Link>
              <div style={{ fontSize: 13, color: color.text.tertiary, marginTop: 4 }}>
                {doc.issuingAuthority}
              </div>
              <div style={{ fontSize: 13, color: color.text.secondary, marginTop: space[2] }}>
                {doc.publishedFacts === 0
                  ? "Nothing verified yet"
                  : `${String(doc.publishedFacts)} verified`}
                {doc.awaitingReview > 0 && ` · ${String(doc.awaitingReview)} awaiting review`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
