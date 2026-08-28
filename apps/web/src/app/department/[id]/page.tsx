import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { demoRepositories } from "@/data/demo-repository";
import { DEMO_PROJECTS } from "@/data/demo/projects";
import { RecordPage, RecordPairs, RecordSection } from "@/components/RecordPage";
import { PROJECT_STATUS } from "@/ui/status";
import { color } from "@/ui/tokens";

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const department = await demoRepositories.government.getDepartment(id);
  if (department === null) notFound();

  const works = DEMO_PROJECTS.filter((r) => r.project.departmentId === department.id);

  return (
    <RecordPage
      kind="Government body"
      title={department.name}
      subtitle={`${department.tier} tier${department.parentMinistry === null ? "" : ` · under ${department.parentMinistry}`}`}
    >
      <RecordSection title="In the records held">
        <RecordPairs
          rows={[
            { label: "Short name", value: department.shortName },
            { label: "Tier", value: department.tier },
            { label: "Works", value: `${String(works.length)} in the records held` },
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
