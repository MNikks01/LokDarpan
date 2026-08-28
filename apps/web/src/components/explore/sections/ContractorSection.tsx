"use client";

import type React from "react";
import Link from "next/link";
import { Money } from "@lokdarpan/money";
import type { ProjectDossier } from "@/data/repositories";
import { controlStyles } from "@/components/ui";
import { NotRecorded, Pairs, Section } from "./primitives";

/**
 * The firm holding the contract.
 *
 * There is no score, no rank, no badge and no flag on this panel, and the
 * counts are phrased as "in the records held" rather than as totals. This is
 * `.docs/17-legal/legal-ethical-rules.md` and `.docs/05-data-model/screen-data-matrix.md` §3:
 * a number attached to a named firm becomes a verdict the moment it is
 * comparable, and we do not have the whole denominator to compare against.
 */
export function ContractorSection({
  dossier,
}: {
  readonly dossier: ProjectDossier;
}): React.JSX.Element {
  const { contractor, contractorActivity, project } = dossier;

  if (contractor === null) {
    return (
      <Section title="Contractor">
        <NotRecorded
          what="No firm is recorded against this work"
          expectedIn="Work order abstract, or the award record for the tender"
        />
      </Section>
    );
  }

  return (
    <Section title="Contractor">
      <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 10px" }}>{contractor.name}</p>
      <Pairs
        rows={[
          { label: "Firm ID", value: <code style={{ fontSize: 12.5 }}>{contractor.id}</code> },
          { label: "Registration", value: contractor.registrationId },
          {
            label: "Registered office",
            value: contractor.registeredOfficeCity,
          },
          {
            label: "This contract",
            value: project.contractValue.present
              ? Money.fromDecimalString(project.contractValue.amountInr).format()
              : "Not in the records held",
          },
          ...(contractorActivity === null
            ? []
            : [
                {
                  label: "Works held",
                  value: (
                    <>
                      {contractorActivity.projectCount} in the records held
                      <span
                        style={{
                          display: "block",
                          fontSize: 11.5,
                          color: "var(--ld-text-tertiary)",
                        }}
                      >
                        Across {contractorActivity.stateCodes.length} state
                        {contractorActivity.stateCodes.length === 1 ? "" : "s"}. This counts what
                        LokDarpan holds, not every contract awarded.
                      </span>
                    </>
                  ),
                },
              ]),
        ]}
      />
      <p style={{ marginTop: 12, marginBottom: 0 }}>
        <Link className={controlStyles.link} href={`/company/${contractor.id}`}>
          View firm profile <span aria-hidden="true">→</span>
        </Link>
      </p>
    </Section>
  );
}
