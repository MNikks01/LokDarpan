import type { Provenance, Figure as FigureData } from "@lokdarpan/contracts";
import { Money } from "@lokdarpan/money";
import { color, figureFontFeatures } from "@/ui/tokens";

/**
 * <Figure> — the ONLY way to display a monetary fact.
 *
 * `provenance` is REQUIRED. There is no default and no optional variant, so a
 * figure without a source cannot be rendered: it is a TypeScript error, not a
 * code-review catch. This is docs/15 rule 5 ("every number must be traceable")
 * made structural. See .docs/27 §Neutrality primitives.
 */
export interface FigureProps {
  readonly label: string;
  readonly data: FigureData;
  readonly emphasis?: "lg" | "md" | "sm";
}

function confidenceNote(p: Provenance): string | null {
  if (p.linkageConfidence < 0.95) {
    return `This record was matched to this project by name similarity (${p.linkageConfidence.toFixed(2)}). It may belong to a different work.`;
  }
  if (p.extractionConfidence < 0.9) {
    return `Extracted from a ${p.docType === "scan" ? "scanned" : "published"} document by ${p.extractionMethod}. The value may contain a reading error.`;
  }
  return null;
}

export function Figure({ label, data, emphasis = "md" }: FigureProps) {
  if (!data.present) {
    // docs/15 rule 8: absence is shown explicitly, never as ₹0, never blank.
    return (
      <div style={{ background: color.missing.bg, padding: 12, borderRadius: 10 }}>
        <div style={{ fontSize: 13, color: color.text.secondary }}>{label}</div>
        <div style={{ color: color.missing.fg, fontSize: 15, marginTop: 4 }}>
          <span aria-hidden="true">{color.missing.glyph} </span>
          {data.missingReason}
        </div>
        <p style={{ fontSize: 13, color: color.text.secondary, margin: "8px 0 0" }}>
          This does not mean no money was spent — it means the record has not been
          published or collected yet.
        </p>
        {data.expectedSource && (
          <div style={{ fontSize: 12, color: color.text.tertiary, marginTop: 6 }}>
            Expected source: {data.expectedSource}
            {data.lastCheckedAt && ` · last checked ${data.lastCheckedAt}`}
          </div>
        )}
      </div>
    );
  }

  const money = Money.fromDecimalString(data.amountInr);
  const p = data.provenance;
  const note = confidenceNote(p);
  const size = emphasis === "lg" ? 28 : emphasis === "md" ? 20 : 15;

  return (
    <div>
      <div style={{ fontSize: 13, color: color.text.secondary }}>{label}</div>
      <div
        style={{ fontSize: size, fontWeight: 600, color: color.text.primary, ...figureFontFeatures }}
        // Screen reader hears the value AND its source AND its confidence.
        aria-label={`${label}: ${money.toAccessibleString()}. Source: ${p.sourceName}. ${
          note ?? "High confidence."
        } Data as of ${p.retrievedAt.slice(0, 10)}.`}
      >
        {money.format()}
      </div>
      <a
        href={`/source/${p.sourceDocumentId}${p.page ? `?page=${p.page}` : ""}`}
        style={{ fontSize: 12, color: color.text.secondary, textDecoration: "none" }}
      >
        🔗 {p.sourceName}
        {p.pageLocator && ` · ${p.pageLocator}`}
        {` · ${p.extractionMethod}`}
      </a>
      {note && (
        <p style={{ fontSize: 12, color: color.band.high.fg, margin: "6px 0 0", maxWidth: "42ch" }}>
          ⚠ {note}
        </p>
      )}
    </div>
  );
}
