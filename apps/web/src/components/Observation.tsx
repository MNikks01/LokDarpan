import type React from "react";
import type { ServerText } from "@lokdarpan/neutrality";
import { color } from "@/ui/tokens";

/**
 * <Observation> accepts ONLY ServerText — text generated server-side from
 * vetted templates and passed the neutrality checker (docs/15 §Enforcement).
 *
 * A string literal will not type-check, so this is impossible to write:
 *     <Observation text="This contractor overcharged" />   // ← compile error
 */
export interface ObservationProps {
  readonly text: ServerText;
  readonly severity: "info" | "low" | "medium" | "high";
  readonly confidence: number;
}

const BAND = {
  info: color.band.low,
  low: color.band.low,
  medium: color.band.medium,
  high: color.band.high,
} as const;

export function Observation({ text, severity, confidence }: ObservationProps): React.JSX.Element {
  const band = BAND[severity];
  return (
    <li
      style={{
        listStyle: "none",
        padding: 12,
        background: band.bg,
        borderRadius: 10,
        marginBottom: 8,
      }}
    >
      <span aria-hidden="true" style={{ color: band.fg }}>
        {band.glyph}{" "}
      </span>
      <span style={{ color: color.text.primary }}>{text}</span>
      <div style={{ fontSize: 12, color: color.text.secondary, marginTop: 4 }}>
        {severity} · {Math.round(confidence * 100)}% confidence
      </div>
    </li>
  );
}

/** The disclaimer docs/15 requires on every observation surface. Not collapsible. */
export function ObservationDisclaimer(): React.JSX.Element {
  return (
    <p style={{ fontSize: 13, color: color.text.secondary, maxWidth: "60ch" }}>
      ⓘ These are data-consistency observations from official records, not findings of wrongdoing.
    </p>
  );
}
