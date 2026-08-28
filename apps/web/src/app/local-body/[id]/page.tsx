import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_LOCAL_BODIES } from "@/data/demo/places";
import { DEMO_PROJECTS } from "@/data/demo/projects";
import { LOCAL_BODY_TYPE_LABEL } from "@/domain/geography";
import { demoRepositories } from "@/data/demo-repository";
import { RecordPage, RecordPairs, RecordSection } from "@/components/RecordPage";
import { PROJECT_STATUS } from "@/ui/status";
import { color } from "@/ui/tokens";

export default async function LocalBodyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const body = DEMO_LOCAL_BODIES.find((b) => b.id === id);
  if (body === undefined) notFound();

  const districts = await demoRepositories.geography.listDistricts(body.stateCode);
  const district = districts.find((d) => d.id === body.districtId);
  const works = DEMO_PROJECTS.filter((r) => r.project.localBodyId === body.id);

  return (
    <RecordPage
      kind="Local body"
      title={body.name}
      subtitle={LOCAL_BODY_TYPE_LABEL[body.type]}
      backHref={`/explore?state=${body.stateCode}&district=${body.districtId}&body=${body.id}`}
    >
      <RecordSection title="As recorded">
        <RecordPairs
          rows={[
            { label: "Type", value: LOCAL_BODY_TYPE_LABEL[body.type] },
            { label: "District", value: district?.name ?? body.districtId },
            { label: "Works", value: `${String(works.length)} in the records held` },
            {
              label: "Boundary",
              value: (
                <>
                  <span aria-hidden="true">▤ </span>
                  Not published in the registers reviewed
                  <span style={{ display: "block", fontSize: 12.5, color: color.text.tertiary }}>
                    Expected in: {body.boundarySource}
                  </span>
                </>
              ),
            },
          ]}
        />
      </RecordSection>
      <RecordSection title="Works">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {works.map(({ project }) => (
            <li key={project.id}>
              <Link
                href={`/explore?project=${encodeURIComponent(project.id)}`}
                style={{ color: color.accent.base, textDecoration: "none", fontWeight: 550 }}
              >
                {project.name}
              </Link>
              <span style={{ display: "block", fontSize: 13, color: color.text.secondary }}>
                {PROJECT_STATUS[project.status].label} · {project.externalId}
              </span>
            </li>
          ))}
        </ul>
      </RecordSection>
    </RecordPage>
  );
}
