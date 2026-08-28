import type React from "react";
import Link from "next/link";
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
      <p style={{ maxWidth: "62ch", color: color.text.secondary }}>
        LokDarpan presents facts, calculations and neutral comparisons drawn from official records.
        It is not an enforcement body and not a legal authority, and what it shows is never an
        accusation. Where a feature would imply fault, the feature is withheld.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>What is real on this screen and what is not</h2>
      <ul style={{ maxWidth: "62ch", lineHeight: 1.65 }}>
        <li>
          <strong>Real:</strong> state and district boundaries, derived from Census 2011
          administrative units and simplified for display.
        </li>
        <li>
          <strong>Demo:</strong> every work, firm, officer, tender, document and figure. They are
          fictional, and their source citations use the reserved <code>.invalid</code> domain so
          they can never be mistaken for a government publication.
        </li>
        <li>
          <strong>Absent:</strong> local-body boundaries. No register reviewed publishes them in a
          usable form, so the map frames an approximate extent and says so rather than drawing a
          line that no document supports.
        </li>
      </ul>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Rules the interface follows</h2>
      <ul style={{ maxWidth: "62ch", lineHeight: 1.65 }}>
        <li>
          No red is used for any status, variance or priority. Red is for destructive actions.
        </li>
        <li>No score, rank or badge is attached to a firm or an officer.</li>
        <li>
          A missing value is named as missing, with the record that would carry it. It is never
          shown as zero.
        </li>
        <li>Every figure carries the document it was read from, and links to it.</li>
        <li>
          A scheduled date and a date that occurred are drawn differently, so a plan is never read
          as an accomplishment.
        </li>
      </ul>
    </>
  );
}
