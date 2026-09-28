import type React from "react";
import Link from "next/link";
import { aboutCopy } from "@/copy/about";
import { color } from "@/ui/tokens";

export default function AboutPage(): React.JSX.Element {
  return (
    <>
      <p style={{ fontSize: 13, margin: "0 0 16px" }}>
        <Link href="/explore" style={{ color: color.accent.base, textDecoration: "none" }}>
          ← Back to the map
        </Link>
      </p>
      <h1 style={{ fontSize: 26 }}>About this explorer</h1>
      <p style={{ maxWidth: "62ch", color: color.text.secondary }}>{aboutCopy.purpose}</p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>{aboutCopy.heldHeading}</h2>
      <ul style={{ maxWidth: "62ch", lineHeight: 1.65 }}>
        <li>
          <strong>Boundaries</strong> {aboutCopy.boundaries}
        </li>
        <li>
          <strong>Records</strong> {aboutCopy.records}
        </li>
        <li>
          <strong>Works</strong> {aboutCopy.works}
        </li>
        <li>
          <strong>Districts</strong> {aboutCopy.districts}
        </li>
      </ul>

      <p style={{ maxWidth: "62ch", color: color.text.secondary }}>
        {aboutCopy.emptyVersusUnpublished}
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>{aboutCopy.rulesHeading}</h2>
      <ul style={{ maxWidth: "62ch", lineHeight: 1.65 }}>
        {aboutCopy.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </>
  );
}
