import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { attributionFor, byPage, type DocumentFactsView } from "@lokdarpan/domain";

import { ApiError, getJson } from "@/lib/api";
import { ProvenanceNote } from "@/components/Provenance";
import { FactCard, Scope } from "@/components/PublishedFacts";
import { color, space } from "@/ui/tokens";

export const dynamic = "force-dynamic";

/**
 * What a person has verified from one published document.
 *
 * Scoped to a document the reader navigated to, never a feed. A page listing
 * every extracted claim across every source would be an anomaly feed by another
 * name, which `.docs/17-legal/legal-ethical-rules.md` forbids, and would also
 * strip each claim of the report it belongs to.
 */
async function load(id: string): Promise<DocumentFactsView> {
  try {
    const { data } = await getJson(`/api/v1/documents/${encodeURIComponent(id)}`);
    return data as DocumentFactsView;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const view = await load(id);
    return {
      title: `${view.title} — verified facts | LokDarpan`,
      // States the limit in the description too. A search result is often all
      // a reader sees, and "facts from" without "verified" would overstate it.
      description:
        `${String(view.facts.length)} facts verified from ${view.title}, ` +
        `published by ${view.provenance.issuingAuthority}, each cited to its page.`,
    };
  } catch {
    return { title: "Document — LokDarpan" };
  }
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const view = await load(id);
  const pages = byPage(view.facts);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: space[7] }}>
      {/*
        The credit line, above the title rather than buried in a footer. Both
        licences that permit this material require the source to be
        "prominently acknowledged" (.docs/06-government-sources/source-licences.md);
        a hover-only or footer-only credit does not meet that, and the credit is
        read from the licence registry so it cannot drift from the terms it
        satisfies.
      */}
      <p style={{ fontSize: 13, color: color.text.tertiary, margin: 0 }}>
        {attributionFor(view.provenance.sourceId)}
      </p>
      <h1 style={{ fontSize: 26, lineHeight: 1.3, margin: "4px 0 0", color: color.text.primary }}>
        {view.title}
      </h1>

      <Scope view={view} />

      {pages.length === 0 ? (
        <p style={{ color: color.text.secondary, fontSize: 15 }}>
          Nothing from this document is published yet. The document itself is linked below and can
          be read in full.
        </p>
      ) : (
        pages.map((page) => (
          <section key={page.pageNumber} style={{ marginTop: space[7] }}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: color.text.tertiary,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: `0 0 ${String(space[2])}px`,
              }}
            >
              Page {page.pageNumber}
            </h2>
            <ul style={{ padding: 0, margin: 0 }}>
              {page.facts.map((fact) => (
                <FactCard key={fact.id} fact={fact} />
              ))}
            </ul>
          </section>
        ))
      )}

      <ProvenanceNote
        sourceUrl={view.provenance.sourceUrl}
        retrievedAt={view.provenance.retrievedAt}
        datasetVersion={view.datasetVersion}
      />
    </main>
  );
}
