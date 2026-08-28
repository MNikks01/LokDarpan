import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Figure } from "@/components/Figure";
import { DEMO_COMPANIES } from "@/data/demo/organisations";
import { DEMO_PROJECTS } from "@/data/demo/projects";
import { TENDER_METHOD_LABEL } from "@/domain/project";
import { RecordPage, RecordPairs, RecordSection } from "@/components/RecordPage";
import { color } from "@/ui/tokens";

export default async function TenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const record = DEMO_PROJECTS.find((r) => r.tender?.id === id);
  const tender = record?.tender;
  if (record === undefined || tender === undefined || tender === null) notFound();

  const winner = DEMO_COMPANIES.find((c) => c.id === tender.awardedToCompanyId) ?? null;

  return (
    <RecordPage kind="Tender" title={tender.externalId} subtitle={record.project.name}>
      <RecordSection title="Procurement record">
        <RecordPairs
          rows={[
            { label: "Published", value: tender.publishedOn },
            { label: "Bids close", value: tender.bidsCloseOn ?? "Not recorded" },
            { label: "Method", value: TENDER_METHOD_LABEL[tender.method] },
            {
              label: "Bidders",
              value:
                tender.bidderCount === null
                  ? "Bid summary not published"
                  : String(tender.bidderCount),
            },
            { label: "Awarded to", value: winner?.name ?? "No award recorded" },
          ]}
        />
        <div style={{ display: "grid", gap: 18, marginTop: 20, maxWidth: 420 }}>
          <Figure label="Estimated cost" data={tender.estimatedCost} />
          <Figure label="Awarded value" data={tender.awardedValue} />
        </div>
        <p style={{ fontSize: 12.5, color: color.text.tertiary, marginTop: 16, maxWidth: "58ch" }}>
          Estimated cost and awarded value come from two different documents. No difference between
          them is computed on this page — a variance is produced by the analytics tier with its own
          denominator and provenance.
        </p>
      </RecordSection>

      <RecordSection title="Work">
        <Link
          href={`/explore?project=${encodeURIComponent(record.project.id)}`}
          style={{ color: color.accent.base, textDecoration: "none", fontWeight: 550 }}
        >
          {record.project.name} <span aria-hidden="true">→</span>
        </Link>
      </RecordSection>
    </RecordPage>
  );
}
