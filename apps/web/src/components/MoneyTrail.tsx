import type { FinanceChain } from "@lokdarpan/api-contract";
import { Money } from "@lokdarpan/money";
import { Figure } from "./Figure";
import { color } from "@/ui/tokens";

/**
 * MoneyTrail — the signature component (.docs/wireframes/08-financial-flow.md).
 *
 * Rules that are load-bearing, not stylistic:
 *  · BOTH variances are shown, each with its subtraction and its denominator
 *    IN WORDS. Never a bare percentage (audit C1).
 *  · A missing stage renders <Figure> in its missing state — never ₹0 — and no
 *    variance is computed across it (docs/06 §2).
 *  · No colour encodes the size of a variance. The status label carries meaning.
 */
const STATUS_COPY = {
  consistent: { glyph: "○", label: "Consistent" },
  needs_verification: { glyph: "◔", label: "Needs verification" },
  insufficient_data: { glyph: "⊘", label: "Insufficient data" },
} as const;

function VarianceRow({
  title, minuend, subtrahend, varianceInr, deviationPct, denominatorLabel,
}: {
  title: string; minuend: string; subtrahend: string;
  varianceInr: string | null; deviationPct: number | null; denominatorLabel: string;
}) {
  if (varianceInr === null || deviationPct === null) {
    return (
      <div style={{ padding: "12px 0 12px 20px", borderLeft: `2px solid ${color.border.hair}`, marginLeft: 12 }}>
        <div style={{ fontSize: 13, color: color.text.secondary }}>
          {title}: cannot be calculated
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "12px 0 12px 20px", borderLeft: `2px solid ${color.border.hair}`, marginLeft: 12 }}>
      <div style={{ fontSize: 13, color: color.text.secondary }}>{title}</div>
      <div style={{ fontSize: 13, color: color.text.tertiary, fontVariantNumeric: "tabular-nums" }}>
        {minuend} − {subtrahend}
      </div>
      <div style={{ fontSize: 15, color: color.text.primary, fontVariantNumeric: "tabular-nums" }}>
        = {Money.fromDecimalString(varianceInr).format()}
      </div>
      {/* The denominator is stated in words — never a bare "11.1%". */}
      <div style={{ fontSize: 13, color: color.text.secondary }}>
        = {deviationPct.toFixed(1)}% of the {denominatorLabel}
      </div>
    </div>
  );
}

export function MoneyTrail({ finance }: { readonly finance: FinanceChain }) {
  const status = STATUS_COPY[finance.status];
  const shown = (f: FinanceChain["allocated"]) =>
    f.present ? Money.fromDecimalString(f.amountInr).format() : "—";

  return (
    <section aria-label="Money trail">
      <Figure label="ALLOCATED" data={finance.allocated} emphasis="lg" />
      <VarianceRow
        title="Allocation variance (Allocated − Utilized)"
        minuend={shown(finance.allocated)}
        subtrahend={shown(finance.utilized)}
        varianceInr={finance.allocationVarianceInr}
        deviationPct={finance.allocationDeviationPct}
        denominatorLabel="allocated amount"
      />
      <Figure label="RELEASED" data={finance.released} emphasis="lg" />
      <VarianceRow
        title="Release variance (Released − Utilized)"
        minuend={shown(finance.released)}
        subtrahend={shown(finance.utilized)}
        varianceInr={finance.releaseVarianceInr}
        deviationPct={finance.releaseDeviationPct}
        denominatorLabel="released amount"
      />
      <Figure label="UTILIZED" data={finance.utilized} emphasis="lg" />

      <div style={{ marginTop: 20, padding: 12, background: color.bg.raised, borderRadius: 10 }}>
        <div style={{ fontWeight: 600, color: color.text.primary }}>
          <span aria-hidden="true">{status.glyph} </span>{status.label}
        </div>
        {finance.thresholdPct !== null && finance.releaseDeviationPct !== null && (
          <p style={{ fontSize: 13, color: color.text.secondary, margin: "6px 0 0", maxWidth: "60ch" }}>
            Allocated ≥ Released ≥ Utilized holds. The {finance.releaseDeviationPct.toFixed(1)}% gap
            between released and utilized exceeds the {finance.thresholdPct}% threshold configured
            for this category.
          </p>
        )}
        <p style={{ fontSize: 13, color: color.text.secondary, margin: "8px 0 0", maxWidth: "60ch" }}>
          ⓘ This is an arithmetic observation. It does not indicate that anything is wrong.
        </p>
      </div>
    </section>
  );
}
