import type React from "react";
import { color } from "@/ui/tokens";

/**
 * Every fact on a page states where it came from. This component is the only
 * approved way to render that statement, so a fact and its source cannot drift
 * apart in markup.
 */
/**
 * The publisher is derived from the URL, never hardcoded.
 *
 * A fixed attribution is fine until a second source appears, and then it
 * silently credits one government body for another's data. That is a
 * provenance defect, not a copy error.
 */
const PUBLISHERS: readonly { readonly host: string; readonly name: string }[] = [
  { host: "lgdirectory.gov.in", name: "Local Government Directory, Ministry of Panchayati Raj" },
  { host: "mahakosh.gov.in", name: "Finance Department, Government of Maharashtra (BEAMS)" },
];

function publisherOf(sourceUrl: string): string {
  try {
    const { hostname } = new URL(sourceUrl);
    return (
      PUBLISHERS.find((p) => hostname === p.host || hostname.endsWith(`.${p.host}`))?.name ??
      hostname
    );
  } catch {
    return "the published source";
  }
}

export function ProvenanceNote({
  sourceUrl,
  retrievedAt,
  datasetVersion,
}: {
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly datasetVersion: number;
}): React.JSX.Element {
  const retrieved = new Date(retrievedAt);
  return (
    <p style={{ fontSize: 12, color: color.text.tertiary, margin: "12px 0 0" }}>
      Source:{" "}
      <a href={sourceUrl} rel="noreferrer noopener" style={{ color: color.text.secondary }}>
        {publisherOf(sourceUrl)}
      </a>{" "}
      · retrieved{" "}
      <time dateTime={retrieved.toISOString()}>
        {retrieved.toLocaleDateString("en-IN", { dateStyle: "long" })}
      </time>{" "}
      · dataset version {datasetVersion}
    </p>
  );
}
