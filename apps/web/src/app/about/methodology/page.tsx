import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { sourceLicences } from "@lokdarpan/domain";

import { methodologyCopy as copy, methodFor } from "@/copy/methodology";
import { color } from "@/ui/tokens";

export const metadata: Metadata = {
  title: `${copy.title} — LokDarpan`,
  description: copy.intro,
};

const prose: React.CSSProperties = { maxWidth: "62ch", lineHeight: 1.65 };
const h2: React.CSSProperties = { fontSize: 18, marginTop: 32 };

/**
 * How every figure on the site came to be there (LD-005). Sources are listed
 * from the licence registry itself, so a source's recorded terms and its
 * description here cannot disagree about which sources exist.
 */
export default function MethodologyPage(): React.JSX.Element {
  return (
    <>
      <h1 style={{ fontSize: 26 }}>{copy.title}</h1>
      <p style={{ ...prose, color: color.text.secondary }}>{copy.intro}</p>

      <h2 style={h2}>{copy.sourcesHeading}</h2>
      <p style={prose}>{copy.sourcesIntro}</p>
      {sourceLicences().map((licence) => {
        const method = methodFor(licence.sourceId);
        return (
          <section key={licence.sourceId} style={{ ...prose, marginTop: 20 }}>
            <h3 style={{ fontSize: 15, margin: 0 }}>{licence.attribution}</h3>
            {method !== undefined && (
              <>
                <p style={{ margin: "4px 0 0" }}>{method.collects}</p>
                <p style={{ margin: "4px 0 0", color: color.text.secondary }}>{method.how}</p>
                <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{method.shown}</p>
              </>
            )}
            <p style={{ margin: "4px 0 0", fontSize: 13, color: color.text.tertiary }}>
              {copy.termsLabel}: {copy.republication[licence.republication]} ·{" "}
              <a href={licence.termsUrl} rel="noopener noreferrer" style={{ color: "inherit" }}>
                {copy.termsReadOn(licence.verifiedOn)}
              </a>
            </p>
          </section>
        );
      })}

      <h2 style={h2}>{copy.reviewHeading}</h2>
      <ol style={prose}>
        {copy.review.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <h2 style={h2}>{copy.derivedHeading}</h2>
      <dl style={prose}>
        {copy.derived.map((d) => (
          <div key={d.term} style={{ marginTop: 12 }}>
            <dt style={{ fontWeight: 600 }}>{d.term}</dt>
            <dd style={{ margin: 0 }}>{d.meaning}</dd>
          </div>
        ))}
      </dl>

      <h2 style={h2}>{copy.placementHeading}</h2>
      <p style={prose}>{copy.placementIntro}</p>
      <table style={{ ...prose, borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          {copy.placement.map((p) => (
            <tr key={p.method} style={{ borderBottom: `1px solid ${color.border.hair}` }}>
              <td style={{ padding: "6px 12px 6px 0" }}>{p.method}</td>
              <td style={{ padding: "6px 0", color: color.text.secondary }}>{p.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={prose}>{copy.placementTail}</p>

      <h2 style={h2}>{copy.bodiesHeading}</h2>
      <p style={prose}>{copy.bodies}</p>

      <h2 style={h2}>{copy.placesHeading}</h2>
      <p style={prose}>{copy.places}</p>

      <h2 style={h2}>{copy.confidenceHeading}</h2>
      <p style={prose}>{copy.confidence}</p>

      <h2 style={h2}>{copy.freshnessHeading}</h2>
      <p style={prose}>{copy.freshness}</p>

      <h2 style={h2}>{copy.limitsHeading}</h2>
      <ul style={prose}>
        {copy.limits.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      <h2 style={h2}>{copy.correctionsHeading}</h2>
      <p style={prose}>{copy.corrections}</p>

      <p style={{ fontSize: 13, marginTop: 32 }}>
        <Link href="/about" style={{ color: color.accent.base, textDecoration: "none" }}>
          {copy.aboutLink}
        </Link>
      </p>
    </>
  );
}
