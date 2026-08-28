import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Money } from "@lokdarpan/money";
import { demoRepositories } from "@/data/demo-repository";
import { DEMO_DEPARTMENTS } from "@/data/demo/organisations";
import { DEMO_PROJECTS } from "@/data/demo/projects";
import { RecordPage, RecordPairs, RecordSection } from "@/components/RecordPage";
import { PROJECT_STATUS } from "@/ui/status";
import { color } from "@/ui/tokens";

/**
 * A firm's profile.
 *
 * WHAT IS ABSENT HERE IS THE DESIGN. There is no score, no rank, no badge, no
 * league position and no comparison against other firms — see
 * `.docs/05-data-model/screen-data-matrix.md` §3, where this omission is tracked
 * so it stays auditable rather than quietly reappearing. The page lists what the
 * records held say, with every count qualified by that phrase, because LokDarpan
 * does not hold every contract awarded in India and a total implies it does.
 */
export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const [company, activity] = await Promise.all([
    demoRepositories.companies.get(id),
    demoRepositories.companies.getActivity(id),
  ]);
  if (company === null || activity === null) notFound();

  const works = DEMO_PROJECTS.filter((r) => r.project.contractorId === company.id).map(
    (r) => r.project,
  );
  const states = await demoRepositories.geography.listStates();
  const stateNames = activity.stateCodes.map(
    (code) => states.find((s) => s.code === code)?.name ?? code,
  );
  const departmentNames = activity.departmentIds.map(
    (departmentId) => DEMO_DEPARTMENTS.find((d) => d.id === departmentId)?.name ?? departmentId,
  );

  return (
    <RecordPage kind="Firm" title={company.name} subtitle={`Firm ID ${company.id}`}>
      <RecordSection title="In the records held">
        <RecordPairs
          rows={[
            { label: "Registration", value: company.registrationId },
            { label: "Registered office", value: company.registeredOfficeCity },
            { label: "Works", value: `${String(activity.projectCount)} in the records held` },
            {
              label: "Sum of award values",
              value: Money.fromDecimalString(activity.totalContractValueInr).format(),
            },
            { label: "States", value: stateNames.join(", ") },
            { label: "Departments", value: departmentNames.join(", ") },
          ]}
        />
        <p style={{ fontSize: 12.5, color: color.text.tertiary, marginTop: 14, maxWidth: "58ch" }}>
          These counts describe the records LokDarpan holds, not every contract this firm has been
          awarded. They are a sum of published award values and are not a ranking, a rating or an
          assessment of the firm.
        </p>
      </RecordSection>

      <RecordSection title="Works held">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {works.map((project) => (
            <li key={project.id}>
              <Link
                href={`/explore?project=${encodeURIComponent(project.id)}`}
                style={{ color: color.accent.base, textDecoration: "none", fontWeight: 550 }}
              >
                {project.name}
              </Link>
              <span style={{ display: "block", fontSize: 13, color: color.text.secondary }}>
                {PROJECT_STATUS[project.status].label} · {project.externalId} ·{" "}
                {project.contractValue.present
                  ? Money.fromDecimalString(project.contractValue.amountInr).format()
                  : "Award value not in the records held"}
              </span>
            </li>
          ))}
        </ul>
      </RecordSection>
    </RecordPage>
  );
}
