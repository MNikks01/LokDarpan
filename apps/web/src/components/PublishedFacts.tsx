import type React from "react";

import { Money } from "@lokdarpan/money";
import { isReviewComplete, type DocumentFactsView, type PublishedFact } from "@lokdarpan/domain";

import { color, figureFontFeatures, radius, space } from "@/ui/tokens";

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
};

/** A value, in the form the source stated it. */
export function Value({ fact }: { readonly fact: PublishedFact }): React.JSX.Element {
  if (fact.kind !== "monetary_amount") {
    return <span style={{ fontWeight: 600, color: color.text.primary }}>{fact.value}</span>;
  }
  const money = Money.fromDecimalString(fact.value);
  return (
    <span
      style={{ fontWeight: 600, color: color.text.primary, ...figureFontFeatures }}
      title={money.toAccessibleString()}
    >
      {money.format()}
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
          <> · corrected by the reviewer against the page</>
        )}
      </div>
    </li>
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
      <p style={{ margin: "8px 0 0" }}>
        This is not a summary of the document, and absence here does not mean the document is silent
        on a subject — it means nobody has confirmed a reading of it yet. An audit report examines
        selected matters; it is not a register of all of them.
      </p>
      {view.pagesWithoutText > 0 && (
        <p style={{ margin: "8px 0 0" }}>
          {view.pagesWithoutText} of {view.pageCount} pages carried no readable text and were not
          searched. They may contain figures this page does not show.
        </p>
      )}
    </aside>
  );
}
