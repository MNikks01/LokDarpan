import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { attributionFor, type PublicBodyRef, type PublicBodyView } from "@lokdarpan/domain";

import { ApiError, getJson } from "@/lib/api";
import { color, radius, space } from "@/ui/tokens";
import { bodiesCopy } from "@/copy/pages";

export const dynamic = "force-dynamic";

/**
 * A government or department, and the reviewed report pages that name it
 * (ADR-074).
 *
 * The page lists mentions, not findings. A mention is a page that prints the
 * body's name; what that page says about money is read on the report's own
 * page, in its context, never gathered here under the body's name.
 */
async function load(id: string): Promise<PublicBodyView> {
  try {
    const { data } = await getJson(`/api/v1/bodies/${encodeURIComponent(id)}`);
    return data as PublicBodyView;
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
      title: `${view.name}, ${view.jurisdiction.name} — LokDarpan`,
      description: `${bodiesCopy.namedIn(view.reports.length)} held by LokDarpan, each cited to its page.`,
    };
  } catch {
    return { title: "Public body — LokDarpan" };
  }
}

function BodyLink({ body }: { readonly body: PublicBodyRef }): React.JSX.Element {
  return (
    <li
      style={{ padding: `${String(space[2])}px 0`, borderBottom: `1px solid ${color.border.hair}` }}
    >
      <a href={`/bodies/${String(body.id)}`} style={{ color: color.text.primary }}>
        {body.name}
      </a>
      <span style={{ color: color.text.tertiary, fontSize: 12, marginInlineStart: 8 }}>
        {bodiesCopy.namedIn(body.reportCount)}
      </span>
    </li>
  );
}

const sectionStyle: React.CSSProperties = {
  marginTop: space[6],
  padding: space[4],
  borderRadius: radius.md,
  border: `1px solid ${color.border.hair}`,
};

const smallLink: React.CSSProperties = { color: color.text.secondary };

export default async function BodyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const view = await load(id);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: space[7] }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: color.text.secondary }}>
        <a href={`/units/${String(view.jurisdiction.unitId)}`} style={smallLink}>
          {view.jurisdiction.name}
        </a>
        {view.parent !== null && (
          <>
            {" › "}
            <a href={`/bodies/${String(view.parent.id)}`} style={smallLink}>
              {view.parent.name}
            </a>
          </>
        )}
      </nav>

      <p style={{ fontSize: 13, color: color.text.tertiary, margin: `${String(space[3])}px 0 0` }}>
        {bodiesCopy.kindLabel[view.kind]} · {bodiesCopy.governs(view.jurisdiction.name)}
      </p>
      <h1 style={{ fontSize: 26, lineHeight: 1.3, margin: "4px 0 0", color: color.text.primary }}>
        {view.name}
      </h1>

      <p style={{ color: color.text.secondary, fontSize: 15, marginTop: space[4] }}>
        {bodiesCopy.whatThisIs}
      </p>
      <p style={{ color: color.text.secondary, fontSize: 14 }}>{bodiesCopy.notShown}</p>

      {view.departments.length > 0 && (
        <section aria-labelledby="departments" style={sectionStyle}>
          <h2 id="departments" style={{ fontSize: 16, margin: 0 }}>
            {bodiesCopy.departmentsHeading}
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: `${String(space[3])}px 0 0` }}>
            {view.departments.map((d) => (
              <BodyLink key={d.id} body={d} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="reports" style={sectionStyle}>
        <h2 id="reports" style={{ fontSize: 16, margin: 0 }}>
          {bodiesCopy.reportsHeading}
        </h2>
        {view.reports.map((report) => (
          <article key={report.documentId} style={{ marginTop: space[5] }}>
            {/* The credit line each source's terms require, read from the registry. */}
            <p style={{ fontSize: 12, color: color.text.tertiary, margin: 0 }}>
              {attributionFor(report.sourceId)}
            </p>
            <h3 style={{ fontSize: 15, margin: "2px 0 0" }}>
              <a
                href={`/documents/${String(report.documentId)}`}
                style={{ color: color.text.primary }}
              >
                {report.title}
              </a>
            </h3>
            <ul style={{ padding: 0, margin: `${String(space[2])}px 0 0`, listStyle: "none" }}>
              {report.mentions.map((m) => (
                <li key={m.factId} style={{ padding: `${String(space[2])}px 0` }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: color.text.tertiary }}>
                    {bodiesCopy.page(m.pageNumber)}
                  </span>
                  <blockquote
                    style={{
                      margin: `${String(space[1])}px 0 0`,
                      paddingInlineStart: space[3],
                      borderInlineStart: `2px solid ${color.border.hair}`,
                      color: color.text.secondary,
                      fontSize: 14,
                    }}
                  >
                    {m.rawText}
                  </blockquote>
                </li>
              ))}
            </ul>
            <p
              style={{
                fontSize: 12,
                color: color.text.tertiary,
                margin: `${String(space[1])}px 0 0`,
              }}
            >
              <a href={`/documents/${String(report.documentId)}`} style={smallLink}>
                {bodiesCopy.openReport}
              </a>
              {" · "}
              <a href={report.sourceUrl} rel="noopener noreferrer" style={smallLink}>
                {bodiesCopy.originalDocument}
              </a>
              {" · "}
              {bodiesCopy.retrieved(report.retrievedAt.slice(0, 10))}
              {report.publishedOn !== null && <> · {bodiesCopy.publishedOn(report.publishedOn)}</>}
            </p>
          </article>
        ))}
      </section>

      <p style={{ fontSize: 12, color: color.text.tertiary, marginTop: space[6] }}>
        {bodiesCopy.datasetVersion(view.datasetVersion)}
      </p>
    </main>
  );
}
