import type React from "react";
import { color } from "@/ui/tokens";

/**
 * Every fact on a page states where it came from. This component is the only
 * approved way to render that statement, so a fact and its source cannot drift
 * apart in markup.
 */
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
        Local Government Directory, Ministry of Panchayati Raj
      </a>{" "}
      · retrieved{" "}
      <time dateTime={retrieved.toISOString()}>
        {retrieved.toLocaleDateString("en-IN", { dateStyle: "long" })}
      </time>{" "}
      · dataset version {datasetVersion}
    </p>
  );
}
