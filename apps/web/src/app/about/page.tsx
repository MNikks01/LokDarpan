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

      <h2 style={{ fontSize: 18, marginTop: 28 }}>What is on this screen, and what is missing</h2>
      <ul style={{ maxWidth: "62ch", lineHeight: 1.65 }}>
        <li>
          <strong>Boundaries</strong> — real. State and district geometry derived from Census 2011
          administrative units and simplified for display.
        </li>
        <li>
          <strong>Records</strong> — real. Audit reports published by the Comptroller and Auditor
          General, and the facts within them that a person has checked against the page they were
          read from. Nothing unverified is shown.
        </li>
        <li>
          <strong>Works</strong> — absent. No register of individual works has been located for any
          area, so the map draws none. The state public works portal publishes no register, the
          procurement portals gate search and awards behind a CAPTCHA, no government source for road
          geometry has been found, and PMGSY&rsquo;s terms forbid republication.
        </li>
        <li>
          <strong>Places below state level</strong> — absent from the ledger. Boundaries are drawn
          because the Census publishes them, but the Local Government Directory gates district and
          village views behind a CAPTCHA, so no record is held against a district yet.
        </li>
      </ul>

      <p style={{ maxWidth: "62ch", color: color.text.secondary }}>
        An empty map and an unpublished register look identical. Which one you are looking at is
        stated in words beside the map, with the source that was checked and when.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Rules the interface follows</h2>
      <ul style={{ maxWidth: "62ch", lineHeight: 1.65 }}>
        <li>
          No red is used for any status, variance or priority. Red is for destructive actions.
        </li>
        <li>No score, rank or badge is attached to a firm or an officer.</li>
        <li>
          A missing value is named as missing, with the record that would carry it. It is never
          shown as zero, and an absence in our holdings is never presented as an absence in the
          public record.
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
