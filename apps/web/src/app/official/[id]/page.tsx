import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { demoRepositories } from "@/data/demo-repository";
import { DEMO_DEPARTMENTS } from "@/data/demo/organisations";
import { DEMO_PROJECTS } from "@/data/demo/projects";
import { OFFICER_ROLE_LABEL } from "@/domain/organisation";
import { RecordPage, RecordPairs, RecordSection } from "@/components/RecordPage";
import { color } from "@/ui/tokens";

/**
 * An officer's record.
 *
 * The page states three things: who they are per the record, which works name
 * them, and in what role. It draws no conclusion from the list — the number of
 * works an Executive Engineer's name appears on is a function of their posting,
 * not of anything they did, and presenting it as a finding would be exactly the
 * inference `.docs/17-legal/legal-ethical-rules.md` forbids.
 */
export default async function OfficialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const officer = await demoRepositories.government.getOfficer(id);
  if (officer === null) notFound();

  const department = DEMO_DEPARTMENTS.find((d) => d.id === officer.departmentId);
  const associations = DEMO_PROJECTS.flatMap((record) =>
    record.officers
      .filter((association) => association.officerId === officer.id)
      .map((association) => ({ project: record.project, association })),
  );

  return (
    <RecordPage kind="Officer" title={officer.name} subtitle={officer.designation}>
      <RecordSection title="As recorded">
        <RecordPairs
          rows={[
            { label: "Designation", value: officer.designation },
            { label: "Department", value: department?.name ?? officer.departmentId },
            { label: "Office", value: officer.office },
            { label: "Works naming this officer", value: String(associations.length) },
          ]}
        />
      </RecordSection>

      <RecordSection title="Roles recorded on works">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {associations.map(({ project, association }) => (
            <li key={`${project.id}-${association.role}`}>
              <span style={{ fontSize: 12, color: color.text.tertiary, display: "block" }}>
                {OFFICER_ROLE_LABEL[association.role]}
              </span>
              <Link
                href={`/explore?project=${encodeURIComponent(project.id)}`}
                style={{ color: color.accent.base, textDecoration: "none", fontWeight: 550 }}
              >
                {project.name}
              </Link>
              <span style={{ display: "block", fontSize: 13, color: color.text.secondary }}>
                {project.externalId} · period in record {association.periodFrom ?? "not recorded"} –{" "}
                {association.periodTo ?? "not recorded"}
              </span>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 12.5, color: color.text.tertiary, marginTop: 16, maxWidth: "58ch" }}>
          An officer appears on this page because a public document names them in a role. That is a
          statement about the document, and nothing more should be read into the list or its length.
        </p>
      </RecordSection>
    </RecordPage>
  );
}
