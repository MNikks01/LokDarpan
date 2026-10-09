import type React from "react";

import type { PlaceMentionsInReport } from "@lokdarpan/domain";

import { placesCopy } from "@/copy/places";
import { color, radius, space } from "@/ui/tokens";

/**
 * The audit pages that name a place (ADR-077), each linked to that page of the
 * original report. Every report is listed with its pages in order; nothing is
 * summarised, scored or ordered by how often the place is named.
 */
export function PlaceMentions({
  reports,
  place,
}: {
  readonly reports: readonly PlaceMentionsInReport[] | null;
  readonly place: string;
}): React.JSX.Element {
  return (
    <section
      aria-labelledby="place-mentions"
      style={{
        marginTop: space[5],
        padding: space[4],
        borderRadius: radius.md,
        border: `1px solid ${color.border.hair}`,
      }}
    >
      <h2 id="place-mentions" style={{ fontSize: 16, margin: 0 }}>
        {placesCopy.heading(place)}
      </h2>
      {reports === null ? (
        <p style={{ color: color.text.secondary, fontSize: 14, marginBottom: 0 }}>
          {placesCopy.unavailable}
        </p>
      ) : reports.length === 0 ? (
        <p style={{ color: color.text.secondary, fontSize: 14, marginBottom: 0 }}>
          {placesCopy.none}
        </p>
      ) : (
        <>
          <p
            style={{
              color: color.text.secondary,
              fontSize: 13,
              margin: `${String(space[2])}px 0 0`,
            }}
          >
            {placesCopy.intro}
          </p>
          <p
            style={{
              color: color.text.tertiary,
              fontSize: 12,
              margin: `${String(space[2])}px 0 0`,
            }}
          >
            {placesCopy.disclaimer}
          </p>
          {reports.map((r) => (
            <article
              key={r.documentId}
              style={{
                marginTop: space[4],
                paddingTop: space[3],
                borderTop: `1px solid ${color.border.hair}`,
              }}
            >
              <h3 style={{ fontSize: 14, margin: 0 }}>
                <a
                  href={`/documents/${String(r.documentId)}`}
                  style={{ color: color.text.primary }}
                >
                  {r.title}
                </a>
                <span
                  style={{
                    color: color.text.tertiary,
                    fontSize: 12,
                    fontWeight: 400,
                    marginInlineStart: 8,
                  }}
                >
                  {placesCopy.namedOn(r.pages.length)}
                </span>
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: `${String(space[2])}px 0 0` }}>
                {r.pages.map((p) => (
                  <li
                    key={p.pageNumber}
                    style={{ padding: `${String(space[2])}px 0`, fontSize: 13 }}
                  >
                    <a
                      href={`${r.sourceUrl}#page=${String(p.pageNumber)}`}
                      rel="noreferrer noopener"
                      title={placesCopy.openPage}
                      style={{ color: color.text.secondary, marginInlineEnd: 8 }}
                    >
                      {placesCopy.page(p.pageNumber)}
                    </a>
                    <span style={{ color: color.text.primary }}>{p.excerpt}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
