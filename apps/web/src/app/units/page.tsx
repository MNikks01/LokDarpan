import type React from "react";
import type { Metadata } from "next";

import { listUnitsByLevel } from "@/lib/api";
import { ProvenanceNote } from "@/components/Provenance";
import { color, radius, space } from "@/ui/tokens";

/**
 * Rendered per request, not prerendered at build.
 *
 * The architecture calls for ISR revalidated by the `datasetVersion` cache tag
 * (.docs/02-architecture/web-architecture.md). That needs two things this
 * repository does not have yet: a revalidation webhook, and an API reachable
 * from the build environment. Prerendering without them would either fail the
 * build or bake an empty page into the deployment — so the page renders on
 * request and the fetch is still tagged `dataset`, ready to become ISR the day
 * the webhook lands.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "States and Union Territories · LokDarpan",
  description:
    "The 36 States and Union Territories of India with their Local Government Directory codes.",
};

export default async function UnitsIndexPage(): Promise<React.JSX.Element> {
  const { data, datasetVersion } = await listUnitsByLevel("state");
  const first = data.units[0];

  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: space[1] }}>States and Union Territories</h1>
      <p style={{ color: color.text.secondary, fontSize: 14, marginTop: 0 }}>
        {data.units.length} units, from the Local Government Directory.
      </p>

      <ul
        style={{
          listStyle: "none",
          padding: space[4],
          margin: `${String(space[5])}px 0 0`,
          borderRadius: radius.md,
          border: `1px solid ${color.border.hair}`,
        }}
      >
        {data.units.map((unit) => (
          <li
            key={unit.id}
            style={{
              padding: `${String(space[2])}px 0`,
              borderBottom: `1px solid ${color.border.hair}`,
            }}
          >
            <a href={`/units/${String(unit.id)}`} style={{ color: color.text.primary }}>
              {unit.nameEn}
            </a>
            {unit.nameLocal !== null && (
              <span style={{ color: color.text.secondary, marginInlineStart: 8 }}>
                {unit.nameLocal}
              </span>
            )}
            <span style={{ color: color.text.tertiary, fontSize: 12, marginInlineStart: 8 }}>
              LGD {unit.lgdCode}
            </span>
          </li>
        ))}
      </ul>

      {first !== undefined && (
        <ProvenanceNote
          sourceUrl={first.provenance.sourceUrl}
          retrievedAt={first.provenance.retrievedAt}
          datasetVersion={datasetVersion}
        />
      )}
    </>
  );
}
