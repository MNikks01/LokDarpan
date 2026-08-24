import { FinanceChainSchema } from "@lokdarpan/api-contract";
import { FIXTURE_PROJECT_501, FIXTURE_WARNING } from "@lokdarpan/api-contract/fixtures";
import { MoneyTrail } from "@/components/MoneyTrail";
import { color } from "@/ui/tokens";

/**
 * Server Component. The API client, the Zod schemas and the mappers all stay on
 * the server — this page ships effectively no JavaScript for its content, which
 * is what makes the 90 KB budget in .docs/27 achievable and the page indexable.
 *
 * ISR: revalidated by datasetVersion cache tag via webhook, not by a timer.
 */
export const revalidate = false;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Validated at the boundary: a contract violation is a typed failure here,
  // never a half-parsed financial figure rendered to a reader.
  const finance = FinanceChainSchema.parse(FIXTURE_PROJECT_501.finance);
  const p = FIXTURE_PROJECT_501;

  return (
    <>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: color.text.secondary }}>
        India › Maharashtra › Pune › {p.unit.name}
      </nav>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>{p.name}</h1>
      <div style={{ color: color.text.secondary, fontSize: 14 }}>
        Rural road · {p.status.replace("_", " ")} · Work ID {p.externalWorkId} · {p.fiscalYear}
      </div>

      <div
        style={{
          margin: "16px 0", padding: 12, borderRadius: 10,
          background: color.band.high.bg, color: color.band.high.fg, fontSize: 13,
        }}
      >
        ⚠ {FIXTURE_WARNING} · project id {id}
      </div>

      <h2 style={{ fontSize: 18, marginTop: 24 }}>Money trail</h2>
      <MoneyTrail finance={finance} />

      <p style={{ fontSize: 12, color: color.text.tertiary, marginTop: 32 }}>
        Data as of {p.meta.asOf.slice(0, 10)} · version {p.meta.datasetVersion}
      </p>
    </>
  );
}
