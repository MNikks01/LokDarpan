import type React from "react";

import { holdingHeadline, type Holding } from "@lokdarpan/domain";

import { holdingsCopy } from "@/copy/holdings";
import { color, radius, space } from "@/ui/tokens";

/**
 * The checklist of what LokDarpan holds for a place (LD-009, ADR-076).
 *
 * One row per kind of record, always all of them, so an absence on the page is
 * never left for the reader to interpret. The headline is a word, never a
 * colour: "not collected" and "not shown" describe LokDarpan, and a warning
 * colour would make them read as findings about a government.
 */
export function Holdings({
  holdings,
  place,
}: {
  readonly holdings: readonly Holding[] | null;
  /** The place the page is about, as its name is printed. */
  readonly place: string;
}): React.JSX.Element {
  return (
    <section
      aria-labelledby="holdings"
      style={{
        marginTop: space[5],
        padding: space[4],
        borderRadius: radius.md,
        border: `1px solid ${color.border.hair}`,
      }}
    >
      <h2 id="holdings" style={{ fontSize: 16, margin: 0 }}>
        {holdingsCopy.heading}
      </h2>
      {holdings === null ? (
        <p style={{ color: color.text.secondary, fontSize: 14, marginBottom: 0 }}>
          {holdingsCopy.unavailable}
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
            {holdingsCopy.intro}
          </p>
          <dl style={{ margin: `${String(space[3])}px 0 0` }}>
            {holdings.map((h) => {
              const headline = holdingHeadline(h);
              return (
                <div
                  key={`${h.layer}:${h.level ?? ""}`}
                  data-headline={headline}
                  style={{
                    padding: `${String(space[2])}px 0`,
                    borderBottom: `1px solid ${color.border.hair}`,
                  }}
                >
                  <dt style={{ fontSize: 14, color: color.text.primary }}>
                    {holdingsCopy.layer(h)}
                    <span
                      style={{ color: color.text.secondary, fontSize: 13, marginInlineStart: 8 }}
                    >
                      {holdingsCopy.headline(headline)}
                    </span>
                  </dt>
                  <dd
                    style={{
                      margin: `${String(space[1])}px 0 0`,
                      fontSize: 13,
                      color: color.text.secondary,
                    }}
                  >
                    {holdingsCopy.detail(h, headline, place)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
    </section>
  );
}
