import type React from "react";

import { formatAmount, formatAmountSpoken } from "@lokdarpan/money";
import { isReviewComplete, type DocumentFactsView, type PublishedFact } from "@lokdarpan/domain";

import { color, figureFontFeatures, radius, space } from "@/ui/tokens";
import { publishedFactsCopy, scanFactCopy } from "@/copy/figures";
import { reportCopy } from "@/copy/report";

/**
 * Presentation for verified facts, kept out of the route so it can be rendered
 * in a test without a database, a request or a router. What these components
 * say is the part most worth testing: the wording is what a reader takes away.
 */

const KIND_LABEL: Readonly<Record<PublishedFact["kind"], string>> = {
  monetary_amount: "Amount",
  contractor_reference: "Firm named",
  officer_role_reference: "Role named",
  work_reference: "Work named",
  tender_identifier: "Tender identifier",
  tender_date: "Tender date",
  body_reference: "Body named",
  place_reference: "Place named",
};

/** A value, in the form the source stated it. */
export function Value({ fact }: { readonly fact: PublishedFact }): React.JSX.Element {
  if (fact.kind !== "monetary_amount") {
    return <span style={{ fontWeight: 600, color: color.text.primary }}>{fact.value}</span>;
  }
  // A rate is rendered with its denominator or not at all. "₹1,500" beside a
  // page citation is a claim the source never made; "₹1,500 per month" is the
  // claim it did (ADR-044). The unit is read into `perUnit` and shown here in
  // the words the page uses, never abbreviated or pluralised into something the
  // document does not say.
  const perUnit = fact.perUnit;
  return (
    <span
      style={{ fontWeight: 600, color: color.text.primary, ...figureFontFeatures }}
      title={
        perUnit === null
          ? formatAmountSpoken(fact.value)
          : `${formatAmountSpoken(fact.value)} per ${perUnit}`
      }
    >
      {formatAmount(fact.value)}
      {perUnit === null ? null : (
        <span style={{ fontWeight: 400, color: color.text.secondary }}> per {perUnit}</span>
      )}
    </span>
  );
}

export function FactCard({ fact }: { readonly fact: PublishedFact }): React.JSX.Element {
  const verified = new Date(fact.verifiedAt);
  return (
    <li
      style={{
        listStyle: "none",
        background: color.bg.surface,
        border: `1px solid ${color.border.hair}`,
        borderRadius: radius.md,
        padding: space[4],
        marginBottom: space[2],
      }}
    >
      <div style={{ fontSize: 12, color: color.text.tertiary, marginBottom: 4 }}>
        {KIND_LABEL[fact.kind]}
      </div>
      <div style={{ fontSize: 18, marginBottom: space[2] }}>
        <Value fact={fact} />
      </div>

      {/*
        The sentence as the document published it. A reader who cannot see the
        words the value was drawn from is being asked to take our word for it,
        which is the opposite of what this project is for.
      */}
      <blockquote
        style={{
          margin: 0,
          padding: `0 0 0 ${String(space[2])}px`,
          borderLeft: `2px solid ${color.border.strong}`,
          color: color.text.secondary,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {fact.evidence}
      </blockquote>

      <div style={{ fontSize: 12, color: color.text.tertiary, marginTop: space[2] }}>
        Page {fact.pageNumber} · verified by {fact.verifiedBy} on{" "}
        <time dateTime={verified.toISOString()}>{verified.toISOString().slice(0, 10)}</time>
        {fact.origin === "corrected_by_reviewer" && (
          // Stated, never silent. A reader comparing this to the PDF must know
          // the figure shown is the reviewer's reading, not the extractor's.
          <>{publishedFactsCopy.correctedByReviewer}</>
        )}
      </div>
      {fact.scanReading !== null && <ScanReadingNote reading={fact.scanReading} />}
      {/* Every figure can be questioned from where it is shown (ADR-075). */}
      <div style={{ fontSize: 12, marginTop: space[2] }}>
        <a
          href={`/report?subject=${encodeURIComponent(`fact:${String(fact.id)}`)}`}
          style={{ color: color.text.tertiary }}
        >
          {reportCopy.reportThisFigure}
        </a>
      </div>
    </li>
  );
}

/**
 * What a reader must know about a figure read from a scanned page (ADR-072):
 * that text recognition read it, which engine, and how legible the characters
 * were to it. Never optional for such a figure, and worded as legibility — a
 * percentage beside a government figure would read as the chance it is right.
 */
export function ScanReadingNote({
  reading,
}: {
  readonly reading: NonNullable<PublishedFact["scanReading"]>;
}): React.JSX.Element {
  return (
    <div
      role="note"
      style={{
        marginTop: space[2],
        paddingTop: space[2],
        borderTop: `1px solid ${color.border.hair}`,
        fontSize: 12,
        lineHeight: 1.5,
        color: color.text.secondary,
      }}
    >
      <div style={{ fontWeight: 600 }}>{scanFactCopy.label}</div>
      <div>{scanFactCopy.explanation(reading.engine, reading.engineVersion)}</div>
      <div>{scanFactCopy.legibility(reading.legible)}</div>
    </div>
  );
}

/**
 * What this page does not claim.
 *
 * Two limits apply at once and neither is inferable from the facts shown: an
 * audit examines selected matters rather than listing them all, and review of
 * what was extracted is itself partial. Without both stated, four facts read as
 * "this is what the report found", which would be a claim nobody has made.
 */
export function Scope({ view }: { readonly view: DocumentFactsView }): React.JSX.Element {
  const complete = isReviewComplete(view);
  const counted = `${String(view.facts.length)} ${view.facts.length === 1 ? "fact" : "facts"} that a person has checked against the page it was read from.`;
  return (
    <aside
      style={{
        background: color.bg.raised,
        border: `1px solid ${color.border.hair}`,
        borderRadius: radius.md,
        padding: space[4],
        margin: `${String(space[4])}px 0`,
        fontSize: 13,
        color: color.text.secondary,
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: color.text.primary }}>What this page shows</strong>
      <p style={{ margin: "6px 0 0" }}>
        {view.facts.length === 0 ? "No fact from this document has been verified yet." : counted}{" "}
        {complete
          ? "Every candidate extracted from this document has been reviewed."
          : `${String(view.awaitingReview)} further extracted candidates are awaiting review and are not shown.`}
      </p>
      <p style={{ margin: "8px 0 0" }}>{publishedFactsCopy.notASummary}</p>
      {view.pagesWithoutText > 0 && (
        <p style={{ margin: "8px 0 0" }}>
          {view.facts.some((f) => f.scanReading !== null)
            ? scanFactCopy.pagesWithoutTextSomeRead(view.pagesWithoutText, view.pageCount)
            : publishedFactsCopy.pagesWithoutText(view.pagesWithoutText, view.pageCount)}
        </p>
      )}
    </aside>
  );
}
