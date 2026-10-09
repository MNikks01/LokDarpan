import type React from "react";

import type {
  FieldValue,
  MissingReason,
  TenderField,
  TenderRecord,
  TenderSection,
} from "@lokdarpan/domain";

import { tenderCopy } from "@/copy/tender";
import { color, radius, space } from "@/ui/tokens";

/**
 * One tender, laid out the way a person reads a place card on a map: what it
 * is and where it stands first, the three facts most people want next, then a
 * section for each question, and the source at the foot (ADR-079).
 *
 * A section lists what is known. What is not known is gathered into one short
 * line at its foot with the reason, never a column of empty rows.
 */

const QUICK: readonly TenderField["key"][] = ["estimatedValue", "bidsClose", "workCategory"];

function knownValue(field: TenderField | undefined): FieldValue | null {
  return field?.value.state === "known" ? field.value.value : null;
}

function QuickFacts({ record }: { readonly record: TenderRecord }): React.JSX.Element | null {
  const fields = record.sections.flatMap((s) => s.fields);
  const facts = QUICK.map((key) => ({
    key,
    value: knownValue(fields.find((f) => f.key === key)),
  })).filter((f): f is { key: TenderField["key"]; value: FieldValue } => f.value !== null);
  if (facts.length === 0) return null;
  return (
    <section
      aria-label={tenderCopy.quickFacts}
      style={{ display: "flex", flexWrap: "wrap", gap: space[3], marginTop: space[3] }}
    >
      {facts.map((f) => (
        <div
          key={f.key}
          style={{
            flex: "1 1 140px",
            padding: space[3],
            borderRadius: radius.md,
            border: `1px solid ${color.border.hair}`,
          }}
        >
          <div style={{ fontSize: 12, color: color.text.secondary }}>{tenderCopy.field(f.key)}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
            {tenderCopy.value(f.value)}
          </div>
        </div>
      ))}
    </section>
  );
}

function Section({ section }: { readonly section: TenderSection }): React.JSX.Element {
  const known = section.fields.filter((f) => f.value.state === "known");
  // Missing fields grouped by reason, so each reason is said once.
  const byReason = new Map<MissingReason, string[]>();
  for (const f of section.fields) {
    if (f.value.state !== "missing") continue;
    const list = byReason.get(f.value.why) ?? [];
    list.push(tenderCopy.field(f.key));
    byReason.set(f.value.why, list);
  }
  return (
    <section style={{ marginTop: space[5] }}>
      <h3 style={{ fontSize: 15, margin: 0 }}>{tenderCopy.section(section.key)}</h3>
      {known.length > 0 && (
        <dl style={{ margin: `${String(space[2])}px 0 0` }}>
          {known.map((f) =>
            f.value.state === "known" ? (
              <div
                key={f.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, 38%) 1fr",
                  gap: space[3],
                  padding: `${String(space[2])}px 0`,
                  borderBottom: `1px solid ${color.border.hair}`,
                }}
              >
                <dt style={{ fontSize: 13, color: color.text.secondary }}>
                  {tenderCopy.field(f.key)}
                </dt>
                <dd style={{ margin: 0, fontSize: 14 }}>{tenderCopy.value(f.value.value)}</dd>
              </div>
            ) : null,
          )}
        </dl>
      )}
      {[...byReason].map(([why, labels]) => (
        <p
          key={why}
          style={{ fontSize: 12, color: color.text.tertiary, margin: `${String(space[2])}px 0 0` }}
        >
          {tenderCopy.notAvailable(labels)} {tenderCopy.missing(why)}
        </p>
      ))}
    </section>
  );
}

export function TenderPanel({
  record,
  now = new Date(),
}: {
  readonly record: TenderRecord;
  readonly now?: Date;
}): React.JSX.Element {
  const where = record.sections.find((s) => s.key === "where");
  const district = knownValue(where?.fields.find((f) => f.key === "officeDistrict"));
  return (
    <article aria-labelledby={`tender-${String(record.id)}`}>
      <h2 id={`tender-${String(record.id)}`} style={{ fontSize: 20, margin: 0, lineHeight: 1.3 }}>
        {record.title}
      </h2>
      <p style={{ fontSize: 13, color: color.text.secondary, margin: `${String(space[1])}px 0 0` }}>
        {tenderCopy.reference(record.reference)}
      </p>
      <p style={{ fontSize: 14, margin: `${String(space[2])}px 0 0` }}>
        {tenderCopy.status(record.status, now)}
      </p>
      {district !== null && (
        <p
          style={{ fontSize: 12, color: color.text.tertiary, margin: `${String(space[1])}px 0 0` }}
        >
          {tenderCopy.officeNotSite}
        </p>
      )}

      <QuickFacts record={record} />

      {record.sections.map((s) => (
        <Section key={s.key} section={s} />
      ))}

      <footer
        style={{
          marginTop: space[5],
          paddingTop: space[3],
          borderTop: `1px solid ${color.border.hair}`,
          fontSize: 13,
        }}
      >
        <a
          href={record.source.url}
          rel="noreferrer noopener"
          style={{ color: color.text.primary, fontWeight: 600 }}
        >
          {tenderCopy.openOriginal}
        </a>
        <p style={{ color: color.text.secondary, margin: `${String(space[2])}px 0 0` }}>
          {tenderCopy.seen(record.source.firstSeenAt, record.source.lastSeenAt)}
        </p>
        <p style={{ color: color.text.secondary, margin: `${String(space[1])}px 0 0` }}>
          {tenderCopy.changes(record.changes)}
        </p>
      </footer>
    </article>
  );
}

/** What the public sees until the issuing department permits (ADR-056). */
export function TenderWithheld({
  portalUrl,
}: {
  readonly portalUrl: string | null;
}): React.JSX.Element {
  return (
    <div>
      <p style={{ fontSize: 14, margin: 0 }}>{tenderCopy.withheld}</p>
      {portalUrl !== null && (
        <p style={{ margin: `${String(space[2])}px 0 0` }}>
          <a href={portalUrl} rel="noreferrer noopener" style={{ color: color.text.primary }}>
            {tenderCopy.withheldLink}
          </a>
        </p>
      )}
    </div>
  );
}
