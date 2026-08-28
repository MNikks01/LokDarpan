"use client";

import type React from "react";
import Link from "next/link";
import { Figure } from "@/components/Figure";
import { TENDER_METHOD_LABEL } from "@/domain/project";
import type { ProjectDossier } from "@/data/repositories";
import { controlStyles } from "@/components/ui";
import { NotRecorded, Pairs, Section, formatDate } from "./primitives";

export function ProcurementSection({
  dossier,
}: {
  readonly dossier: ProjectDossier;
}): React.JSX.Element {
  const { tender, contractor } = dossier;

  if (tender === null) {
    return (
      <Section title="Procurement">
        <NotRecorded
          what="No tender is recorded against this work"
          expectedIn="Tender notice register"
        />
      </Section>
    );
  }

  return (
    <Section title="Procurement">
      <Pairs
        rows={[
          {
            label: "Tender ID",
            value: <code style={{ fontSize: 12.5 }}>{tender.externalId}</code>,
          },
          { label: "Published", value: formatDate(tender.publishedOn) },
          { label: "Bids close", value: formatDate(tender.bidsCloseOn) },
          { label: "Method", value: TENDER_METHOD_LABEL[tender.method] },
          {
            label: "Bidders",
            value:
              tender.bidderCount === null ? (
                // Never 0: an unpublished bid summary is not a tender nobody bid on.
                <NotRecorded what="Bid summary not published" expectedIn="Tender notice register" />
              ) : (
                String(tender.bidderCount)
              ),
          },
          {
            label: "Awarded to",
            value:
              contractor === null ? (
                <NotRecorded what="No award recorded" expectedIn="Work order abstract" />
              ) : (
                contractor.name
              ),
          },
        ]}
      />
      <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
        <Figure label="Estimated cost" data={tender.estimatedCost} emphasis="sm" />
        <Figure label="Awarded value" data={tender.awardedValue} emphasis="sm" />
      </div>
      <p
        style={{
          fontSize: 11.5,
          color: "var(--ld-text-tertiary)",
          margin: "12px 0 0",
          maxWidth: "46ch",
        }}
      >
        Estimated cost and awarded value are two separate figures from two separate documents. The
        difference between them is not calculated here — a variance is produced by the analytics
        tier with its own denominator and provenance.
      </p>
      <p style={{ marginTop: 10, marginBottom: 0 }}>
        <Link className={controlStyles.link} href={`/tender/${encodeURIComponent(tender.id)}`}>
          View tender record <span aria-hidden="true">→</span>
        </Link>
      </p>
    </Section>
  );
}
