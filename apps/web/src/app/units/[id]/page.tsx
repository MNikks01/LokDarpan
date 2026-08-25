import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApiError, getUnit, type AdminUnit } from "@/lib/api";
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

const LEVEL_LABEL: Readonly<Record<string, string>> = {
  country: "Country",
  state: "State",
  district: "District",
  sub_district: "Sub-district",
  block: "Development block",
  village: "Village",
  urban_local_body: "Urban local body",
  ward: "Ward",
  gram_panchayat: "Gram panchayat",
};

const CHILD_LABEL: Readonly<Record<string, string>> = {
  country: "States and Union Territories",
  state: "Districts",
  district: "Sub-districts",
  sub_district: "Villages and local bodies",
};

async function load(id: string): Promise<Awaited<ReturnType<typeof getUnit>> | null> {
  try {
    return await getUnit(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await load(id);
  if (result === null) return { title: "Unit not found" };
  const { unit } = result.data;
  const level = LEVEL_LABEL[unit.level] ?? unit.level;
  return {
    // SEO is the acquisition channel: with no app store, an unfindable civic
    // site has a structural reach problem (.docs/02-architecture/web-architecture.md).
    title: `${unit.nameEn} — ${level} · LokDarpan`,
    description: `Official record for ${unit.nameEn}, ${level.toLowerCase()}, LGD code ${unit.lgdCode}.`,
  };
}

function UnitRow({ child }: { readonly child: AdminUnit }): React.JSX.Element {
  return (
    <li
      style={{ padding: `${String(space[2])}px 0`, borderBottom: `1px solid ${color.border.hair}` }}
    >
      <a href={`/units/${String(child.id)}`} style={{ color: color.text.primary }}>
        {child.nameEn}
      </a>
      {child.nameLocal !== null && (
        <span style={{ color: color.text.secondary, marginInlineStart: 8 }} lang="hi">
          {child.nameLocal}
        </span>
      )}
      <span style={{ color: color.text.tertiary, fontSize: 12, marginInlineStart: 8 }}>
        LGD {child.lgdCode}
      </span>
    </li>
  );
}

export default async function UnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const result = await load(id);
  if (result === null) notFound();

  const { unit, children, datasetVersion } = result.data;
  const level = LEVEL_LABEL[unit.level] ?? unit.level;
  const childHeading = CHILD_LABEL[unit.level] ?? "Sub-units";

  return (
    <>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: color.text.secondary }}>
        <a href="/units" style={{ color: color.text.secondary }}>
          India
        </a>{" "}
        › {unit.nameEn}
      </nav>

      <h1 style={{ fontSize: 26, margin: `${String(space[2])}px 0 ${String(space[1])}px` }}>
        {unit.nameEn}
        {unit.nameLocal !== null && (
          <span style={{ color: color.text.secondary, fontWeight: 400, marginInlineStart: 10 }}>
            {unit.nameLocal}
          </span>
        )}
      </h1>

      <p style={{ color: color.text.secondary, fontSize: 14, margin: 0 }}>
        {level} · LGD code {unit.lgdCode}
      </p>

      <section
        aria-labelledby="sub-units"
        style={{
          marginTop: space[5],
          padding: space[4],
          borderRadius: radius.md,
          border: `1px solid ${color.border.hair}`,
        }}
      >
        <h2 id="sub-units" style={{ fontSize: 16, margin: 0 }}>
          {childHeading}
        </h2>

        {children.length === 0 ? (
          // Not published and not yet collected are different states, and
          // neither is "none". Saying which one this is keeps the page from
          // implying the government publishes nothing here.
          <p style={{ color: color.text.secondary, fontSize: 14, marginBottom: 0 }}>
            Sub-units for this unit have not been collected yet. The Local Government Directory
            publishes them; they are not part of the current dataset.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: `${String(space[3])}px 0 0` }}>
            {children.map((child) => (
              <UnitRow key={child.id} child={child} />
            ))}
          </ul>
        )}
      </section>

      <ProvenanceNote
        sourceUrl={unit.provenance.sourceUrl}
        retrievedAt={unit.provenance.retrievedAt}
        datasetVersion={datasetVersion}
      />
    </>
  );
}
