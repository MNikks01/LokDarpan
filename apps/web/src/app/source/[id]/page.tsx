import type React from "react";
import { notFound } from "next/navigation";
import { demoSource } from "@/data/demo/sources";
import { RecordPage, RecordPairs, RecordSection } from "@/components/RecordPage";
import { color } from "@/ui/tokens";

/**
 * The destination every `<Figure>` links to. A figure that cannot be followed to
 * the document it was read from is a figure without provenance, whatever the
 * type says — so this route exists for the same reason the prop is required.
 */
export default async function SourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const numeric = Number.parseInt(id, 10);
  const source = Number.isNaN(numeric) ? null : demoSource(numeric);
  if (source === null) notFound();

  const p = source.provenance;

  return (
    <RecordPage kind="Source document" title={source.title} subtitle={source.authority}>
      <RecordSection title="The artefact">
        <RecordPairs
          rows={[
            { label: "Authority", value: source.authority },
            { label: "Tier", value: p.tier },
            { label: "Format", value: p.docType.toUpperCase() },
            { label: "Published", value: source.publishedOn ?? "Publication date not stated" },
            { label: "Retrieved", value: source.retrievedAt.slice(0, 10) },
            { label: "Page", value: p.pageLocator ?? "Whole document" },
            { label: "Digest", value: <code style={{ fontSize: 12 }}>{p.artifactSha256}</code> },
            { label: "Licence", value: p.license ?? "unknown" },
            { label: "Dataset version", value: String(p.datasetVersion) },
          ]}
        />
      </RecordSection>

      <RecordSection title="How the values were read">
        <RecordPairs
          rows={[
            { label: "Method", value: p.extractionMethod },
            {
              label: "Extraction confidence",
              value: `${p.extractionConfidence.toFixed(2)} — how sure we are the value was read correctly`,
            },
            {
              label: "Linkage confidence",
              value: `${p.linkageConfidence.toFixed(2)} — how sure we are the record belongs to the work it is shown against`,
            },
          ]}
        />
        <p style={{ fontSize: 12.5, color: color.text.tertiary, marginTop: 16, maxWidth: "58ch" }}>
          These are two different risks and are never combined into one number. A value read
          perfectly from the wrong document is worse than a value read imperfectly from the right
          one.
        </p>
      </RecordSection>

      <RecordSection title="Retrieval">
        <p style={{ fontSize: 13.5, margin: 0, maxWidth: "58ch" }}>
          This is a demo source. Its URLs use the reserved <code>.invalid</code> domain and resolve
          nowhere by design, so a fabricated citation can never be mistaken for a government
          publication.
        </p>
        <p style={{ fontSize: 13, color: color.text.secondary, marginTop: 10 }}>
          <code>{p.archivedUrl}</code>
        </p>
      </RecordSection>
    </RecordPage>
  );
}
